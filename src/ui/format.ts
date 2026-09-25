/** Valeur normalisée [0, 1] → pourcentage entier. */
export const toPercent = (value: number): number => Math.round(value * 100);

export const formatPercent = (value: number): string => `${toPercent(value)} %`;
