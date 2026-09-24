import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../tests/fakes/fake-audio-context';
import { stepDurationSeconds } from '../clock/timing';
import {
  BPM_MAX,
  KNOB_SMOOTHING_S,
  SCHEDULE_EPSILON_S,
  SHUFFLE_MAX_RATIO,
  SIDECHAIN_ATTACK_S,
  SIDECHAIN_HOLD_S,
  SIDECHAIN_MAX_DEPTH,
  SIDECHAIN_RELEASE_S,
} from '../model/constants';
import { createSidechain, planDuck, type DuckInput } from './sidechain';

const duck = (patch: Partial<DuckInput> = {}): DuckInput => ({
  time: 1,
  kickVelocity: 1,
  kickMuted: false,
  params: { enabled: true, amount: 1 },
  ...patch,
});

describe('planDuck', () => {
  it('plonge au temps du kick puis remonte après le maintien', () => {
    expect(planDuck(duck())).toEqual([
      { kind: 'cancel', time: 1 },
      {
        kind: 'target',
        time: 1,
        value: 1 - SIDECHAIN_MAX_DEPTH,
        timeConstant: SIDECHAIN_ATTACK_S,
      },
      {
        kind: 'target',
        time: 1 + SIDECHAIN_HOLD_S,
        value: 1,
        timeConstant: SIDECHAIN_RELEASE_S,
      },
    ]);
  });

  it('la profondeur suit amount', () => {
    const floor = (amount: number) =>
      planDuck(duck({ params: { enabled: true, amount } })).find((e) => e.kind === 'target');
    expect(floor(0.5)).toMatchObject({ value: 1 - 0.5 * SIDECHAIN_MAX_DEPTH });
    expect(floor(2)).toMatchObject({ value: 1 - SIDECHAIN_MAX_DEPTH });
  });

  it('rien sans kick joué, kick muté, sidechain coupé ou amount nul', () => {
    expect(planDuck(duck({ kickVelocity: 0 }))).toEqual([]);
    expect(planDuck(duck({ kickMuted: true }))).toEqual([]);
    expect(planDuck(duck({ params: { enabled: false, amount: 1 } }))).toEqual([]);
    expect(planDuck(duck({ params: { enabled: true, amount: 0 } }))).toEqual([]);
  });

  it('la remontée tient dans le plus court créneau entre deux pas', () => {
    const shortestSlot = stepDurationSeconds(BPM_MAX) * (1 - SHUFFLE_MAX_RATIO);
    expect(SIDECHAIN_HOLD_S).toBeLessThan(shortestSlot);
  });
});

describe('createSidechain', () => {
  it('applique le plan au gain dédié', () => {
    const ctx = new FakeAudioContext();
    const sidechain = createSidechain(ctx.asContext());
    expect(sidechain.node).toBe(ctx.gains[0]);
    expect(ctx.gains[0]?.gain.value).toBe(1);
    sidechain.duck(duck());
    expect(ctx.gains[0]?.gain.calls.map((c) => c.method)).toEqual([
      'cancelScheduledValues',
      'setTargetAtTime',
      'setTargetAtTime',
    ]);
  });

  it('un kick en retard décale tout le plan, maintien compris', () => {
    const ctx = new FakeAudioContext();
    const sidechain = createSidechain(ctx.asContext());
    ctx.currentTime = 5;
    sidechain.duck(duck({ time: 4.9 }));
    const [, dip, rise] = ctx.gains[0]?.gain.calls ?? [];
    expect(dip?.time).toBe(5 + SCHEDULE_EPSILON_S);
    expect(rise?.time).toBeCloseTo(5 + SCHEDULE_EPSILON_S + SIDECHAIN_HOLD_S, 10);
  });

  it('désactivé en plein ducking, la basse remonte aussitôt ; activé, rien ne bouge', () => {
    const ctx = new FakeAudioContext();
    const sidechain = createSidechain(ctx.asContext());
    const gain = ctx.gains[0]?.gain;
    sidechain.applyParams({ enabled: true, amount: 0.3 });
    expect(gain?.calls).toEqual([]);

    ctx.currentTime = 2;
    sidechain.applyParams({ enabled: false, amount: 0.3 });
    expect(gain?.calls).toEqual([
      { method: 'cancelScheduledValues', time: 2 + SCHEDULE_EPSILON_S },
      {
        method: 'setTargetAtTime',
        time: 2 + SCHEDULE_EPSILON_S,
        value: 1,
        timeConstant: KNOB_SMOOTHING_S,
      },
    ]);
  });

  it('release annule le ducking programmé et remonte sans saut', () => {
    const ctx = new FakeAudioContext();
    const sidechain = createSidechain(ctx.asContext());
    sidechain.duck(duck({ time: 3 }));
    sidechain.release(3.005);
    expect(ctx.gains[0]?.gain.calls.slice(-2)).toEqual([
      { method: 'cancelScheduledValues', time: 3.005 },
      { method: 'setTargetAtTime', time: 3.005, value: 1, timeConstant: KNOB_SMOOTHING_S },
    ]);
  });
});
