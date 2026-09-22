/**
 * TimerSource sur Web Worker : les timers du thread principal sont fortement
 * ralentis dans un onglet caché, ceux d'un worker beaucoup moins.
 */
import type { TimerSource } from './clock';

export type TimerWorkerCommand =
  { readonly type: 'start'; readonly intervalMs: number } | { readonly type: 'stop' };

export function createWorkerTimer(): TimerSource {
  let worker: Worker | null = null;

  const ensureWorker = () => {
    worker ??= new Worker(new URL('./timer.worker.ts', import.meta.url), { type: 'module' });
    return worker;
  };

  return {
    start(intervalMs, onTick) {
      const w = ensureWorker();
      w.onmessage = () => onTick();
      w.postMessage({ type: 'start', intervalMs } satisfies TimerWorkerCommand);
    },
    stop() {
      worker?.postMessage({ type: 'stop' } satisfies TimerWorkerCommand);
    },
    dispose() {
      worker?.terminate();
      worker = null;
    },
  };
}
