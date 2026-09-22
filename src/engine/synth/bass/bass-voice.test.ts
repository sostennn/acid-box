import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../../tests/fakes/fake-audio-context';
import { MIN_GAIN } from '../../model/constants';
import { DEFAULT_BASS, DEFAULT_STEP } from '../../model/defaults';
import { cutoffToHz } from '../../model/mapping';
import { createBiquadFilterStage } from '../filter-stage';
import { createBassVoice } from './bass-voice';

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
    for (let i = 0; i < 100; i += 1) voice.trigger(DEFAULT_STEP, i * 0.125, 0.125, DEFAULT_BASS);
    expect(ctx.oscillators).toHaveLength(1);
    expect(oscillator?.frequency.calls.filter((c) => c.method === 'setValueAtTime')).toHaveLength(
      100,
    );
  });

  it('applique le plan sur les bons paramètres, sans programmer dans le passé', () => {
    const { ctx, voice, oscillator, filter } = setup();
    ctx.currentTime = 5;
    voice.trigger({ ...DEFAULT_STEP, note: 0, octave: 0 }, 4.9, 0.125, DEFAULT_BASS);
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
    voice.trigger(DEFAULT_STEP, 1, 0.125, DEFAULT_BASS);
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
    });
    expect(ctx.oscillators[0]?.stoppedAt).toBeNull();
  });

  it('dispose arrête l’oscillateur', () => {
    const { voice, oscillator } = setup();
    voice.dispose();
    expect(oscillator?.stoppedAt).not.toBeNull();
  });
});
