import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_DEBOUNCE_MS } from '../model/constants';
import { createDebouncedWriter, createLocalStorage, createMemoryStorage } from './storage';

/** `Storage` minimal en mémoire, pour tester l'adaptateur sans navigateur. */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

const failing = (): Storage => ({
  ...fakeStorage(),
  getItem: () => {
    throw new DOMException('refusé', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('plein', 'QuotaExceededError');
  },
});

describe('createLocalStorage', () => {
  it('écrit et relit sous sa clé', () => {
    const storage = fakeStorage();
    const adapter = createLocalStorage('k', () => storage);
    expect(adapter.load()).toBeNull();
    adapter.save('{"a":1}');
    expect(storage.getItem('k')).toBe('{"a":1}');
    expect(adapter.load()).toBe('{"a":1}');
  });

  it('stockage absent, refusé ou plein : ne lève jamais, ne retient rien', () => {
    for (const getStorage of [
      () => undefined,
      failing,
      () => {
        throw new DOMException('refusé', 'SecurityError');
      },
    ]) {
      const adapter = createLocalStorage('k', getStorage);
      expect(() => adapter.save('x')).not.toThrow();
      expect(adapter.load()).toBeNull();
    }
  });
});

describe('createDebouncedWriter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('une rafale donne une seule écriture, avec la dernière valeur, après le délai', () => {
    const storage = createMemoryStorage();
    const save = vi.spyOn(storage, 'save');
    const writer = createDebouncedWriter(storage);
    writer.schedule(() => 'a');
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    writer.schedule(() => 'b');
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
    expect(storage.load()).toBe('b');
  });

  it('calcule la valeur au moment d’écrire, pas au moment de programmer', () => {
    const storage = createMemoryStorage();
    const writer = createDebouncedWriter(storage);
    const value = vi.fn(() => 'état');
    writer.schedule(value);
    expect(value).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(value).toHaveBeenCalledOnce();
  });

  it('flush écrit tout de suite, une seule fois ; rien en attente, rien d’écrit', () => {
    const storage = createMemoryStorage();
    const save = vi.spyOn(storage, 'save');
    const writer = createDebouncedWriter(storage);
    writer.flush();
    expect(save).not.toHaveBeenCalled();
    writer.schedule(() => 'a');
    writer.flush();
    expect(storage.load()).toBe('a');
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledOnce();
  });

  it('dispose abandonne l’écriture en attente', () => {
    const storage = createMemoryStorage();
    const writer = createDebouncedWriter(storage);
    writer.schedule(() => 'a');
    writer.dispose();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(storage.load()).toBeNull();
  });
});
