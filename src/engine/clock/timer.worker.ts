/**
 * Worker de réveil du scheduler. Seul fichier du moteur autorisé à utiliser
 * `setInterval` : il ne déclenche aucun son, il réveille le thread principal.
 */
import type { TimerWorkerCommand } from './worker-timer';

let handle: ReturnType<typeof setInterval> | null = null;

const stop = () => {
  if (handle !== null) {
    clearInterval(handle);
    handle = null;
  }
};

addEventListener('message', (event: MessageEvent<TimerWorkerCommand>) => {
  const command = event.data;
  stop();
  if (command.type === 'start') {
    handle = setInterval(() => postMessage('tick'), command.intervalMs);
  }
});
