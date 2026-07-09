"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function audioCtxCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function detectSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof Worker !== "undefined" &&
    audioCtxCtor() !== null &&
    typeof WebAssembly !== "undefined"
  );
}

interface Options {
  onFinal: (text: string) => void;
}

type SpeechStatus = "listening" | "transcribing" | null;

interface SpeechInput {
  supported: boolean;
  listening: boolean;
  /** True while the model downloads/initialises on the first dictation. */
  loading: boolean;
  /** Live phase of dictation, for a status caption. */
  status: SpeechStatus;
  /** Set when the browser denies microphone access. */
  micDenied: boolean;
  /** Warm up the model ahead of first use (call on intent — focus/hover). */
  preload: () => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

interface WorkerMessage {
  type?: "info" | "status" | "output";
  status?: "ready" | "recording_start" | "recording_end";
  message?: string;
  error?: unknown;
}

const SAMPLE_RATE = 16000;

export function useSpeechInput({ onFinal }: Options): SpeechInput {
  // Detected after mount, not during render — the checks touch browser-only globals,
  // so evaluating them at first render would desync SSR and client hydration.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SpeechStatus>(null);
  const [micDenied, setMicDenied] = useState(false);

  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    setSupported(detectSupport());
  }, []);

  const teardownAudio = useCallback(() => {
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (ctxRef.current && ctxRef.current.state !== "closed") void ctxRef.current.close();
    workletRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    teardownAudio();
    setStatus(null);
    setListening(false);
  }, [teardownAudio]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./speech-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      if (data.error) {
        console.error("[speech] worker error", data.error);
        teardownAudio();
        setLoading(false);
        setListening(false);
        return;
      }
      if (data.type === "status") {
        if (data.status === "ready") {
          readyRef.current = true;
          setLoading(false);
        } else if (data.status === "recording_end") {
          setStatus("transcribing");
        } else if (data.status === "recording_start") {
          setStatus("listening");
        }
      } else if (data.type === "output") {
        setStatus("listening");
        const text = data.message?.trim();
        if (text) onFinalRef.current(text);
      }
    };
    worker.onerror = () => {
      teardownAudio();
      setLoading(false);
      setListening(false);
    };
    workerRef.current = worker;
    return worker;
  }, [teardownAudio]);

  const start = useCallback(async () => {
    setMicDenied(false);
    setListening(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
        },
      });
    } catch {
      setMicDenied(true);
      setListening(false);
      return;
    }
    streamRef.current = stream;

    const worker = ensureWorker();
    if (!readyRef.current) setLoading(true);
    void worker;

    try {
      const Ctx = audioCtxCtor();
      if (!Ctx) throw new Error("no AudioContext");
      const ctx = new Ctx({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
      ctxRef.current = ctx;

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      await ctx.audioWorklet.addModule(`${basePath}/vad-processor.js`);
      // A concurrent stop() may have torn things down while we awaited.
      if (ctxRef.current !== ctx) return;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const worklet = new AudioWorkletNode(ctx, "vad-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
      });
      workletRef.current = worklet;
      worklet.port.onmessage = (e: MessageEvent<{ buffer: Float32Array }>) => {
        workerRef.current?.postMessage({ buffer: e.data.buffer });
      };
      source.connect(worklet);
      setStatus("listening");
    } catch (err) {
      console.error("[speech] audio setup failed", err);
      setLoading(false);
      teardownAudio();
      setListening(false);
    }
  }, [ensureWorker, teardownAudio]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  // Warm the model on intent (composer focus / mic hover) rather than page load,
  // so real users get an instant first dictation without taxing every visitor.
  const preload = useCallback(() => {
    if (supported) ensureWorker();
  }, [supported, ensureWorker]);

  useEffect(() => {
    return () => {
      teardownAudio();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [teardownAudio]);

  return {
    supported,
    listening,
    loading,
    status,
    micDenied,
    preload,
    start: () => void start(),
    stop,
    toggle,
  };
}
