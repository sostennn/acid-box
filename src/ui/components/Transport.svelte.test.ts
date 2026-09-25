// @vitest-environment happy-dom
import { DEFAULT_MIX, DEFAULT_TRANSPORT } from '@engine';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Transport from './Transport.svelte';

describe('Transport', () => {
  it('interrupteur et amount du sidechain', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(Transport, {
      transport: DEFAULT_TRANSPORT,
      mix: DEFAULT_MIX,
      dispatch,
    });
    await fireEvent.click(getByRole('switch', { name: /Sidechain/ }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'transport/setSidechain',
      patch: { enabled: !DEFAULT_TRANSPORT.sidechain.enabled },
    });
    await fireEvent.keyDown(getByRole('slider', { name: 'Amount' }), { key: 'Home' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'transport/setSidechain',
      patch: { amount: 0 },
    });
  });

  it('les trois niveaux du mix', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(Transport, {
      transport: DEFAULT_TRANSPORT,
      mix: DEFAULT_MIX,
      dispatch,
    });
    await fireEvent.keyDown(getByRole('slider', { name: 'Rythmique' }), { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'mix/set', patch: { drumsLevel: 1 } });
    await fireEvent.keyDown(getByRole('slider', { name: 'Basse' }), { key: 'Home' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'mix/set', patch: { bassLevel: 0 } });
  });
});
