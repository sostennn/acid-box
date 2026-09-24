// @vitest-environment happy-dom
import type { Engine, EngineState } from '@engine';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { createEngineStore } from './engine.svelte';

/** Le pont ne lit pas le contenu des snapshots : leur identité suffit. */
const snapshot = (name: string) => ({ name }) as unknown as EngineState;

function createFakeEngine(initial: EngineState) {
  let listener: ((state: EngineState) => void) | null = null;
  const unsubscribe = vi.fn();
  const engine = {
    unlock: vi.fn(() => Promise.resolve()),
    dispatch: vi.fn(),
    getState: () => initial,
    subscribe: vi.fn((next: (state: EngineState) => void) => {
      listener = next;
      return unsubscribe;
    }),
    audibleStep: vi.fn(() => 3 as const),
    dispose: vi.fn(),
  } satisfies Engine;
  return { engine, unsubscribe, publish: (state: EngineState) => listener?.(state) };
}

describe('createEngineStore', () => {
  it('un snapshot publié par le moteur se reflète dans ce que lit l’interface', () => {
    const first = snapshot('first');
    const second = snapshot('second');
    const { engine, publish } = createFakeEngine(first);
    const store = createEngineStore(engine);

    const seen: EngineState[] = [];
    const stop = $effect.root(() => {
      $effect(() => {
        seen.push(store.state);
      });
    });
    flushSync();
    publish(second);
    flushSync();
    stop();

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(first);
    expect(seen[1]).toBe(second);
  });

  it('relaie les commandes, le déblocage et la tête de lecture au moteur', async () => {
    const { engine } = createFakeEngine(snapshot('initial'));
    const store = createEngineStore(engine);

    store.dispatch({ type: 'transport/play' });
    await store.unlock();

    expect(engine.dispatch).toHaveBeenCalledWith({ type: 'transport/play' });
    expect(engine.unlock).toHaveBeenCalledOnce();
    expect(store.audibleStep()).toBe(3);
  });

  it('dispose se désabonne puis libère le moteur', () => {
    const { engine, unsubscribe } = createFakeEngine(snapshot('initial'));
    createEngineStore(engine).dispose();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(engine.dispose).toHaveBeenCalledOnce();
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      engine.dispose.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
