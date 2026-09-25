import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../../tests/fakes/fake-audio-context';
import {
  ACCENT_Q_HOLD_S,
  KNOB_SMOOTHING_S,
  MIN_GAIN,
  STOP_RELEASE_TAU_S,
} from '../../model/constants';
import { DEFAULT_BASS, DEFAULT_STEP } from '../../model/defaults';
import { accentedQ, cutoffToHz, resonanceToQ } from '../../model/mapping';
import { midiToFrequency } from '../../model/pitch';
import { createBiquadFilterStage } from '../filter-stage';
import { createBassVoice } from './bass-voice';

const plan = (time: number, step = DEFAULT_STEP) => ({
  step,
  params: DEFAULT_BASS,
  time,
  stepDuration: 0.125,
});

function setup() {
  const ctx = new FakeAudioContext();
  const output = ctx.createGain();
  const filter = createBiquadFilterStage(ctx.asContext());
  const voice = createBassVoice(
    ctx.asContext(),
    filter,
    output as unknown as AudioNode,
    DEFAULT_BASS,
  );
  return { ctx, output, voice, filter: ctx.filters[0], oscillator: ctx.oscillators[0] };
}

describe('createBassVoice', () => {
  it('démarre un oscillateur persistant câblé osc → filtre → VCA → drive → sortie', () => {
    const { ctx, output, oscillator, filter } = setup();
    expect(ctx.oscillators).toHaveLength(1);
    expect(oscillator?.startedAt).toBe(0);
    expect(oscillator?.connections).toContain(filter);
    expect(filter?.type).toBe('lowpass');
    expect(filter?.frequency.value).toBeCloseTo(cutoffToHz(DEFAULT_BASS.cutoff), 6);
    const post = ctx.gains.at(-1);
    expect(post?.connections).toContain(output);
  });

  it('cent déclenchements n’allouent aucune nouvelle source', () => {
    const { ctx, voice, oscillator } = setup();
    for (let i = 0; i < 100; i += 1) voice.trigger(plan(i * 0.125));
    expect(ctx.oscillators).toHaveLength(1);
    expect(oscillator?.frequency.calls.filter((c) => c.method === 'setValueAtTime')).toHaveLength(
      100,
    );
  });

  it('applique le plan sur les bons paramètres, sans programmer dans le passé', () => {
    const { ctx, voice, oscillator, filter } = setup();
    ctx.currentTime = 5;
    voice.trigger(plan(4.9));
    const vca = ctx.gains.find((g) => g.gain.calls.some((c) => c.value === 1));

    expect(oscillator?.frequency.calls.at(-1)?.time).toBeGreaterThan(5);
    expect(filter?.detune.calls.some((c) => c.method === 'setTargetAtTime' && c.value === 0)).toBe(
      true,
    );
    expect(vca?.gain.calls.some((c) => c.method === 'setTargetAtTime' && c.value === 1)).toBe(true);
  });

  it('les knobs écrivent en lissé et changent la forme d’onde à chaud', () => {
    const { voice, oscillator, filter } = setup();
    voice.applyParams({ ...DEFAULT_BASS, waveform: 'square', cutoff: 1, resonance: 1, tuning: 1 });
    expect(oscillator?.type).toBe('square');
    expect(filter?.frequency.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime' });
    expect(filter?.Q.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime' });
    expect(oscillator?.detune.calls.at(-1)).toMatchObject({
      method: 'setTargetAtTime',
      value: 1200,
    });
  });

  it('release annule le futur et referme le VCA sans clic', () => {
    const { ctx, voice, oscillator } = setup();
    voice.trigger(plan(1));
    voice.release(1.05);
    expect(oscillator?.frequency.calls.at(-1)).toMatchObject({
      method: 'cancelScheduledValues',
      time: 1.05,
    });
    const vca = ctx.gains.find((g) => g.gain.calls.some((c) => c.value === 1));
    expect(vca?.gain.calls.at(-1)).toMatchObject({
      method: 'setTargetAtTime',
      value: MIN_GAIN,
      time: 1.05,
      timeConstant: STOP_RELEASE_TAU_S,
    });
    expect(ctx.oscillators[0]?.stoppedAt).toBeNull();
  });

  it('mappe la cible filterQ sur le Q du filtre', () => {
    const { voice, filter } = setup();
    voice.trigger(plan(1, { ...DEFAULT_STEP, accent: true }));
    expect(filter?.Q.calls).toContainEqual(
      expect.objectContaining({
        method: 'setTargetAtTime',
        time: 1,
        value: accentedQ(DEFAULT_BASS.resonance, DEFAULT_BASS.accent),
      }),
    );
  });

  it('le pas qui suit un slide glisse vers sa note sans rouvrir le VCA', () => {
    const { ctx, voice, oscillator } = setup();
    voice.trigger(plan(1, { ...DEFAULT_STEP, slide: true }));
    const vca = ctx.gains.find((g) => g.gain.calls.some((c) => c.value === 1));
    const vcaCalls = vca?.gain.calls.length;

    voice.trigger(plan(1.125, { ...DEFAULT_STEP, note: 7 }));
    expect(oscillator?.frequency.calls.at(-1)).toMatchObject({
      method: 'setTargetAtTime',
      time: 1.125,
      value: midiToFrequency(43),
    });
    expect(vca?.gain.calls.slice(vcaCalls ?? 0).some((c) => c.value === 1)).toBe(false);
  });

  it('après un stop, le pas qui suit un slide rejoue la note au lieu de glisser dans le silence', () => {
    const { ctx, voice, oscillator } = setup();
    voice.trigger(plan(1, { ...DEFAULT_STEP, slide: true }));
    voice.release(1.05);

    voice.trigger(plan(2, { ...DEFAULT_STEP, note: 7 }));
    expect(oscillator?.frequency.calls.at(-1)).toMatchObject({
      method: 'setValueAtTime',
      time: 2,
      value: midiToFrequency(43),
    });
    const vca = ctx.gains.find((g) => g.gain.calls.some((c) => c.value === 1));
    expect(vca?.gain.calls).toContainEqual(
      expect.objectContaining({ method: 'setTargetAtTime', time: 2, value: 1 }),
    );
  });

  it('un silence entre le slide et le pas suivant ne coupe pas la liaison', () => {
    const { voice, oscillator } = setup();
    voice.trigger(plan(1, { ...DEFAULT_STEP, slide: true }));
    voice.trigger(plan(1.125, { ...DEFAULT_STEP, rest: true }));
    voice.trigger(plan(1.25, { ...DEFAULT_STEP, note: 7 }));
    expect(oscillator?.frequency.calls.at(-1)).toMatchObject({
      method: 'setTargetAtTime',
      time: 1.25,
      value: midiToFrequency(43),
    });
  });

  it('un geste de résonance fait avant un accent programmé l’emporte après l’accent', () => {
    const { ctx, voice, filter } = setup();
    ctx.currentTime = 0.9;
    voice.trigger(plan(1, { ...DEFAULT_STEP, accent: true }));
    voice.applyParams({ ...DEFAULT_BASS, resonance: 1 });

    const returns = filter?.Q.calls.filter((c) => c.time === 1 + ACCENT_Q_HOLD_S) ?? [];
    expect(returns.map((c) => c.value)).toEqual([
      resonanceToQ(DEFAULT_BASS.resonance),
      resonanceToQ(1),
    ]);
  });

  it('un geste de résonance sans accent à venir n’écrit que la valeur lissée', () => {
    const { ctx, voice, filter } = setup();
    voice.trigger(plan(1, { ...DEFAULT_STEP, accent: true }));
    ctx.currentTime = 2;
    const before = filter?.Q.calls.length ?? 0;
    voice.applyParams({ ...DEFAULT_BASS, resonance: 1 });
    expect(filter?.Q.calls.slice(before)).toEqual([
      {
        method: 'setTargetAtTime',
        time: 2,
        value: resonanceToQ(1),
        timeConstant: KNOB_SMOOTHING_S,
      },
    ]);
  });

  it('un stop pendant un accent ramène la résonance au knob', () => {
    const { ctx, voice, filter } = setup();
    voice.trigger(plan(1, { ...DEFAULT_STEP, accent: true }));
    ctx.currentTime = 1.004;
    voice.release(1.005);
    expect(filter?.Q.calls.at(-1)).toMatchObject({
      method: 'setTargetAtTime',
      time: 1.005,
      value: resonanceToQ(DEFAULT_BASS.resonance),
    });
  });

  it('dispose arrête l’oscillateur', () => {
    const { voice, oscillator } = setup();
    voice.dispose();
    expect(oscillator?.stoppedAt).not.toBeNull();
  });
});
