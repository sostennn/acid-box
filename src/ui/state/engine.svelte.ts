/**
 * Pont entre le moteur et Svelte : seul module de l'interface qui instancie
 * le moteur. Chaque snapshot publié par le moteur remplace un `$state.raw`,
 * ce qui suffit à rafraîchir les composants sans proxy profond.
 */
import { createEngine, type Engine, type EngineState } from '@engine';

export interface EngineStore {
  readonly state: EngineState;
  unlock(): Promise<void>;
  playTestTone(): void;
  dispose(): void;
}

export function createEngineStore(engine: Engine = createEngine()): EngineStore {
  let state = $state.raw(engine.getState());
  const unsubscribe = engine.subscribe((next) => {
    state = next;
  });

  return {
    get state() {
      return state;
    },
    unlock: () => engine.unlock(),
    playTestTone: () => engine.playTestTone(),
    dispose() {
      unsubscribe();
      engine.dispose();
    },
  };
}
