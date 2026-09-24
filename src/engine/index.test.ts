import { describe, expect, it, vi } from 'vitest';
import { FakeAudioContext, createFakeVisibility } from '../../tests/fakes/fake-audio-context';
import { FakeTimer } from '../../tests/fakes/fake-clock';
import { createEngine } from './index';
import { BPM_DEFAULT, MIN_GAIN, SIDECHAIN_MAX_DEPTH, START_DELAY_S } from './model/constants';
import { DEFAULT_TRANSPORT } from './model/defaults';
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

/** Les frappes arrêtent leur oscillateur dès sa création : seul celui de la basse est persistant. */
const persistentOscillators = (ctx: FakeAudioContext) =>
  ctx.oscillators.filter((oscillator) => oscillator.stoppedAt === null);

/** Départs des kicks : les seuls oscillateurs arrêtés dès leur création. */
const kickStarts = (ctx: FakeAudioContext) =>
  ctx.oscillators.flatMap((oscillator) =>
    oscillator.stoppedAt !== null && oscillator.startedAt !== null ? [oscillator.startedAt] : [],
  );

/** Gains de mute des tranches, branchés sur le bus rythmique, dans l'ordre des voix. */
const muteGains = (ctx: FakeAudioContext, drums = ctx.gains[3]) =>
  ctx.gains.filter((gain) => drums !== undefined && gain.connections.includes(drums));

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

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
    expect(persistentOscillators(ctx)).toHaveLength(1);

    const firstStep = engine.getState().pattern.bass[0];
    const set = ctx.oscillators[0]?.frequency.calls.find((c) => c.method === 'setValueAtTime');
    expect(set?.time).toBeCloseTo(3 + START_DELAY_S, 10);
    expect(set?.value).toBeCloseTo(midiToFrequency(pitchToMidi(firstStep)), 6);
  });

  it('route la voix par le bus basse, le sidechain puis le master', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    const [master, bass, sidechain] = ctx.gains;
    expect(master?.connections).toContain(ctx.destination);
    expect(bass?.connections).toEqual([sidechain]);
    expect(sidechain?.connections).toEqual([master]);
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

  it('le premier pas déclenche le kick du groove et fait plonger la basse', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();

    const kicks = ctx.oscillators.filter((oscillator) => oscillator.stoppedAt !== null);
    expect(kicks.map((kick) => kick.startedAt)).toEqual([START_DELAY_S]);
    const sidechain = ctx.gains[2];
    expect(sidechain?.gain.calls).toContainEqual(
      expect.objectContaining({
        method: 'setTargetAtTime',
        time: START_DELAY_S,
        value: 1 - DEFAULT_TRANSPORT.sidechain.amount * SIDECHAIN_MAX_DEPTH,
      }),
    );
  });

  it('un kick muté ne joue pas et ne fait pas plonger la basse', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'drums/setMuted', voice: 'kick', muted: true });
    engine.dispatch({ type: 'transport/play' });
    await flush();
    expect(ctx.oscillators.filter((oscillator) => oscillator.stoppedAt !== null)).toEqual([]);
    expect(ctx.gains[2]?.gain.calls).toEqual([]);
  });

  it('stop coupe les frappes programmées et remonte la basse', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    const kick = ctx.oscillators.find((oscillator) => oscillator.stoppedAt !== null);
    engine.dispatch({ type: 'transport/stop' });
    // Le kick n'avait pas encore démarré : arrêté avant son départ, il ne sonne pas.
    expect(kick?.stoppedAt).toBeLessThanOrEqual(START_DELAY_S);
    expect(ctx.gains[2]?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
  });

  it('niveau de voix, niveau rythmique et sidechain atteignent le graphe en lecture', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    const [, , sidechain, drums] = ctx.gains;
    const openHatMute = muteGains(ctx, drums).at(-1);
    const openHat = ctx.gains.find((gain) => openHatMute && gain.connections.includes(openHatMute));

    engine.dispatch({ type: 'drums/setLevel', voice: 'openHat', value: 1 });
    expect(openHat?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
    engine.dispatch({ type: 'mix/set', patch: { drumsLevel: 1 } });
    expect(drums?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
    engine.dispatch({ type: 'transport/setSidechain', patch: { enabled: false } });
    expect(sidechain?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
  });

  describe('mute quantifié à la mesure', () => {
    const step = stepDurationSeconds(BPM_DEFAULT);
    const nextBar = START_DELAY_S + 16 * step;

    async function playing() {
      const env = setup();
      env.engine.dispatch({ type: 'transport/play' });
      await flush();
      const scheduleUntil = (time: number) => {
        env.ctx.currentTime = time - 0.05;
        env.timer.tick();
      };
      return { ...env, scheduleUntil };
    }

    it('un mute en lecture ne s’entend qu’au début de la mesure suivante', async () => {
      const { engine, ctx, scheduleUntil } = await playing();
      engine.dispatch({ type: 'drums/setMuted', voice: 'kick', muted: true });
      expect(engine.getState().drums.kick.muted).toBe(true);
      expect(engine.getState().appliedMutes.kick).toBe(false);

      scheduleUntil(START_DELAY_S + 4 * step);
      expect(kickStarts(ctx).some((t) => near(t, START_DELAY_S + 4 * step))).toBe(true);
      expect(engine.getState().appliedMutes.kick).toBe(false);

      scheduleUntil(nextBar);
      expect(engine.getState().appliedMutes.kick).toBe(true);
      expect(kickStarts(ctx).some((t) => near(t, nextBar))).toBe(false);
      const kickMute = muteGains(ctx)[0];
      expect(kickMute?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0 });
      expect(near(kickMute?.gain.calls.at(-1)?.time ?? NaN, nextBar)).toBe(true);
      expect(ctx.gains[2]?.gain.calls.some((call) => near(call.time, nextBar))).toBe(false);
    });

    it('un démute en lecture rouvre sur le premier temps de la mesure suivante', async () => {
      const env = setup();
      env.engine.dispatch({ type: 'drums/setMuted', voice: 'kick', muted: true });
      expect(env.engine.getState().appliedMutes.kick).toBe(true);
      env.engine.dispatch({ type: 'transport/play' });
      await flush();
      env.engine.dispatch({ type: 'drums/setMuted', voice: 'kick', muted: false });

      env.ctx.currentTime = START_DELAY_S + 8 * step - 0.05;
      env.timer.tick();
      expect(kickStarts(env.ctx)).toEqual([]);

      env.ctx.currentTime = nextBar - 0.05;
      env.timer.tick();
      expect(kickStarts(env.ctx).some((t) => near(t, nextBar))).toBe(true);
      const kickMute = muteGains(env.ctx)[0];
      expect(kickMute?.gain.calls.at(-1)).toMatchObject({ method: 'setValueAtTime', value: 1 });
      expect(near(kickMute?.gain.calls.at(-1)?.time ?? NaN, nextBar)).toBe(true);
    });

    it('deux clics dans la même mesure s’annulent', async () => {
      const { engine, ctx, scheduleUntil } = await playing();
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.dispatch({ type: 'drums/setMuted', voice: 'kick', muted: true });
      engine.dispatch({ type: 'drums/setMuted', voice: 'kick', muted: false });
      listener.mockClear();

      scheduleUntil(nextBar);
      expect(listener).not.toHaveBeenCalled();
      expect(kickStarts(ctx).some((t) => near(t, nextBar))).toBe(true);
      expect(muteGains(ctx)[0]?.gain.calls).toEqual([]);
    });

    it('stop applique aussitôt un mute en attente', async () => {
      const { engine, ctx } = await playing();
      engine.dispatch({ type: 'drums/setMuted', voice: 'clap', muted: true });
      ctx.currentTime = 0.5;
      engine.dispatch({ type: 'transport/stop' });
      expect(engine.getState().appliedMutes.clap).toBe(true);
      expect(muteGains(ctx)[1]?.gain.calls.at(-1)).toMatchObject({
        method: 'setTargetAtTime',
        value: 0,
      });
    });
  });

  it('play est idempotent', async () => {
    const { engine, ctx } = setup();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    engine.dispatch({ type: 'transport/play' });
    await flush();
    expect(persistentOscillators(ctx)).toHaveLength(1);
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
