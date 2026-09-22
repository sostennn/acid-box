/**
 * Faux AudioContext pour les tests en node : enregistre les nœuds créés et
 * les automations demandées, sans produire de son.
 */
import type { AudioContextLike } from '@engine/audio/context';

export interface ParamCall {
  readonly method: string;
  readonly value: number;
  readonly time: number;
}

export class FakeAudioParam {
  readonly calls: ParamCall[] = [];
  value = 0;

  setValueAtTime(value: number, time: number) {
    this.calls.push({ method: 'setValueAtTime', value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    if (value <= 0) throw new RangeError('exponential ramp to non-positive value');
    this.calls.push({ method: 'exponentialRampToValueAtTime', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push({ method: 'linearRampToValueAtTime', value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number) {
    this.calls.push({ method: 'setTargetAtTime', value, time });
    return this;
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  private readonly listeners = new Map<string, Set<() => void>>();

  connect(target: unknown) {
    this.connections.push(target);
    return target;
  }

  disconnect() {
    this.connections.length = 0;
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener());
  }
}

export class FakeSourceNode extends FakeNode {
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  start(when = 0) {
    if (this.startedAt !== null) throw new Error('source already started');
    this.startedAt = when;
  }

  stop(when = 0) {
    this.stoppedAt = when;
  }
}

export class FakeOscillatorNode extends FakeSourceNode {
  type = 'sine';
  readonly frequency = new FakeAudioParam();
  readonly detune = new FakeAudioParam();
}

export class FakeBufferSourceNode extends FakeSourceNode {
  buffer: unknown = null;
}

export class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

export class FakeAudioContext extends FakeNode {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly sampleRate: number;
  readonly destination = new FakeNode();
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly bufferSources: FakeBufferSourceNode[] = [];
  readonly gains: FakeGainNode[] = [];
  resumeCount = 0;
  closed = false;

  constructor(sampleRate = 48000) {
    super();
    this.sampleRate = sampleRate;
  }

  async resume() {
    this.resumeCount += 1;
    this.setState('running');
  }

  async close() {
    this.closed = true;
    this.setState('closed');
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return { channels, length, sampleRate };
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode();
    this.bufferSources.push(node);
    return node;
  }

  createOscillator() {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createGain() {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  /** Simule un changement d'état imposé par le système (ex. `interrupted` sur iOS). */
  setState(state: AudioContextState | 'interrupted') {
    this.state = state as AudioContextState;
    this.emit('statechange');
  }

  asContext(): AudioContextLike {
    return this as unknown as AudioContextLike;
  }
}

export interface FakeVisibility {
  isVisible(): boolean;
  onChange(listener: () => void): () => void;
  /** Simule un passage caché / visible. */
  set(visible: boolean): void;
}

export function createFakeVisibility(): FakeVisibility {
  let visible = true;
  const listeners = new Set<() => void>();
  return {
    isVisible: () => visible,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      visible = next;
      listeners.forEach((listener) => listener());
    },
  };
}
