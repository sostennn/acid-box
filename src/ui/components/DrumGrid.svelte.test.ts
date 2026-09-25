// @vitest-environment happy-dom
import { DRUM_DEFAULT_VELOCITY, type DrumPattern, type StepIndex } from '@engine';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DrumGrid from './DrumGrid.svelte';

const row = (active: readonly number[] = []) =>
  Array.from({ length: 16 }, (_, index) =>
    active.includes(index) ? 1 : 0,
  ) as unknown as DrumPattern['kick'];

const pattern: DrumPattern = {
  kick: row([0]),
  clap: row(),
  closedHat: row(),
  openHat: row(),
};

function setup(activeStep: StepIndex | null = null) {
  const dispatch = vi.fn();
  const view = render(DrumGrid, { pattern, activeStep, dispatch });
  return { dispatch, ...view };
}

const tap = async (element: HTMLElement) => {
  await fireEvent(
    element,
    new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
  );
  await fireEvent(element, new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }));
};

describe('DrumGrid', () => {
  it('affiche 4 voix × 16 pas avec leur état', () => {
    const { getAllByRole, getByRole } = setup();
    expect(getAllByRole('slider')).toHaveLength(64);
    expect(getByRole('slider', { name: 'Kick, pas 1' }).getAttribute('aria-valuetext')).toBe(
      'vélocité 100 %',
    );
    expect(getByRole('slider', { name: 'Clap, pas 1' }).getAttribute('aria-valuetext')).toBe(
      'inactif',
    );
  });

  it('un tap active un pas vide à la vélocité par défaut et vide un pas actif', async () => {
    const { dispatch, getByRole } = setup();
    await tap(getByRole('slider', { name: 'Clap, pas 5' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'pattern/setDrumVelocity',
      voice: 'clap',
      index: 4,
      velocity: DRUM_DEFAULT_VELOCITY,
    });
    await tap(getByRole('slider', { name: 'Kick, pas 1' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'pattern/setDrumVelocity',
      voice: 'kick',
      index: 0,
      velocity: 0,
    });
  });

  it('un glissé vertical règle la vélocité sans basculer le pas', async () => {
    const { dispatch, getByRole } = setup();
    const cell = getByRole('slider', { name: 'Kick, pas 1' });
    await fireEvent(
      cell,
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    await fireEvent(
      cell,
      new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 50 }),
    );
    await fireEvent(cell, new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 50 }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const command = dispatch.mock.calls[0]?.[0];
    expect(command).toMatchObject({ type: 'pattern/setDrumVelocity', voice: 'kick', index: 0 });
    expect(command.velocity).toBeLessThan(1);
    expect(command.velocity).toBeGreaterThan(0);
  });

  it('Entrée bascule le pas, les flèches règlent la vélocité', async () => {
    const { dispatch, getByRole } = setup();
    const cell = getByRole('slider', { name: 'Hat ouvert, pas 3' });
    await fireEvent.keyDown(cell, { key: 'Enter' });
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ voice: 'openHat', index: 2, velocity: DRUM_DEFAULT_VELOCITY }),
    );
    await fireEvent.keyDown(getByRole('slider', { name: 'Kick, pas 1' }), { key: 'ArrowDown' });
    expect(dispatch.mock.lastCall?.[0].velocity).toBeCloseTo(0.99, 10);
  });

  it('un glissé en petits mouvements règle la vélocité sans basculer le pas', async () => {
    const { dispatch, getByRole } = setup();
    const cell = getByRole('slider', { name: 'Clap, pas 1' });
    await fireEvent(
      cell,
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    for (let y = -2; y >= -20; y -= 2) {
      await fireEvent(
        cell,
        new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: y }),
      );
    }
    await fireEvent(
      cell,
      new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: -20 }),
    );
    expect(
      dispatch.mock.calls.every(([command]) => command.velocity !== DRUM_DEFAULT_VELOCITY),
    ).toBe(true);
    expect(dispatch.mock.lastCall?.[0]).toMatchObject({ voice: 'clap', index: 0 });
  });

  it('l’espace reste au transport et Entrée maintenue ne répète pas', async () => {
    const { dispatch, getByRole } = setup();
    const cell = getByRole('slider', { name: 'Clap, pas 2' });
    await fireEvent.keyDown(cell, { key: ' ' });
    await fireEvent.keyDown(cell, { key: 'Enter', repeat: true });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('suit la tête de lecture', () => {
    const { getByRole } = setup(4);
    expect(getByRole('slider', { name: 'Clap, pas 5' }).classList.contains('active')).toBe(true);
    expect(getByRole('slider', { name: 'Clap, pas 4' }).classList.contains('active')).toBe(false);
  });
});
