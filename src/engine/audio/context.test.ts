import { describe, expect, it, vi } from 'vitest';
import { FakeAudioContext, createFakeVisibility } from '../../../tests/fakes/fake-audio-context';
import { createAudioManager } from './context';

function setup() {
  const ctx = new FakeAudioContext(44100);
  const visibility = createFakeVisibility();
  const createContext = vi.fn(() => ctx.asContext());
  const manager = createAudioManager({ createContext, visibility });
  return { ctx, visibility, createContext, manager };
}

describe('createAudioManager', () => {
  it('démarre verrouillé, sans créer de contexte avant un geste', () => {
    const { manager, createContext } = setup();
    expect(manager.info.availability).toBe('locked');
    expect(manager.context).toBeNull();
    expect(createContext).not.toHaveBeenCalled();
  });

  it('unlock crée le contexte, le reprend et joue un buffer silencieux', async () => {
    const { manager, ctx } = setup();
    await manager.unlock();

    expect(ctx.resumeCount).toBe(1);
    expect(manager.info).toEqual({ availability: 'running', sampleRate: 44100, outputLatency: 0 });
    expect(ctx.bufferSources).toHaveLength(1);
    expect(ctx.bufferSources[0]?.startedAt).toBe(0);
    expect(ctx.bufferSources[0]?.connections).toContain(ctx.destination);
  });

  it('unlock répété ne crée qu’un contexte et ne rejoue pas le buffer silencieux', async () => {
    const { manager, ctx, createContext } = setup();
    await manager.unlock();
    await manager.unlock();

    expect(createContext).toHaveBeenCalledTimes(1);
    expect(ctx.bufferSources).toHaveLength(1);
  });

  it('publie les changements d’état imposés par le système', async () => {
    const { manager, ctx } = setup();
    const listener = vi.fn();
    manager.onChange(listener);
    await manager.unlock();

    ctx.setState('interrupted');
    expect(manager.info.availability).toBe('interrupted');
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ availability: 'interrupted' }),
    );

    await manager.unlock();
    expect(manager.info.availability).toBe('running');
  });

  it('tente une reprise au retour au premier plan', async () => {
    const { manager, ctx, visibility } = setup();
    await manager.unlock();
    ctx.setState('interrupted');

    visibility.set(false);
    expect(ctx.resumeCount).toBe(1);

    visibility.set(true);
    await Promise.resolve();
    expect(ctx.resumeCount).toBe(2);
    expect(manager.info.availability).toBe('running');
  });

  it('signale l’indisponibilité si le contexte ne peut pas être créé', async () => {
    const manager = createAudioManager({
      createContext: () => {
        throw new Error('no web audio');
      },
      visibility: createFakeVisibility(),
    });
    await manager.unlock();
    expect(manager.info.availability).toBe('unavailable');
  });

  it('dispose ferme le contexte et coupe les abonnements', async () => {
    const { manager, ctx, visibility } = setup();
    const listener = vi.fn();
    manager.onChange(listener);
    await manager.unlock();
    listener.mockClear();

    manager.dispose();
    expect(ctx.closed).toBe(true);
    visibility.set(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
