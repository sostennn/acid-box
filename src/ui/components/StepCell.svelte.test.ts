// @vitest-environment happy-dom
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import StepCell from './StepCell.svelte';

const step = { note: 0, octave: 0, accent: false, slide: false, rest: false } as const;

describe('StepCell', () => {
  it('affiche la hauteur et bascule le silence', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(StepCell, {
      index: 2,
      step,
      active: false,
      held: false,
      dispatch,
    });
    expect(getByRole('slider').textContent?.trim()).toBe('C2');

    await fireEvent.click(getByRole('button', { name: /joué/ }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'pattern/toggleStepFlag',
      index: 2,
      flag: 'rest',
    });
  });

  it('bascule accent et slide', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(StepCell, {
      index: 4,
      step,
      active: false,
      held: false,
      dispatch,
    });
    await fireEvent.click(getByRole('button', { name: /Accent/ }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'pattern/toggleStepFlag',
      index: 4,
      flag: 'accent',
    });
    await fireEvent.click(getByRole('button', { name: /Slide/ }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'pattern/toggleStepFlag',
      index: 4,
      flag: 'slide',
    });
  });

  it('signale un pas tenu', () => {
    const { getByRole } = render(StepCell, {
      index: 1,
      step,
      active: false,
      held: true,
      dispatch: vi.fn(),
    });
    expect(getByRole('slider').closest('.cell')?.classList.contains('held')).toBe(true);
  });

  it('un drag vers le haut monte la hauteur d’au moins un demi-ton', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(StepCell, {
      index: 0,
      step,
      active: false,
      held: false,
      dispatch,
    });
    const slider = getByRole('slider');
    await fireEvent(
      slider,
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 100 }),
    );
    await fireEvent(
      slider,
      new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 60 }),
    );
    const call = dispatch.mock.calls.at(-1)?.[0];
    expect(call?.type).toBe('pattern/setStep');
    expect(call?.patch.octave * 12 + call?.patch.note).toBeGreaterThan(0);
  });

  it('le clavier change la hauteur par demi-ton', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(StepCell, {
      index: 0,
      step,
      active: false,
      held: false,
      dispatch,
    });
    await fireEvent.keyDown(getByRole('slider'), { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'pattern/setStep',
      index: 0,
      patch: { note: 11, octave: 1 },
    });
  });
});
