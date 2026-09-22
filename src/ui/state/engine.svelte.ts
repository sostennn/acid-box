/**
 * Pont entre le moteur et Svelte : seul module de l'interface qui instancie
 * le moteur. Chaque snapshot publié par le moteur remplace un `$state.raw`,
 * ce qui suffit à rafraîchir les composants sans proxy profond.
 */
import { createEngine, type Command, type Engine, type EngineState, type StepIndex } from '@engine';

export interface EngineStore {
  readonly state: EngineState;
  dispatch(command: Command): void;
  unlock(): Promise<void>;
  audibleStep(): StepIndex | null;
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
    dispatch: (command) => engine.dispatch(command),
    unlock: () => engine.unlock(),
    audibleStep: () => engine.audibleStep(),
    dispose() {
      unsubscribe();
      engine.dispose();
    },
  };
}
