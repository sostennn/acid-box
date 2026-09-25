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

/* ---------- Rythmique ---------- */
/* Timbres fixés par constantes : pas de knob de timbre en v1. */
/** Vélocité posée par un tap sur un pas vide de la grille. */
export const DRUM_DEFAULT_VELOCITY = 0.8;
/** À vélocité minimale, la queue d'une frappe dure (1 − spread) fois sa durée nominale. */
export const DRUM_VELOCITY_DECAY_SPREAD = 0.3;
/** Une frappe s'arrête après ce nombre de constantes de temps de sa queue (5τ ≈ −43 dB). */
export const DRUM_TAIL_TAUS = 5;
/** Coupure d'une frappe qui sonne encore (stop, étouffement du hat ouvert), sans clic. */
export const DRUM_CUT_TAU_S = 0.004;
/** Durée du buffer de bruit, lu en boucle. */
export const NOISE_BUFFER_S = 1;

/** Kick : sinus dont la hauteur plonge de START à END. */
export const KICK_PITCH_START_HZ = 160;
export const KICK_PITCH_END_HZ = 48;
export const KICK_PITCH_TAU_S = 0.025;
export const KICK_DECAY_TAU_S = 0.12;

/** Clap : rafale de courtes bouffées de bruit filtré, puis une queue. */
export const CLAP_FILTER_HZ = 1200;
/** Q d'un passe-bande, sans unité (et non en dB comme celui d'un passe-bas). */
export const CLAP_FILTER_Q = 1.5;
export const CLAP_BURST_COUNT = 3;
export const CLAP_BURST_INTERVAL_S = 0.01;
export const CLAP_BURST_TAU_S = 0.003;
export const CLAP_TAIL_TAU_S = 0.08;

/** Hats : bruit passe-haut, seul le decay distingue le fermé de l'ouvert. */
export const HAT_HIGHPASS_HZ = 7000;
export const CLOSED_HAT_DECAY_TAU_S = 0.02;
export const OPEN_HAT_DECAY_TAU_S = 0.18;

/* ---------- Sidechain ---------- */
/** À amount = 1, le bus basse descend à 10 % de son niveau (−20 dB) sous le kick. */
export const SIDECHAIN_MAX_DEPTH = 0.9;
/** Constantes de temps (`setTargetAtTime`) de la plongée et de la remontée. */
export const SIDECHAIN_ATTACK_S = 0.004;
export const SIDECHAIN_RELEASE_S = 0.08;
/**
 * Maintien au creux avant la remontée. Doit rester sous le plus court créneau
 * entre deux pas, `D·(1 − SHUFFLE_MAX_RATIO)` à `BPM_MAX` (31 ms) : le kick
 * suivant annule tout ce qui est programmé après lui.
 */
export const SIDECHAIN_HOLD_S = 0.02;

/* ---------- Générateur ---------- */
/**
 * Probabilité qu'une note tirée hors du pas 0 soit la tonique, les six autres
 * degrés se partageant le reste : une ligne acid revient sans cesse à la
 * fondamentale.
 */
export const GENERATOR_TONIC_WEIGHT = 0.35;
/** Part des sauts d'octave vers le haut : la note qui bondit à l'octave est le geste acid type. */
export const GENERATOR_OCTAVE_UP_RATIO = 0.75;

/* ---------- Persistance ---------- */
/**
 * Délai de sauvegarde après la dernière modification : un geste de knob envoie
 * une commande par événement pointer, on n'écrit qu'une fois qu'il s'arrête.
 * Assez court pour qu'un rechargement juste après ne perde rien.
 */
export const SAVE_DEBOUNCE_MS = 400;
