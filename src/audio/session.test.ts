import { createRoot, flush } from "solid-js";
import { expect, test } from "vitest";
import { createAudioSession } from "./session";

test("does not start audio on create", () => {
  createRoot((dispose) => {
    const audio = createAudioSession();
    flush();
    expect(audio.power()).toBe(false);
    expect(audio.mic()).toBe(false);
    expect(audio.pitch()).toEqual({ hz: 0, clarity: 0, rms: 0 });
    expect(audio.error()).toBe(null);
    expect(audio.rate()).toBe(0);
    dispose();
  });
});

type FakeTrack = { stop: () => void; stopped: boolean };
type FakeStream = { getTracks: () => FakeTrack[] };
type FakeSource = { disconnect: () => void; disconnected: boolean; connect: () => void };

function track(): FakeTrack {
  const t = { stopped: false, stop() { t.stopped = true; } };
  return t;
}

function stream(): FakeStream {
  const tracks = [track()];
  return { getTracks: () => tracks };
}

async function drain() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

function installAudio(streams: FakeStream[], sources: FakeSource[], hold?: Promise<void>) {
  const prev = {
    AudioContext: globalThis.AudioContext,
    AudioWorkletNode: globalThis.AudioWorkletNode,
    fetch: globalThis.fetch,
    document: globalThis.document,
    window: globalThis.window,
    location: globalThis.location,
    mediaDevices: globalThis.navigator?.mediaDevices,
  };
  const doc = new EventTarget();
  let hidden = false;
  Object.defineProperty(doc, "visibilityState", { get: () => (hidden ? "hidden" : "visible") });
  Object.defineProperty(doc, "hidden", { get: () => hidden });
  Object.assign(doc, {
    hide() {
      hidden = true;
      doc.dispatchEvent(new Event("visibilitychange"));
    },
    show() {
      hidden = false;
      doc.dispatchEvent(new Event("visibilitychange"));
    },
  });
  globalThis.document = doc as unknown as Document;
  globalThis.window = doc as unknown as Window & typeof globalThis;
  globalThis.location = { search: "" } as Location;
  globalThis.fetch = (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;
  globalThis.AudioContext = class {
    state = "running";
    sampleRate = 48000;
    destination = {};
    audioWorklet = { addModule: async () => {} };
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createMediaStreamSource() {
      const source: FakeSource = {
        disconnected: false,
        disconnect() {
          source.disconnected = true;
        },
        connect() {},
      };
      sources.push(source);
      return source;
    }
    createGain() {
      return { gain: { value: 0 }, connect() {}, disconnect() {} };
    }
  } as unknown as typeof AudioContext;
  globalThis.AudioWorkletNode = class {
    port = { onmessage: null as ((event: MessageEvent) => void) | null };
    connect() {}
    disconnect() {}
  } as unknown as typeof AudioWorkletNode;
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => {
        if (hold) await hold;
        const next = stream();
        streams.push(next);
        return next;
      },
    },
  });
  return {
    doc: doc as EventTarget & { hide: () => void; show: () => void },
    restore() {
      globalThis.AudioContext = prev.AudioContext;
      globalThis.AudioWorkletNode = prev.AudioWorkletNode;
      globalThis.fetch = prev.fetch;
      globalThis.document = prev.document;
      globalThis.window = prev.window;
      globalThis.location = prev.location;
      Object.defineProperty(globalThis.navigator, "mediaDevices", {
        configurable: true,
        value: prev.mediaDevices,
      });
    },
  };
}

test("hide stops the mic and show reopens it; power-off does not", async () => {
  const streams: FakeStream[] = [];
  const sources: FakeSource[] = [];
  const env = installAudio(streams, sources);
  const dispose = createRoot((done) => {
    const audio = createAudioSession();
    return Object.assign(done, { audio });
  }) as (() => void) & { audio: ReturnType<typeof createAudioSession> };
  try {
    await dispose.audio.start();
    flush();
    expect(dispose.audio.power()).toBe(true);
    expect(dispose.audio.mic()).toBe(true);
    expect(streams).toHaveLength(1);

    env.doc.hide();
    flush();
    expect(dispose.audio.power()).toBe(true);
    expect(dispose.audio.mic()).toBe(false);
    expect(dispose.audio.pitch()).toEqual({ hz: 0, clarity: 0, rms: 0 });
    expect(streams[0].getTracks()[0].stopped).toBe(true);
    expect(sources[0].disconnected).toBe(true);

    env.doc.show();
    await drain();
    flush();
    expect(dispose.audio.error()).toBe(null);
    expect(streams).toHaveLength(2);
    expect(streams[1].getTracks()[0].stopped).toBe(false);
    expect(dispose.audio.mic()).toBe(true);
    expect(dispose.audio.power()).toBe(true);

    env.doc.hide();
    flush();
    dispose.audio.stop();
    flush();
    env.doc.show();
    await drain();
    expect(streams).toHaveLength(2);
    expect(dispose.audio.power()).toBe(false);
    expect(dispose.audio.mic()).toBe(false);
  } finally {
    dispose();
    env.restore();
  }
});

test("hide during start stops the track and leaves power off", async () => {
  const streams: FakeStream[] = [];
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const env = installAudio(streams, [], hold);
  const dispose = createRoot((done) => {
    const audio = createAudioSession();
    return Object.assign(done, { audio });
  }) as (() => void) & { audio: ReturnType<typeof createAudioSession> };
  try {
    const pending = dispose.audio.start();
    env.doc.hide();
    release();
    await pending;
    flush();
    expect(dispose.audio.power()).toBe(false);
    expect(dispose.audio.mic()).toBe(false);
    expect(streams[0].getTracks()[0].stopped).toBe(true);
  } finally {
    dispose();
    env.restore();
  }
});

