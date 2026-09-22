/** Horloge de référence : en production, `AudioContext.currentTime`. */
export interface AudioClock {
  now(): number;
}

/**
 * Source de réveil périodique du scheduler. Le réveil n'a aucune précision
 * musicale : il sert seulement à programmer la fenêtre suivante sur l'horloge audio.
 */
export interface TimerSource {
  start(intervalMs: number, onTick: () => void): void;
  stop(): void;
  dispose(): void;
}
