import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../../tests/fakes/fake-audio-context';
import {
  CLAP_BURST_COUNT,
  CLOSED_HAT_DECAY_TAU_S,
  DRUM_CUT_TAU_S,
  DRUM_TAIL_TAUS,
  KICK_DECAY_TAU_S,
  KICK_PITCH_END_HZ,
  KICK_PITCH_START_HZ,
  KNOB_SMOOTHING_S,
  NOISE_BUFFER_S,
  OPEN_HAT_DECAY_TAU_S,
  SCHEDULE_EPSILON_S,
} from '../../model/constants';
import { DEFAULT_DRUMS, mutesOf } from '../../model/defaults';
import { levelToGain } from '../../model/mapping';
import { DRUM_VOICES, type DrumMutes, type DrumVoiceId } from '../../model/types';
import { createDrumKit, type DrumTrigger } from './drum-kit';

const UNMUTED = mutesOf(DEFAULT_DRUMS);

function setup(mutes: DrumMutes = UNMUTED) {
  const ctx = new FakeAudioContext();
  const output = ctx.createGain();
  const kit = createDrumKit(ctx.asContext(), output as unknown as AudioNode, DEFAULT_DRUMS, mutes);
  // Chaque tranche : niveau → mute → sortie, créées dans l'ordre de DRUM_VOICES.
  const [, kick, kickMute, clap, clapMute, closedHat, closedHatMute, openHat, openHatMute] =
    ctx.gains;
  return {
    ctx,
    output,
    kit,
    channels: { kick, clap, closedHat, openHat },
    muteGains: { kick: kickMute, clap: clapMute, closedHat: closedHatMute, openHat: openHatMute },
  };
}

const hit = (voice: DrumVoiceId, time: number, patch: Partial<DrumTrigger> = {}): DrumTrigger => ({
  voice,
  velocity: 1,
  muted: false,
  time,
  ...patch,
});

describe('createDrumKit', () => {
  it('une tranche par voix : niveau initial, puis mute initial, vers la sortie', () => {
    const { output, channels, muteGains } = setup({ ...UNMUTED, clap: true });
    for (const voice of DRUM_VOICES) {
      expect(channels[voice]?.connections).toEqual([muteGains[voice]]);
      expect(muteGains[voice]?.connections).toEqual([output]);
      expect(channels[voice]?.gain.value).toBe(levelToGain(DEFAULT_DRUMS[voice].level));
      expect(muteGains[voice]?.gain.value).toBe(voice === 'clap' ? 0 : 1);
    }
  });

  it('génère le bruit une seule fois, à la fréquence du contexte', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('clap', 1));
    kit.trigger(hit('closedHat', 2));
    expect(ctx.buffers).toHaveLength(1);
    const data = ctx.buffers[0]?.getChannelData(0) ?? new Float32Array();
    expect(data).toHaveLength(ctx.sampleRate * NOISE_BUFFER_S);
    expect(data.every((sample) => sample >= -1 && sample <= 1)).toBe(true);
    expect(data.some((sample) => sample !== 0)).toBe(true);
    expect(ctx.bufferSources.every((source) => source.buffer === ctx.buffers[0])).toBe(true);
    expect(ctx.bufferSources.every((source) => source.loop)).toBe(true);
  });

  it('kick : un oscillateur neuf par frappe, démarré au pas et arrêté en fin de queue', () => {
    const { ctx, kit, channels } = setup();
    kit.trigger(hit('kick', 1));
    kit.trigger(hit('kick', 1.5));
    expect(ctx.oscillators).toHaveLength(2);
    const [first] = ctx.oscillators;
    expect(first?.startedAt).toBe(1);
    expect(first?.stoppedAt).toBeCloseTo(1 + DRUM_TAIL_TAUS * KICK_DECAY_TAU_S, 10);
    expect(first?.frequency.calls).toEqual([
      { method: 'setValueAtTime', value: KICK_PITCH_START_HZ, time: 1 },
      expect.objectContaining({ method: 'setTargetAtTime', value: KICK_PITCH_END_HZ, time: 1 }),
    ]);
    const vca = ctx.gains.find((gain) => first?.connections.includes(gain));
    expect(vca?.connections).toEqual([channels.kick]);
    expect(vca?.gain.calls).toEqual([
      { method: 'setValueAtTime', value: 1, time: 1 },
      { method: 'setTargetAtTime', value: 0, time: 1, timeConstant: KICK_DECAY_TAU_S },
    ]);
  });

  it('clap : une bouffée par rafale, la dernière porte la queue', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('clap', 1));
    const vca = ctx.gains.at(-1);
    const peaks = vca?.gain.calls.filter((call) => call.method === 'setValueAtTime');
    expect(peaks).toHaveLength(CLAP_BURST_COUNT);
    expect(ctx.filters[0]?.type).toBe('bandpass');
  });

  it('la vélocité dose le pic et raccourcit la queue', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('closedHat', 1, { velocity: 0.5 }));
    const calls = ctx.gains.at(-1)?.gain.calls ?? [];
    expect(calls[0]?.value).toBe(levelToGain(0.5));
    expect(calls[1]?.timeConstant).toBeLessThan(CLOSED_HAT_DECAY_TAU_S);
    expect(ctx.filters[0]?.type).toBe('highpass');
  });

  it('un pas inactif ou une voix mutée ne crée aucun nœud', () => {
    const { ctx, kit } = setup();
    const gains = ctx.gains.length;
    kit.trigger(hit('kick', 1, { velocity: 0 }));
    kit.trigger(hit('clap', 1, { muted: true }));
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.bufferSources).toHaveLength(0);
    expect(ctx.gains).toHaveLength(gains);
  });

  it('une frappe dans le passé part juste après currentTime', () => {
    const { ctx, kit } = setup();
    ctx.currentTime = 5;
    kit.trigger(hit('kick', 4.9));
    expect(ctx.oscillators[0]?.startedAt).toBe(5 + SCHEDULE_EPSILON_S);
  });

  it('à `ended`, la frappe débranche ses nœuds et n’est plus suivie', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('openHat', 1));
    const source = ctx.bufferSources[0];
    const nodes = [source, ctx.filters[0], ctx.gains.at(-1)];
    const stoppedAt = source?.stoppedAt;
    source?.end();
    expect(nodes.every((node) => node?.connections.length === 0)).toBe(true);

    kit.trigger(hit('closedHat', 1.1));
    kit.release(1.2);
    expect(source?.stoppedAt).toBe(stoppedAt);
  });

  it('le hat fermé étouffe le hat ouvert qui sonne, sans clic', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('openHat', 1));
    const open = ctx.bufferSources[0];
    const openVca = ctx.gains.at(-1);
    expect(open?.stoppedAt).toBeCloseTo(1 + DRUM_TAIL_TAUS * OPEN_HAT_DECAY_TAU_S, 10);

    kit.trigger(hit('kick', 1.05));
    expect(open?.stoppedAt).toBeCloseTo(1 + DRUM_TAIL_TAUS * OPEN_HAT_DECAY_TAU_S, 10);

    kit.trigger(hit('closedHat', 1.1));
    expect(openVca?.gain.calls.slice(-2)).toEqual([
      { method: 'cancelScheduledValues', time: 1.1 },
      { method: 'setTargetAtTime', value: 0, time: 1.1, timeConstant: DRUM_CUT_TAU_S },
    ]);
    expect(open?.stoppedAt).toBeCloseTo(1.1 + DRUM_TAIL_TAUS * DRUM_CUT_TAU_S, 10);
    expect(ctx.bufferSources[1]?.startedAt).toBe(1.1);
  });

  it('un nouveau hat ouvert étouffe le précédent', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('openHat', 1));
    kit.trigger(hit('openHat', 1.2));
    expect(ctx.bufferSources[0]?.stoppedAt).toBeCloseTo(1.2 + DRUM_TAIL_TAUS * DRUM_CUT_TAU_S, 10);
    expect(ctx.bufferSources[1]?.stoppedAt).toBeCloseTo(
      1.2 + DRUM_TAIL_TAUS * OPEN_HAT_DECAY_TAU_S,
      10,
    );
  });

  it('release coupe ce qui sonne et empêche de partir ce qui était programmé', () => {
    const { ctx, kit } = setup();
    kit.trigger(hit('kick', 1));
    kit.trigger(hit('clap', 1.08));
    ctx.currentTime = 1.05;
    kit.release(1.05);

    const kickVca = ctx.gains.find((gain) => ctx.oscillators[0]?.connections.includes(gain));
    expect(kickVca?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0 });
    const cutAt = 1.05 + SCHEDULE_EPSILON_S;
    expect(ctx.oscillators[0]?.stoppedAt).toBeCloseTo(cutAt + DRUM_TAIL_TAUS * DRUM_CUT_TAU_S, 10);
    // Arrêtée avant son départ, la source du clap ne sonnera pas.
    expect(ctx.bufferSources[0]?.stoppedAt).toBeLessThanOrEqual(1.08);
  });

  it('le niveau arrive lissé tout de suite, sans toucher au mute', () => {
    const { ctx, kit, channels, muteGains } = setup();
    ctx.currentTime = 2;
    kit.applyLevels({ ...DEFAULT_DRUMS, kick: { level: 0.5, muted: true } });
    expect(channels.kick?.gain.calls.at(-1)).toEqual({
      method: 'setTargetAtTime',
      value: levelToGain(0.5),
      time: 2,
      timeConstant: KNOB_SMOOTHING_S,
    });
    expect(muteGains.kick?.gain.calls).toEqual([]);
  });

  it('un mute est programmé au temps donné et coupe les queues sans clic', () => {
    const { kit, muteGains } = setup();
    kit.applyMutes({ ...UNMUTED, openHat: true }, 3);
    expect(muteGains.openHat?.gain.calls).toEqual([
      { method: 'cancelScheduledValues', time: 3 },
      { method: 'setTargetAtTime', value: 0, time: 3, timeConstant: DRUM_CUT_TAU_S },
    ]);
    expect(muteGains.kick?.gain.calls).toEqual([]);
  });

  it('un démute rouvre d’un coup au temps donné, pour garder l’attaque du temps', () => {
    const { kit, muteGains } = setup({ ...UNMUTED, kick: true });
    kit.applyMutes(UNMUTED, 3);
    expect(muteGains.kick?.gain.calls).toEqual([
      { method: 'cancelScheduledValues', time: 3 },
      { method: 'setValueAtTime', value: 1, time: 3 },
    ]);
    kit.applyMutes(UNMUTED, 4);
    expect(muteGains.kick?.gain.calls).toHaveLength(2);
  });

  it('dispose débranche les tranches', () => {
    const { kit, channels, muteGains } = setup();
    kit.dispose();
    const nodes = [...Object.values(channels), ...Object.values(muteGains)];
    expect(nodes.every((node) => node?.connections.length === 0)).toBe(true);
  });
});
