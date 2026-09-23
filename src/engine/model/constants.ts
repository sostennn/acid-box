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
/** Constante de temps du glissé d'un slide : 95 % du chemin en 3τ, soit 60 ms. */
export const SLIDE_TAU_S = 0.02;

/* Accent : trois effets simultanés, dosés par le knob accent. */
/** Pic du VCA = 1 + accent × boost (1 → +6 dB). */
export const ACCENT_MAX_GAIN_BOOST = 1;
/** Ouverture supplémentaire du filtre, en octaves, ajoutée au pic d'enveloppe. */
export const ACCENT_MAX_OCTAVES = 2;
/** Résonance ajoutée par un accent au Q du knob, en dB, bornée par `RESONANCE_Q_MAX_DB`. */
export const ACCENT_Q_BOOST_DB = 6;
export const ACCENT_Q_ATTACK_TAU_S = 0.002;
export const ACCENT_Q_HOLD_S = 0.01;
/**
 * Sur un pas accentué, la décroissance du filtre est fixée au plus court quel
 * que soit le knob decay, comme sur la 303 : c'est le « claquement » de l'accent.
 */
export const ACCENT_ENV_DECAY_S = 0.05;

export const CUTOFF_MIN_HZ = 80;
export const CUTOFF_MAX_HZ = 6000;
/** Q d'un passe-bas en dB : −3 dB est la réponse Butterworth, sans bosse à la coupure. */
export const RESONANCE_Q_MIN_DB = -3;
/** Un biquad devient instable au-delà ; le filtre en échelle (v2) ira plus loin. */
export const RESONANCE_Q_MAX_DB = 18;
/**
 * Plage du knob decay (constante de temps). Un pas dure 66 ms à 125 BPM avant
 * sa fermeture : au-delà de ~0,6 s, le filtre n'a plus le temps de se refermer
 * de façon audible, seuls les slides en profiteraient.
 */
export const DECAY_MIN_S = 0.02;
export const DECAY_MAX_S = 0.6;
/** Ouverture maximale du filtre par l'enveloppe, en octaves au-dessus du cutoff. */
export const ENV_MOD_MAX_OCTAVES = 5;
export const TUNING_RANGE_SEMITONES = 12;
export const DRIVE_MAX_GAIN = 20;
/** Compensation de niveau après saturation : post = pré^(−exposant). */
export const DRIVE_MAKEUP_EXPONENT = 0.25;
/** Raideur de la courbe tanh du WaveShaper. */
export const DRIVE_CURVE_STEEPNESS = 1.5;
export const DRIVE_CURVE_SAMPLES = 2048;
