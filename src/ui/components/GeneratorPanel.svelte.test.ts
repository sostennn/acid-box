// @vitest-environment happy-dom
import { DEFAULT_GENERATOR } from '@engine';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import GeneratorPanel from './GeneratorPanel.svelte';

const renderPanel = (canUndo: boolean) => {
  const dispatch = vi.fn();
  const view = render(GeneratorPanel, { generator: DEFAULT_GENERATOR, canUndo, dispatch });
  return { ...view, dispatch };
};

describe('GeneratorPanel', () => {
  it('génère, et n’annule que s’il y a une ligne à annuler', async () => {
    const { getByRole, dispatch } = renderPanel(false);
    await fireEvent.click(getByRole('button', { name: 'Générer' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'generator/run' });

    const undo = getByRole('button', { name: 'Annuler' });
    expect(undo).toHaveProperty('disabled', true);
    await fireEvent.click(undo);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('annule la dernière génération', async () => {
    const { getByRole, dispatch } = renderPanel(true);
    await fireEvent.click(getByRole('button', { name: 'Annuler' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'generator/undo' });
  });

  it('choisit la gamme et la tonique', async () => {
    const { getByRole, dispatch } = renderPanel(false);
    expect(getByRole('button', { name: 'Mineure' }).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(getByRole('button', { name: 'Phrygienne' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'generator/setParams',
      patch: { scale: 'phrygian' },
    });

    const root = getByRole('combobox', { name: 'Tonique' });
    expect(root).toHaveProperty('value', '0');
    await fireEvent.change(root, { target: { value: '9' } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'generator/setParams', patch: { root: 9 } });
  });

  it('règle chaque densité au knob', async () => {
    const { getByRole, dispatch } = renderPanel(false);
    await fireEvent.keyDown(getByRole('slider', { name: 'Slides' }), { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'generator/setParams',
      patch: { slideDensity: 1 },
    });
  });
});
