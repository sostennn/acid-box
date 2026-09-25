import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../tests/fakes/fake-audio-context';
import { DEFAULT_MIX } from '../model/defaults';
import { createAudioGraph } from './graph';

describe('createAudioGraph', () => {
  it('crée un master relié à la destination, au niveau initial', () => {
    const ctx = new FakeAudioContext();
    const graph = createAudioGraph(ctx.asContext(), { ...DEFAULT_MIX, masterLevel: 0.5 });
    expect(ctx.gains[0]?.connections).toContain(ctx.destination);
    expect(ctx.gains[0]?.gain.value).toBeCloseTo(0.25, 10);
    expect(graph.master).toBe(ctx.gains[0]);
  });

  it('bus basse → sidechain → master, bus rythmique → master', () => {
    const ctx = new FakeAudioContext();
    const graph = createAudioGraph(ctx.asContext(), DEFAULT_MIX);
    const [master, bass, sidechain, drums] = ctx.gains;
    expect([graph.master, graph.bass, graph.sidechain.node, graph.drums]).toEqual([
      master,
      bass,
      sidechain,
      drums,
    ]);
    expect(bass?.connections).toEqual([sidechain]);
    expect(sidechain?.connections).toEqual([master]);
    expect(drums?.connections).toEqual([master]);
    expect(drums?.gain.value).toBeCloseTo(DEFAULT_MIX.drumsLevel ** 2, 10);
  });

  it('applique un nouveau mix par lissage et se déconnecte au dispose', () => {
    const ctx = new FakeAudioContext();
    const graph = createAudioGraph(ctx.asContext(), DEFAULT_MIX);
    graph.applyMix({ ...DEFAULT_MIX, masterLevel: 1, drumsLevel: 0.5 });
    expect(ctx.gains[0]?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
    expect(ctx.gains[3]?.gain.calls.at(-1)).toMatchObject({
      method: 'setTargetAtTime',
      value: 0.25,
    });
    graph.dispose();
    expect(ctx.gains[0]?.connections).toHaveLength(0);
  });
});
