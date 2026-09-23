import { describe, expect, it, vi } from 'vitest';
import { FakeAudioContext, createFakeVisibility } from '../../tests/fakes/fake-audio-context';
import { FakeTimer } from '../../tests/fakes/fake-clock';
import { createEngine } from './index';
import { BPM_DEFAULT, MIN_GAIN, START_DELAY_S } from './model/constants';
import { midiToFrequency, pitchToMidi } from './model/pitch';
import { stepDurationSeconds } from './clock/timing';

function setup() {
  const ctx = new FakeAudioContext();
  const timer = new FakeTimer();
  const engine = createEngine({
    createContext: () => ctx.asContext(),
    visibility: createFakeVisibility(),
    timer,
  });
  return { ctx, timer, engine };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Le VCA est le gain branché en sortie du filtre de la voix basse. */
const findVca = (ctx: FakeAudioContext) =>
  ctx.gains.find((gain) => ctx.filters[0]?.connections.includes(gain));

describe('createEngine', () => {
  it('expose l’état audio et notifie les abonnés', async () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(engine.getState().audio.availability).toBe('locked');

    await engine.unlock();
    expect(engine.getState().audio.availability).toBe('running');
    expect(listener).toHaveBeenCalledWith(engine.getState());
  });

  it('publie des snapshots immuables distincts', async () => {
    const { engine } = setup();
    const before = engine.getState();
    await engine.unlock();
    expect(engine.getState()).not.toBe(before);
    expect(before.audio.availability).toBe('locked');
  });

  it('applique les commandes de transport via le reducer', () => {
    const { engine } = setup();
    engine.dispatch({ type: 'transport/setBpm', bpm: 140 });
    engine.dispatch({ type: 'transport/setShuffle', value: 0.25 });
    expect(engine.getState().transport).toMatchObject({ bpm: 140, shuffle: 0.25 });
  });

  it('play débloque l’audio, crée la voix et programme le premier pas du pattern', async () => {
    const { engine, ctx, timer } = setup();
    ctx.currentTime = 3;
    engine.dispatch({ type: 'transport/play' });
    await flush();

    expect(engine.getState().transport.status).toBe('playing');
    expect(ctx.state).toBe('running');
    expect(timer.running).toBe(true);
    expect(ctx.oscillators).toHaveLength(1);

    const firstStep = engine.getState().pattern.bass[0];
    const set = ctx.oscillators[0]?.frequency.calls.find((c) => c.method === 'setValueAtTime');
    expect(set?.time).toBeCloseTo(3 + START_DELAY_S, 10);
    expect(set?.value).toBeCloseTo(midiToFrequency(pitchToMidi(firstStep)), 6);
  });

  it('route la voix par le bus basse puis le master', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    const [master, bass] = ctx.gains;
    expect(master?.connections).toContain(ctx.destination);
    expect(bass?.connections).toContain(master);
    expect(ctx.gains.some((g) => g.connections.includes(bass))).toBe(true);
  });

  it('audibleStep suit le temps audio, latence de sortie comprise', async () => {
    const { engine, ctx, timer } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    expect(engine.audibleStep()).toBeNull();

    ctx.currentTime = START_DELAY_S;
    expect(engine.audibleStep()).toBe(0);

    ctx.currentTime = 0.16;
    timer.tick();
    expect(engine.audibleStep()).toBe(0);
    ctx.currentTime = 0.18;
    expect(engine.audibleStep()).toBe(1);
  });

  it('stop arrête le scheduler, relâche la voix et vide la tête de lecture', async () => {
    const { engine, ctx, timer } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    ctx.currentTime = 1;
    engine.dispatch({ type: 'transport/stop' });

    expect(engine.getState().transport.status).toBe('stopped');
    expect(timer.running).toBe(false);
    expect(engine.audibleStep()).toBeNull();
    const vca = findVca(ctx);
    expect(vca?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: MIN_GAIN });
    expect(ctx.oscillators[0]?.stoppedAt).toBeNull();
  });

  it('les knobs de la basse atteignent la voix en lecture', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    engine.dispatch({ type: 'bass/setKnob', knob: 'cutoff', value: 1 });
    engine.dispatch({ type: 'bass/setWaveform', waveform: 'square' });
    expect(ctx.filters[0]?.frequency.calls.at(-1)?.method).toBe('setTargetAtTime');
    expect(ctx.oscillators[0]?.type).toBe('square');
  });

  it('les niveaux du mix sont lissés, jamais écrits en direct', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    engine.dispatch({ type: 'mix/set', patch: { masterLevel: 0.5, bassLevel: 1 } });
    const [master, bass] = ctx.gains;
    expect(master?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0.25 });
    expect(bass?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
  });

  it('un slide dans le pattern fait glisser la fréquence au pas suivant', async () => {
    const { engine, ctx, timer } = setup();
    engine.dispatch({ type: 'pattern/setStep', index: 0, patch: { slide: true, rest: false } });
    engine.dispatch({ type: 'pattern/setStep', index: 1, patch: { rest: false, note: 7 } });
    engine.dispatch({ type: 'transport/play' });
    await flush();
    ctx.currentTime = 0.1;
    timer.tick();
    const step1 = engine.getState().pattern.bass[1];
    const calls = ctx.oscillators[0]?.frequency.calls ?? [];
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'setTargetAtTime',
        time: START_DELAY_S + stepDurationSeconds(BPM_DEFAULT),
        value: step1 ? midiToFrequency(pitchToMidi(step1)) : NaN,
      }),
    );
  });

  it('un slide sur le pas 15 n’avale pas le premier pas au démarrage', async () => {
    const { engine, ctx, timer } = setup();
    engine.dispatch({ type: 'pattern/setStep', index: 0, patch: { accent: false } });
    engine.dispatch({ type: 'pattern/setStep', index: 15, patch: { slide: true, rest: false } });
    engine.dispatch({ type: 'transport/play' });
    await flush();

    const vca = findVca(ctx);
    expect(vca?.gain.calls[1]).toMatchObject({ method: 'setTargetAtTime', value: 1 });
    expect(vca?.gain.calls[1]?.time).toBeCloseTo(START_DELAY_S, 10);

    // Au deuxième tour, le pas 0 hérite bien de la note tenue par le pas 15.
    const loop = START_DELAY_S + 16 * stepDurationSeconds(BPM_DEFAULT);
    ctx.currentTime = loop - 0.05;
    timer.tick();
    const frequencyAtLoop = ctx.oscillators[0]?.frequency.calls.filter(
      (c) => Math.abs(c.time - loop) < 1e-9,
    );
    expect(frequencyAtLoop?.map((c) => c.method)).toEqual([
      'cancelScheduledValues',
      'setTargetAtTime',
    ]);
  });

  it('play est idempotent', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('dispose libère le timer et arrête l’oscillateur', async () => {
    const { engine, timer, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    engine.dispose();
    expect(timer.disposed).toBe(true);
    expect(ctx.oscillators[0]?.stoppedAt).not.toBeNull();
  });
});
