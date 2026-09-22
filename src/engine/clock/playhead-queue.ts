/**
 * File des pas programmés, consommée par l'interface pour afficher le pas
 * réellement audible : le scheduler travaille dans le futur, l'affichage
 * compare les temps programmés au temps courant.
 */
import type { PlayheadEvent, StepIndex } from '../model/types';

export interface PlayheadQueue {
  push(event: PlayheadEvent): void;
  /** Dernier pas dont le temps est atteint à `now`, ou null avant le premier. */
  audibleStep(now: number): StepIndex | null;
  clear(): void;
}

export function createPlayheadQueue(): PlayheadQueue {
  let events: PlayheadEvent[] = [];

  return {
    push(event) {
      events.push(event);
    },
    audibleStep(now) {
      let reached = -1;
      for (let i = 0; i < events.length; i += 1) {
        if ((events[i]?.time ?? Infinity) <= now) reached = i;
        else break;
      }
      if (reached < 0) return null;
      // On conserve l'événement courant en tête pour les appels suivants.
      if (reached > 0) events = events.slice(reached);
      return events[0]?.step ?? null;
    },
    clear() {
      events = [];
    },
  };
}
