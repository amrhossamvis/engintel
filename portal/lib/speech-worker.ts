/// <reference lib="webworker" />
// Ported from huggingface/transformers.js-examples/moonshine-web (worker.js).
// Silero VAD gates the mic stream; complete utterances are transcribed by Moonshine
// and posted back as { type: "output", message: text }.
import {
  AutoModel,
  Tensor,
  pipeline,
  env,
  type PretrainedConfig,
} from "@huggingface/transformers";

// Models are fetched from the Hugging Face CDN at runtime (reachable here), so skip
// the local-path probe that would otherwise 404 first.
env.allowLocalModels = false;

const SAMPLE_RATE = 16000;
const SAMPLE_RATE_MS = SAMPLE_RATE / 1000;
const SPEECH_THRESHOLD = 0.3;
const EXIT_THRESHOLD = 0.1;
const MIN_SILENCE_DURATION_MS = 400;
const MIN_SILENCE_DURATION_SAMPLES = MIN_SILENCE_DURATION_MS * SAMPLE_RATE_MS;
const SPEECH_PAD_MS = 80;
const SPEECH_PAD_SAMPLES = SPEECH_PAD_MS * SAMPLE_RATE_MS;
const MIN_SPEECH_DURATION_SAMPLES = 250 * SAMPLE_RATE_MS;
const MAX_BUFFER_DURATION = 30;
const NEW_BUFFER_SIZE = 512;
const MAX_NUM_PREV_BUFFERS = Math.ceil(SPEECH_PAD_SAMPLES / NEW_BUFFER_SIZE);

const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function supportsWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;
    await gpu.requestAdapter();
    return true;
  } catch {
    return false;
  }
}

const device = (await supportsWebGPU()) ? "webgpu" : "wasm";
ctx.postMessage({ type: "info", message: `Using device: "${device}"` });

const silero_vad = await AutoModel.from_pretrained("onnx-community/silero-vad", {
  config: { model_type: "custom" } as unknown as PretrainedConfig,
  dtype: "fp32",
}).catch((error: unknown) => {
  ctx.postMessage({ error });
  throw error;
});

const DEVICE_DTYPE_CONFIGS = {
  webgpu: { encoder_model: "fp32", decoder_model_merged: "q4" },
  wasm: { encoder_model: "fp32", decoder_model_merged: "q8" },
} as const;
const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/moonshine-base-ONNX",
  { device, dtype: DEVICE_DTYPE_CONFIGS[device] },
).catch((error: unknown) => {
  ctx.postMessage({ error });
  throw error;
});

await transcriber(new Float32Array(SAMPLE_RATE)); // compile shaders / warm up
ctx.postMessage({ type: "status", status: "ready", message: "Ready!" });

// Transformers.js can't run simultaneous inference, so chain the promises.
let inferenceChain: Promise<unknown> = Promise.resolve();

const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE);
let bufferPointer = 0;

const sr = new Tensor("int64", [SAMPLE_RATE], []);
let state = new Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);

let isRecording = false;

async function vad(buffer: Float32Array): Promise<boolean> {
  const input = new Tensor("float32", buffer, [1, buffer.length]);
  const { stateN, output } = (await (inferenceChain = inferenceChain.then(() =>
    silero_vad({ input, sr, state }),
  ))) as { stateN: Tensor; output: { data: Float32Array } };
  state = stateN;

  const isSpeech = output.data[0];
  return isSpeech > SPEECH_THRESHOLD || (isRecording && isSpeech >= EXIT_THRESHOLD);
}

async function transcribe(buffer: Float32Array, data: Record<string, unknown>) {
  const { text } = (await (inferenceChain = inferenceChain.then(() =>
    transcriber(buffer),
  ))) as { text: string };
  ctx.postMessage({ type: "output", message: text, ...data });
}

let postSpeechSamples = 0;
function reset(offset = 0) {
  ctx.postMessage({ type: "status", status: "recording_end", message: "Transcribing..." });
  BUFFER.fill(0, offset);
  bufferPointer = offset;
  isRecording = false;
  postSpeechSamples = 0;
}

let prevBuffers: Float32Array[] = [];
function dispatchForTranscriptionAndResetAudioBuffer(overflow?: Float32Array) {
  const now = Date.now();
  const end = now - ((postSpeechSamples + SPEECH_PAD_SAMPLES) / SAMPLE_RATE) * 1000;
  const start = end - (bufferPointer / SAMPLE_RATE) * 1000;
  const duration = end - start;
  const overflowLength = overflow?.length ?? 0;

  const buffer = BUFFER.slice(0, bufferPointer + SPEECH_PAD_SAMPLES);
  const prevLength = prevBuffers.reduce((acc, b) => acc + b.length, 0);
  const paddedBuffer = new Float32Array(prevLength + buffer.length);
  let offset = 0;
  for (const prev of prevBuffers) {
    paddedBuffer.set(prev, offset);
    offset += prev.length;
  }
  paddedBuffer.set(buffer, offset);
  void transcribe(paddedBuffer, { start, end, duration });

  if (overflow) BUFFER.set(overflow, 0);
  reset(overflowLength);
}

ctx.onmessage = async (event: MessageEvent) => {
  const { buffer } = event.data as { buffer: Float32Array };

  const wasRecording = isRecording;
  const isSpeech = await vad(buffer);

  if (!wasRecording && !isSpeech) {
    if (prevBuffers.length >= MAX_NUM_PREV_BUFFERS) prevBuffers.shift();
    prevBuffers.push(buffer);
    return;
  }

  const remaining = BUFFER.length - bufferPointer;
  if (buffer.length >= remaining) {
    BUFFER.set(buffer.subarray(0, remaining), bufferPointer);
    bufferPointer += remaining;
    dispatchForTranscriptionAndResetAudioBuffer(buffer.subarray(remaining));
    return;
  } else {
    BUFFER.set(buffer, bufferPointer);
    bufferPointer += buffer.length;
  }

  if (isSpeech) {
    if (!isRecording) {
      ctx.postMessage({ type: "status", status: "recording_start", message: "Listening..." });
    }
    isRecording = true;
    postSpeechSamples = 0;
    return;
  }

  postSpeechSamples += buffer.length;
  if (postSpeechSamples < MIN_SILENCE_DURATION_SAMPLES) return;
  if (bufferPointer < MIN_SPEECH_DURATION_SAMPLES) {
    reset();
    return;
  }
  dispatchForTranscriptionAndResetAudioBuffer();
};
