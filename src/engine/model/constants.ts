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

/* ---------- Gains et lissage ---------- */
/** Constante de temps du lissage des knobs (`setTargetAtTime`), anti-zipper. */
export const KNOB_SMOOTHING_S = 0.01;

/**
 * Plancher des gains rampés exponentiellement : `exponentialRampToValueAtTime`
 * refuse la valeur 0 et ne rampe pas depuis 0. Environ −80 dB, inaudible.
 */
export const MIN_GAIN = 1e-4;

/* ---------- Voix basse ---------- */
/** Fraction du pas pendant laquelle la note est tenue (hors slide). */
export const GATE_RATIO = 0.55;
/** Constantes de temps (`setTargetAtTime`) des enveloppes d'amplitude. */
export const VCA_ATTACK_TAU_S = 0.001;
export const VCA_RELEASE_TAU_S = 0.008;
/** Relâchement à l'arrêt du transport, pour couper sans clic. */
export const STOP_RELEASE_TAU_S = 0.02;

export const CUTOFF_MIN_HZ = 80;
export const CUTOFF_MAX_HZ = 6000;
/** Q d'un passe-bas en dB : −3 dB est la réponse Butterworth, sans bosse à la coupure. */
export const RESONANCE_Q_MIN_DB = -3;
/** Un biquad devient instable au-delà ; le filtre en échelle (v2) ira plus loin. */
export const RESONANCE_Q_MAX_DB = 18;
export const DECAY_MIN_S = 0.03;
export const DECAY_MAX_S = 2;
/** Ouverture maximale du filtre par l'enveloppe, en octaves au-dessus du cutoff. */
export const ENV_MOD_MAX_OCTAVES = 5;
export const TUNING_RANGE_SEMITONES = 12;
export const DRIVE_MAX_GAIN = 20;
/** Compensation de niveau après saturation : post = pré^(−exposant). */
export const DRIVE_MAKEUP_EXPONENT = 0.25;
/** Raideur de la courbe tanh du WaveShaper. */
export const DRIVE_CURVE_STEEPNESS = 1.5;
export const DRIVE_CURVE_SAMPLES = 2048;
