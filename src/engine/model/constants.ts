/**
 * Constantes nommées du moteur. Tout nombre « magique » du moteur vit ici,
 * pour rester lisible et ajustable en un seul endroit.
 */

/** Nombre de pas d'un pattern. */
export const STEP_COUNT = 16;

/* ---------- Transport ---------- */
export const BPM_MIN = 40;
export const BPM_MAX = 240;
export const BPM_DEFAULT = 125;
/** Retard maximal des 16es impairs, en fraction de la durée d'un pas, à shuffle = 1. */
export const SHUFFLE_MAX_RATIO = 0.5;

/* ---------- Scheduler à lookahead ---------- */
/** Période de réveil du scheduler. */
export const SCHEDULE_INTERVAL_MS = 25;
/** Fenêtre programmée à l'avance sur l'horloge audio à chaque réveil. */
export const SCHEDULE_AHEAD_S = 0.1;
/** Délai entre la commande play et le premier pas, pour laisser le graphe se mettre en place. */
export const START_DELAY_S = 0.05;
/** Marge ajoutée à `currentTime` quand un événement devrait déjà avoir eu lieu. */
export const SCHEDULE_EPSILON_S = 0.001;
/**
 * Au-delà de ce retard (onglet caché longtemps), les pas dus ne sont plus
 * programmés : ils partiraient tous en rafale à `currentTime`. La position
 * dans le pattern continue d'avancer pour rester en phase.
 */
export const MAX_LATE_S = 0.25;

/* ---------- Gains ---------- */
/**
 * Plancher des gains rampés exponentiellement : `exponentialRampToValueAtTime`
 * refuse la valeur 0 et ne rampe pas depuis 0. Environ −80 dB, inaudible.
 */
export const MIN_GAIN = 1e-4;

/* ---------- Sons provisoires (retirés au lot 3) ---------- */
export const TEST_TONE_FREQUENCY_HZ = 110;
export const TEST_TONE_PEAK_GAIN = 0.3;
export const TEST_TONE_ATTACK_S = 0.005;
export const TEST_TONE_DECAY_S = 0.4;

export const METRONOME_FREQUENCY_HZ = 1000;
export const METRONOME_DOWNBEAT_FREQUENCY_HZ = 1500;
export const METRONOME_PEAK_GAIN = 0.25;
/** Les 16es hors temps sont joués à ce ratio du pic pour faire sentir le 4/4. */
export const METRONOME_OFFBEAT_RATIO = 0.4;
export const METRONOME_DECAY_S = 0.03;
