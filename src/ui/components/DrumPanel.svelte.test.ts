// @vitest-environment happy-dom
import { DEFAULT_DRUMS, type DrumMutes } from '@engine';
import { fireEvent, render, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DrumPanel from './DrumPanel.svelte';

const UNMUTED: DrumMutes = { kick: false, clap: false, closedHat: false, openHat: false };

describe('DrumPanel', () => {
  it('mute et niveau par voix', async () => {
    const dispatch = vi.fn();
    const { getByRole } = render(DrumPanel, {
      drums: { ...DEFAULT_DRUMS, clap: { ...DEFAULT_DRUMS.clap, muted: true } },
      appliedMutes: { ...UNMUTED, clap: true },
      dispatch,
    });
    const clap = within(getByRole('group', { name: 'Clap' }));
    const mute = clap.getByRole('switch', { name: /Mute/ });
    expect(mute.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(mute);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'drums/setMuted',
      voice: 'clap',
      muted: false,
    });

    const kick = within(getByRole('group', { name: 'Kick' }));
    await fireEvent.keyDown(kick.getByRole('slider', { name: 'Niveau' }), { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'drums/setLevel', voice: 'kick', value: 1 });
  });

  it('signale un mute demandé qui attend la mesure suivante', () => {
    const { getByRole } = render(DrumPanel, {
      drums: { ...DEFAULT_DRUMS, kick: { ...DEFAULT_DRUMS.kick, muted: true } },
      appliedMutes: UNMUTED,
      dispatch: vi.fn(),
    });
    const kick = within(getByRole('group', { name: 'Kick' })).getByRole('switch');
    expect(kick.getAttribute('aria-checked')).toBe('true');
    expect(kick.classList.contains('pending')).toBe(true);
    expect(kick.textContent).toMatch(/en attente de la mesure suivante/);

    const clap = within(getByRole('group', { name: 'Clap' })).getByRole('switch');
    expect(clap.classList.contains('pending')).toBe(false);
  });
});
