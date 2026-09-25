/**
 * Stockage de l'état de travail : un seul slot implicite. Un stockage
 * indisponible (navigation privée, quota, iframe sans accès) ne casse jamais
 * l'application, il ne retient simplement rien.
 */
import { SAVE_DEBOUNCE_MS } from '../model/constants';

export interface StorageAdapter {
  load(): string | null;
  save(value: string): void;
}

export const STORAGE_KEY = 'acid-box/state';

export function createLocalStorage(
  key = STORAGE_KEY,
  // Lire `localStorage` peut lever à lui seul (SecurityError) : l'accès reste paresseux.
  getStorage: () => Storage | undefined = () => globalThis.localStorage,
): StorageAdapter {
  return {
    load() {
      try {
        return getStorage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    save(value) {
      try {
        getStorage()?.setItem(key, value);
      } catch {
        // Quota dépassé ou accès refusé : la session continue sans sauvegarde.
      }
    },
  };
}

export function createMemoryStorage(initial: string | null = null): StorageAdapter {
  let value = initial;
  return {
    load: () => value,
    save(next) {
      value = next;
    },
  };
}

export interface DebouncedWriter {
  /** Programme une écriture ; la valeur n'est calculée qu'au moment d'écrire. */
  schedule(value: () => string): void;
  /** Écrit tout de suite ce qui est en attente. */
  flush(): void;
  dispose(): void;
}

export function createDebouncedWriter(
  storage: StorageAdapter,
  delayMs = SAVE_DEBOUNCE_MS,
): DebouncedWriter {
  let pending: (() => string) | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
  };

  const flush = () => {
    cancel();
    if (pending === null) return;
    const value = pending;
    pending = null;
    storage.save(value());
  };

  return {
    schedule(value) {
      pending = value;
      cancel();
      timeout = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      cancel();
      pending = null;
    },
  };
}
