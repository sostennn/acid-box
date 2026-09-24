// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('frontière du moteur', () => {
  it('@engine se charge en node pur, sans DOM', async () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const engine = await import('@engine');
    expect(engine.createEngine).toBeTypeOf('function');
  });
});
