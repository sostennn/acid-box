/**
 * Constantes nommées du moteur. Tout nombre « magique » du moteur vit ici,
 * pour rester lisible et ajustable en un seul endroit.
 */

/**
 * Plancher des gains rampés exponentiellement : `exponentialRampToValueAtTime`
 * refuse la valeur 0 et ne rampe pas depuis 0. Environ −80 dB, inaudible.
 */
export const MIN_GAIN = 1e-4;

/** Son de test joué au déblocage de l'audio (provisoire, retiré au lot 3). */
export const TEST_TONE_FREQUENCY_HZ = 110;
export const TEST_TONE_PEAK_GAIN = 0.3;
export const TEST_TONE_ATTACK_S = 0.005;
export const TEST_TONE_DECAY_S = 0.4;
