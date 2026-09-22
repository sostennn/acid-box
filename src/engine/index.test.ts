import { describe, expect, it, vi } from 'vitest';
import { FakeAudioContext, createFakeVisibility } from '../../tests/fakes/fake-audio-context';
import { FakeTimer } from '../../tests/fakes/fake-clock';
import { createEngine } from './index';
import { MIN_GAIN, START_DELAY_S } from './model/constants';

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

  it('play débloque l’audio, démarre le scheduler et programme le premier pas', async () => {
    const { engine, ctx, timer } = setup();
    ctx.currentTime = 3;
    engine.dispatch({ type: 'transport/play' });
    await flush();

    expect(engine.getState().transport.status).toBe('playing');
    expect(ctx.state).toBe('running');
    expect(timer.running).toBe(true);
    expect(ctx.oscillators[0]?.startedAt).toBeCloseTo(3 + START_DELAY_S, 10);
  });

  it('audibleStep suit le temps audio, latence de sortie comprise', async () => {
    const { engine, ctx, timer } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    expect(engine.audibleStep()).toBeNull();

    ctx.currentTime = START_DELAY_S;
    expect(engine.audibleStep()).toBe(0);

    // Pas 1 programmé à 0.05 + 0.12 s (125 BPM) : encore inaudible juste avant.
    ctx.currentTime = 0.16;
    timer.tick();
    expect(engine.audibleStep()).toBe(0);
    ctx.currentTime = 0.18;
    expect(engine.audibleStep()).toBe(1);
  });

  it('stop arrête le scheduler et vide la tête de lecture', async () => {
    const { engine, ctx, timer } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    ctx.currentTime = 1;
    engine.dispatch({ type: 'transport/stop' });

    expect(engine.getState().transport.status).toBe('stopped');
    expect(timer.running).toBe(false);
    expect(engine.audibleStep()).toBeNull();
  });

  it('play est idempotent', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    const count = ctx.oscillators.length;
    engine.dispatch({ type: 'transport/play' });
    await flush();
    expect(ctx.oscillators).toHaveLength(count);
  });

  it('ignore le son de test tant que l’audio est verrouillé', () => {
    const { engine, ctx } = setup();
    engine.playTestTone();
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('joue un son de test avec une source à usage unique et des rampes jamais nulles', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    ctx.currentTime = 2;
    engine.playTestTone();

    const [oscillator] = ctx.oscillators;
    const [master, vca] = ctx.gains;
    expect(oscillator?.startedAt).toBe(2);
    expect(oscillator?.stoppedAt).toBeGreaterThan(2);
    expect(oscillator?.connections).toContain(vca);
    expect(vca?.connections).toContain(master);
    expect(master?.connections).toContain(ctx.destination);

    const rampValues = vca?.gain.calls.map((call) => call.value) ?? [];
    expect(rampValues.length).toBeGreaterThan(0);
    expect(rampValues.every((value) => value >= MIN_GAIN)).toBe(true);
  });

  it('route le son par un bus master dont le niveau est lissé, jamais écrit en direct', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    const master = ctx.gains[0];
    expect(master?.connections).toContain(ctx.destination);
    expect(ctx.oscillators[0]?.connections[0]).not.toBe(ctx.destination);

    engine.dispatch({ type: 'mix/set', patch: { masterLevel: 0.5 } });
    expect(engine.getState().mix.masterLevel).toBe(0.5);
    const last = master?.gain.calls.at(-1);
    expect(last?.method).toBe('setTargetAtTime');
    expect(last?.value).toBeCloseTo(0.25, 10);
  });

  it('dispose libère le timer', () => {
    const { engine, timer } = setup();
    engine.dispose();
    expect(timer.disposed).toBe(true);
  });
});
