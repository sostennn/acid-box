/**
 * Cycle de vie de l'AudioContext : création paresseuse sur geste utilisateur,
 * reprise après interruption (iOS, changement d'onglet), exposition d'un état
 * lisible par l'interface.
 */

export type AudioAvailability =
  /** Web Audio absent ou création impossible. */
  | 'unavailable'
  /** Aucun contexte encore créé, ou contexte suspendu en attente d'un geste. */
  | 'locked'
  | 'running'
  /** Suspendu par le système (appel, verrouillage d'écran) : une reprise sera tentée. */
  | 'interrupted';

export interface AudioInfo {
  readonly availability: AudioAvailability;
  readonly sampleRate: number | null;
  /** Latence de sortie estimée en secondes, 0 si le navigateur ne la donne pas. */
  readonly outputLatency: number;
}

/**
 * Sous-ensemble d'AudioContext utilisé par le moteur. Le typer structurellement
 * permet d'injecter un faux contexte en test et, plus tard, un OfflineAudioContext.
 */
export type AudioContextLike = Pick<
  AudioContext,
  | 'state'
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'resume'
  | 'close'
  | 'createBuffer'
  | 'createBufferSource'
  | 'createOscillator'
  | 'createGain'
  | 'createBiquadFilter'
  | 'createWaveShaper'
  | 'addEventListener'
  | 'removeEventListener'
> & {
  readonly baseLatency?: number;
  readonly outputLatency?: number;
};

export type AudioContextFactory = () => AudioContextLike;

/** Abstraction de `document.visibilityState`, injectable en test. */
export interface VisibilitySource {
  isVisible(): boolean;
  onChange(listener: () => void): () => void;
}

export interface AudioManagerOptions {
  readonly createContext?: AudioContextFactory;
  readonly visibility?: VisibilitySource;
}

export interface AudioManager {
  readonly info: AudioInfo;
  /** `null` tant que `unlock()` n'a pas réussi. */
  readonly context: AudioContextLike | null;
  /** À appeler depuis un gestionnaire de geste utilisateur (click, pointerup, keydown). */
  unlock(): Promise<void>;
  onChange(listener: (info: AudioInfo) => void): () => void;
  dispose(): void;
}

const INITIAL_INFO: AudioInfo = { availability: 'locked', sampleRate: null, outputLatency: 0 };

export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  const createContext = options.createContext ?? createBrowserContext;
  const visibility = options.visibility ?? createDocumentVisibility();
  const listeners = new Set<(info: AudioInfo) => void>();

  let context: AudioContextLike | null = null;
  let info: AudioInfo = INITIAL_INFO;
  let unlockedOnce = false;

  const publish = (next: AudioInfo) => {
    info = next;
    listeners.forEach((listener) => listener(info));
  };

  const refresh = () => {
    if (context === null) return;
    publish({
      availability: availabilityOf(context.state),
      sampleRate: context.sampleRate,
      outputLatency: context.outputLatency ?? context.baseLatency ?? 0,
    });
  };

  const ensureContext = (): AudioContextLike | null => {
    if (context !== null) return context;
    try {
      context = createContext();
    } catch {
      publish({ ...INITIAL_INFO, availability: 'unavailable' });
      return null;
    }
    context.addEventListener('statechange', refresh);
    return context;
  };

  const unlock = async () => {
    const ctx = ensureContext();
    if (ctx === null) return;
    if (ctx.state !== 'running') {
      await ctx.resume();
    }
    if (!unlockedOnce) {
      // iOS n'ouvre réellement la sortie audio qu'après la lecture d'une source
      // dans le geste utilisateur : un buffer d'un échantillon silencieux suffit.
      playSilentBuffer(ctx);
      unlockedOnce = true;
    }
    refresh();
  };

  // Au retour au premier plan, un contexte interrompu par le système peut
  // souvent reprendre sans nouveau geste ; on tente, sans garantie.
  const stopVisibility = visibility.onChange(() => {
    if (visibility.isVisible() && context !== null && context.state !== 'running') {
      void context.resume().then(refresh, refresh);
    }
  });

  return {
    get info() {
      return info;
    },
    get context() {
      return context;
    },
    unlock,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stopVisibility();
      listeners.clear();
      if (context !== null) {
        context.removeEventListener('statechange', refresh);
        void context.close();
        context = null;
      }
    },
  };
}

function availabilityOf(state: AudioContextState): AudioAvailability {
  switch (state) {
    case 'running':
      return 'running';
    case 'closed':
      return 'unavailable';
    case 'suspended':
      return 'locked';
    default:
      // Safari expose un état `interrupted` absent des types standard.
      return 'interrupted';
  }
}

function playSilentBuffer(ctx: AudioContextLike) {
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  source.connect(ctx.destination);
  source.start();
}

function createBrowserContext(): AudioContextLike {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Ctor === undefined) {
    throw new Error('Web Audio API indisponible');
  }
  return new Ctor({ latencyHint: 'interactive' });
}

export function createDocumentVisibility(): VisibilitySource {
  if (typeof document === 'undefined') {
    return { isVisible: () => true, onChange: () => () => {} };
  }
  return {
    isVisible: () => document.visibilityState === 'visible',
    onChange(listener) {
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}
