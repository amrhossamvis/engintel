import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSpeechInput } from "./use-speech-input";

interface MutableNav {
  mediaDevices?: { getUserMedia: ReturnType<typeof vi.fn> };
}
const nav = navigator as unknown as MutableNav;
const win = window as unknown as { AudioContext?: unknown; Worker?: unknown };

function setMediaDevices(getUserMedia: ReturnType<typeof vi.fn> | null) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
}

describe("useSpeechInput", () => {
  beforeEach(() => {
    win.AudioContext = class {};
    win.Worker = class {
      onmessage: unknown = null;
      onerror: unknown = null;
      postMessage() {}
      terminate() {}
    };
    setMediaDevices(vi.fn());
  });
  afterEach(() => {
    delete win.AudioContext;
    delete win.Worker;
    setMediaDevices(null);
    vi.clearAllMocks();
  });

  it("reports supported when browser APIs are present", async () => {
    const { result } = renderHook(() => useSpeechInput({ onFinal: () => {} }));
    await waitFor(() => expect(result.current.supported).toBe(true));
  });

  it("reports unsupported when Worker is missing", async () => {
    delete win.Worker;
    const { result } = renderHook(() => useSpeechInput({ onFinal: () => {} }));
    await act(async () => {});
    expect(result.current.supported).toBe(false);
  });

  it("reports unsupported when getUserMedia is missing", async () => {
    setMediaDevices(null);
    const { result } = renderHook(() => useSpeechInput({ onFinal: () => {} }));
    await act(async () => {});
    expect(result.current.supported).toBe(false);
  });

  it("flags micDenied when microphone access is refused", async () => {
    nav.mediaDevices!.getUserMedia.mockRejectedValue(new Error("NotAllowedError"));
    const { result } = renderHook(() => useSpeechInput({ onFinal: () => {} }));
    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r));
    });
    expect(result.current.micDenied).toBe(true);
    expect(result.current.listening).toBe(false);
  });
});
