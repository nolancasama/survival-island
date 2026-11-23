import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recognition } from "./recognition";

type FakeEvent = { error: string };
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  maxAlternatives = 0;
  continuous = false;
  onstart: (() => void) | null = null;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: FakeEvent) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { FakeRecognition.instances.push(this); }
}

describe("speech recognizer startup lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    vi.stubGlobal("window", { setTimeout, clearTimeout, webkitSpeechRecognition: FakeRecognition });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("only reports listening when the browser confirms onstart", () => {
    const started = vi.fn();
    const ended = vi.fn();
    const stop = recognition.listen({ onStart: started, onResult: vi.fn(), onError: vi.fn(), onEnd: ended }, 7000);
    expect(started).not.toHaveBeenCalled();
    expect(FakeRecognition.instances[0].start).toHaveBeenCalledTimes(1);
    FakeRecognition.instances[0].onstart?.();
    expect(started).toHaveBeenCalledOnce();
    stop();
    expect(ended).toHaveBeenCalledOnce();
    FakeRecognition.instances[0].onend?.();
    expect(ended).toHaveBeenCalledOnce();
  });

  it("returns a recoverable start-failed error when start throws", () => {
    class BrokenRecognition extends FakeRecognition {
      start = vi.fn(() => { throw new Error("already started"); });
    }
    vi.stubGlobal("window", { setTimeout, clearTimeout, webkitSpeechRecognition: BrokenRecognition });
    const errors: string[] = [];
    const ended = vi.fn();
    recognition.listen({ onResult: vi.fn(), onError: e => errors.push(e), onEnd: ended });
    expect(errors).toEqual(["start-failed"]);
    expect(ended).toHaveBeenCalledOnce();
  });

  it("does not hang if the browser never starts recognition", () => {
    const errors: string[] = [];
    const ended = vi.fn();
    recognition.listen({ onResult: vi.fn(), onError: e => errors.push(e), onEnd: ended }, 7000);
    vi.advanceTimersByTime(3000);
    expect(errors).toEqual(["start-timeout"]);
    expect(FakeRecognition.instances[0].abort).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(350);
    expect(ended).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000);
    expect(ended).toHaveBeenCalledOnce();
  });

  it("ignores browser events from an aborted session", () => {
    const errors = vi.fn();
    const ended = vi.fn();
    const started = vi.fn();
    const stop = recognition.listen({ onStart: started, onResult: vi.fn(), onError: errors, onEnd: ended });
    const instance = FakeRecognition.instances[0];
    stop();
    instance.onstart?.();
    instance.onerror?.({ error: "no-speech" });
    instance.onend?.();
    expect(started).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(ended).toHaveBeenCalledOnce();
  });
});
