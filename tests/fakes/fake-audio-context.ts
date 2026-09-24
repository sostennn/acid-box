/**
 * Faux AudioContext pour les tests en node : enregistre les nœuds créés et
 * les automations demandées, sans produire de son.
 */
import type { AudioContextLike } from '@engine/audio/context';

export interface ParamCall {
  readonly method: string;
  /** Absente pour `cancelScheduledValues`. */
  readonly value?: number;
  readonly time: number;
  /** Présente pour `setTargetAtTime`. */
  readonly timeConstant?: number;
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

  setTargetAtTime(value: number, time: number, timeConstant: number) {
    this.calls.push({ method: 'setTargetAtTime', value, time, timeConstant });
    return this;
  }

  cancelScheduledValues(time: number) {
    this.calls.push({ method: 'cancelScheduledValues', time });
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

  /** Le dernier appel l'emporte, comme dans Web Audio. */
  stop(when = 0) {
    this.stoppedAt = when;
  }

  /** Simule la fin de lecture, que Web Audio signale après `stop`. */
  end() {
    this.emit('ended');
  }
}

export class FakeOscillatorNode extends FakeSourceNode {
  type = 'sine';
  readonly frequency = new FakeAudioParam();
  readonly detune = new FakeAudioParam();
}

export class FakeBufferSourceNode extends FakeSourceNode {
  buffer: unknown = null;
  loop = false;
}

export class FakeAudioBuffer {
  private readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number) {
    const data = this.channels[channel];
    if (data === undefined) throw new RangeError(`no channel ${channel}`);
    return data;
  }
}

export class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam();
}

export class FakeBiquadFilterNode extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeAudioParam();
  readonly detune = new FakeAudioParam();
  readonly Q = new FakeAudioParam();
}

export class FakeWaveShaperNode extends FakeNode {
  curve: Float32Array | null = null;
  oversample = 'none';
}

export class FakeAudioContext extends FakeNode {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly sampleRate: number;
  readonly destination = new FakeNode();
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly bufferSources: FakeBufferSourceNode[] = [];
  readonly gains: FakeGainNode[] = [];
  readonly filters: FakeBiquadFilterNode[] = [];
  readonly shapers: FakeWaveShaperNode[] = [];
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

  readonly buffers: FakeAudioBuffer[] = [];

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeAudioBuffer(channels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
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

  createBiquadFilter() {
    const node = new FakeBiquadFilterNode();
    this.filters.push(node);
    return node;
  }

  createWaveShaper() {
    const node = new FakeWaveShaperNode();
    this.shapers.push(node);
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

/** Le VCA de la voix basse est le gain branché en sortie de son filtre. */
export function findVca(ctx: FakeAudioContext): FakeGainNode | undefined {
  return ctx.gains.find((gain) => ctx.filters[0]?.connections.includes(gain));
}
