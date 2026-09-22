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

  it('applique un nouveau mix par lissage et se déconnecte au dispose', () => {
    const ctx = new FakeAudioContext();
    const graph = createAudioGraph(ctx.asContext(), DEFAULT_MIX);
    graph.applyMix({ ...DEFAULT_MIX, masterLevel: 1 });
    expect(ctx.gains[0]?.gain.calls.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 1 });
    graph.dispose();
    expect(ctx.gains[0]?.connections).toHaveLength(0);
  });
});
