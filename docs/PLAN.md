# Plan de développement — synthé acid house dans le navigateur

## Contexte

Projet personnel destiné à GitHub : un synthétiseur basse monophonique de type
« acid » avec séquenceur 16 pas, accompagné d'une boîte à rythmes minimale
(4 voix), le tout synthétisé en Web Audio sans aucun asset. Le cœur du projet
est le synthé basse et le plaisir de le jouer en direct au knob. La qualité du
code est un objectif au même titre que le résultat sonore.

Ce document planifie la **v1** en détail et esquisse v2–v4. Les lots 0 à 5 sont
livrés (état dans la feuille de route du README). Quand le code s'écarte de ce
plan, c'est le code qui fait foi et ce document est corrigé dans la même PR ;
les écarts pas encore traités sont listés dans « Dette et points ouverts », à la
fin.

Décisions déjà prises avec l'utilisateur :

| Sujet           | Décision                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| Couche UI       | Svelte 5 (runes) + Vite                                                           |
| Cible écran     | Desktop + tablette paysage ; mobile portrait ne casse pas mais n'est pas optimisé |
| Rythmique       | Grille, mute, vélocité par pas, niveau par voix ; timbres fixés par constantes    |
| Repo            | pnpm, ESLint/Prettier, Vitest, GitHub Actions (CI) + déploiement GitHub Pages     |
| Slide → silence | La note est tenue jusqu'au prochain pas joué et glisse vers lui (liaison)         |
| Octave          | Décalage relatif -1 / 0 / +1 par pas, autour d'une octave de base                 |
| Sidechain       | Interrupteur + knob amount ; attaque et retour en constantes                      |
| Persistance v1  | État de travail (pattern + knobs) en localStorage, un seul slot implicite         |

---

## 1. Questions restantes et hypothèses explicites

Les deux tours de questions ont tranché l'essentiel. Ce qui suit n'a pas été
demandé : ce sont des **hypothèses assumées**, chacune facile à inverser. À
signaler si l'une ne convient pas.

| #   | Hypothèse                                                                                                                                                                                                                                 | Alternative si refus                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| H1  | ~~Nom provisoire~~ **Tranché : `acid-box`**, dépôt dans `projects/perso/`.                                                                                                                                                                | —                                           |
| H2  | ~~Anglais~~ **Tranché : identifiants de code en anglais ; commentaires, README et textes d'interface en français.** Messages de commit en anglais.                                                                                        | —                                           |
| H3  | Toutes les valeurs de knobs sont stockées **normalisées 0..1** dans l'état ; la conversion en Hz / Q / secondes vit dans le moteur (courbes nommées). Rend les knobs, la persistance et le futur partage par URL indépendants des unités. | Unités physiques dans l'état.               |
| H4  | Octave de base = C2 (MIDI 36). Avec le décalage ±1, la plage jouable est C1–B3. Le knob tuning couvre ±12 demi-tons (constante `TUNING_RANGE_SEMITONES`).                                                                                 | Autre centre ou plage.                      |
| H5  | Longueur de pattern fixée à 16 (constante `STEP_COUNT`), pas de champ `length` dans le modèle v1. Il sera ajouté en v3 avec le chaînage.                                                                                                  | Champ `length` dès v1.                      |
| H6  | Le générateur peut aussi poser des **sauts d'octave** (densité dédiée) et dispose d'un **undo à un niveau** (le pattern précédent est conservé).                                                                                          | Pas de sauts / pas d'undo.                  |
| H7  | Vélocité rythmique continue 0..1 (0 = pas inactif). UI : clic = toggle à la vélocité par défaut, drag vertical = réglage fin.                                                                                                             | Deux niveaux (normal / accent).             |
| H8  | Le hat ouvert est **étouffé** par le hat fermé (choke group), comme sur une boîte à rythmes classique.                                                                                                                                    | Voix indépendantes.                         |
| H9  | Un knob **master** plus un niveau bus basse et un niveau bus rythmique.                                                                                                                                                                   | Master seul.                                |
| H10 | Le timer qui réveille le scheduler tourne dans un **Web Worker** (moins throttlé en onglet caché que le thread principal). La lecture continue quand l'onglet est caché.                                                                  | `setInterval` main thread ; pause auto.     |
| H11 | Raccourci clavier : barre d'espace = play/stop. Pas de clavier musical en v1.                                                                                                                                                             | —                                           |
| H12 | Modification d'un pas déjà programmé dans la fenêtre de lookahead : prise en compte au tour suivant (latence ≤ lookahead, ~100 ms). Acceptable et documenté.                                                                              | Re-planification (complexe, non justifiée). |

---

## 2. Stack retenue

| Choix                                                                                                                                                                  | Justification                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)                                                                             | Imposé ; les options strictes évitent les `undefined` silencieux sur les tableaux de 16 pas.                                                                                                                                                                                                                                                                                        |
| **Vite**                                                                                                                                                               | Bundler standard pour Svelte, HMR instantané, support natif des Workers (`new Worker(new URL(...), import.meta.url)`) utile pour le timer, config `base` triviale pour GitHub Pages.                                                                                                                                                                                                |
| **Svelte 5 (runes), sans SvelteKit**                                                                                                                                   | Application mono-page statique sans routing ni SSR : SvelteKit n'apporterait que de la surface. Les runes donnent une réactivité fine par knob sans re-rendu de la grille. Le moteur n'importe rien de Svelte ; seul un fichier de pont côté UI en dépend.                                                                                                                          |
| **Gestion d'état : le moteur est la source de vérité**                                                                                                                 | Le moteur possède un état mutable interne, expose `dispatch(command)`, `getState()` (snapshot immuable) et `subscribe()`. Côté UI, un unique pont (`engine.svelte.ts`) copie chaque snapshot dans un `$state.raw` ; les composants lisent ce snapshot et dispatchent des commandes. Aucune bibliothèque d'état : le pattern « external store » suffit et rend la frontière lisible. |
| **CSS natif + custom properties**, pas de Tailwind ni de CSS-in-JS                                                                                                     | Contrainte de thématisation : tous les tokens dans `tokens.css`, les composants ne consomment que des `var(--…)`. Une règle **Stylelint** interdit les littéraux de couleur / rayon / taille de police hors du fichier de tokens, ce qui rend la contrainte vérifiable en CI.                                                                                                       |
| **Vitest** (node) + **@testing-library/svelte** (happy-dom) + **Vitest browser mode** (Playwright, Chromium) pour quelques tests audio réels sur `OfflineAudioContext` | Voir §6. La logique du moteur est testée sans Web Audio ; le mode navigateur ne sert qu'aux tests de rendu sonore.                                                                                                                                                                                                                                                                  |
| **ESLint flat config** + `eslint-plugin-svelte` + **Prettier** + `svelte-check`                                                                                        | Standard. `no-restricted-imports` matérialise la frontière moteur / UI (voir §3).                                                                                                                                                                                                                                                                                                   |
| **pnpm**                                                                                                                                                               | Rapide, lockfile strict.                                                                                                                                                                                                                                                                                                                                                            |
| **GitHub Actions** : `ci.yml` (typecheck, lint, stylelint, tests) sur push/PR ; `deploy.yml` (build + Pages) sur `main`                                                | Démo jouable en ligne dès le lot 0.                                                                                                                                                                                                                                                                                                                                                 |

Points volontairement écartés : Tone.js (masquerait le scheduling, qui est
justement le sujet), une lib de knobs (le geste est une fonctionnalité),
Zustand/Redux (le moteur joue déjà ce rôle).

---

## 3. Arborescence

```
acid-box/
├── .github/workflows/
│   ├── ci.yml                      # typecheck + lint + stylelint + tests
│   └── deploy.yml                  # build + GitHub Pages
├── public/                         # favicon uniquement (aucun asset audio)
├── src/
│   ├── engine/                     # ◀── MOTEUR : zéro import de svelte/ ou de ui/
│   │   ├── index.ts                # createEngine(), type Engine (API publique)
│   │   ├── commands.ts             # union Command
│   │   ├── state.ts                # EngineState + reducers purs (command → état)
│   │   ├── model/
│   │   │   ├── types.ts            # Step, Pattern, params… (voir §4)
│   │   │   ├── defaults.ts         # pattern et paramètres par défaut
│   │   │   ├── constants.ts        # STEP_COUNT, plages, ratios, temps (toutes nommées)
│   │   │   ├── mapping.ts          # 0..1 → Hz / Q / s / dB (courbes nommées)
│   │   │   └── scales.ts           # gammes (mineure, phrygienne)
│   │   ├── clock/
│   │   │   ├── clock.ts            # interface AudioClock { now() } + TimerSource
│   │   │   ├── worker-timer.ts     # TimerSource sur Web Worker
│   │   │   ├── timer.worker.ts     # le worker lui-même (quelques lignes)
│   │   │   ├── timing.ts           # bpm → durée de pas, shuffle → offset (pur)
│   │   │   ├── scheduler.ts        # boucle à lookahead, constantes SCHEDULE_*
│   │   │   └── playhead-queue.ts   # file { step, time } consommée par l'UI
│   │   ├── synth/
│   │   │   ├── graph.ts            # construction du graphe, bus, master
│   │   │   ├── filter-stage.ts     # interface FilterStage (biquad v1, ladder v2)
│   │   │   ├── bass/
│   │   │   │   ├── bass-plan.ts    # pas + params → plan d'automation (pur, testé)
│   │   │   │   ├── bass-voice.ts   # applique le plan aux AudioParams
│   │   │   │   └── drive.ts        # pré-gain + WaveShaper tanh
│   │   │   ├── drums/
│   │   │   │   ├── drum-kit.ts     # tranches par voix, frappes qui sonnent, choke, release
│   │   │   │   ├── hit.ts          # cycle de vie d'une frappe (start, stop, ended, cut)
│   │   │   │   ├── noise.ts        # buffer de bruit blanc généré procéduralement
│   │   │   │   ├── kick.ts
│   │   │   │   ├── clap.ts
│   │   │   │   ├── hihat.ts        # closed + open, choke group
│   │   │   │   └── drum-plan.ts    # vélocité → paramètres de frappe (pur)
│   │   │   └── sidechain.ts        # gain dédié bus basse → master, ducking programmé
│   │   ├── generator/
│   │   │   ├── rng.ts              # PRNG seedable (mulberry32 ou équivalent)
│   │   │   └── acid-generator.ts   # génération contrainte (pur, testé)
│   │   ├── persistence/
│   │   │   ├── serialize.ts        # état ↔ JSON versionné
│   │   │   └── storage.ts          # adaptateur localStorage (injectable)
│   │   └── audio/
│   │       ├── context.ts          # création paresseuse, unlock, resume, visibilité
│   │       └── params.ts           # helpers d'automation sûrs (safeTime, smoothSet)
│   │
│   ├── ui/                         # ◀── INTERFACE : ne parle au moteur que via Engine
│   │   ├── App.svelte
│   │   ├── state/
│   │   │   └── engine.svelte.ts    # pont : subscribe → $state.raw, dispatch
│   │   ├── playhead/
│   │   │   └── playhead.svelte.ts  # boucle rAF, compare file ↔ currentTime
│   │   ├── gestures/
│   │   │   └── knob-drag.ts        # action Svelte : Pointer Events, capture, tactile
│   │   ├── components/
│   │   │   ├── Knob.svelte
│   │   │   ├── Switch.svelte
│   │   │   ├── StepCell.svelte
│   │   │   ├── BassSequencer.svelte
│   │   │   ├── BassPanel.svelte
│   │   │   ├── DrumGrid.svelte
│   │   │   ├── DrumPanel.svelte
│   │   │   ├── Transport.svelte
│   │   │   ├── GeneratorPanel.svelte
│   │   │   └── AudioGate.svelte    # overlay « tap to start » (unlock)
│   │   └── theme/
│   │       ├── tokens.css          # ▶ SEUL fichier avec des littéraux visuels
│   │       └── base.css            # reset + application des tokens
│   └── main.ts
├── tests/
│   ├── browser/                    # tests OfflineAudioContext (vitest browser mode, lot 7)
│   └── fakes/                      # FakeAudioContext, FakeClock, FakeTimer
├── eslint.config.js, .stylelintrc.json, vite.config.ts (tests compris), tsconfig.*.json
└── README.md
```

**Frontière rendue explicite et vérifiée :**

- Alias `@engine/*` et `@ui/*`. `src/engine/**` est soumis à une règle
  `no-restricted-imports` interdisant `svelte`, `svelte/*`, `@ui/*`, `../ui`.
  Le lint échoue en CI si la frontière est franchie.
- Le moteur n'importe ni `document` ni `window` hors de `audio/context.ts` et
  du worker : il reste rendable dans un `OfflineAudioContext` (v4).
- Un seul fichier UI connaît `createEngine` : `ui/state/engine.svelte.ts`.

---

## 4. Modèle de données

Seule exception à « pas de code ». Fichier cible : `src/engine/model/types.ts`
(+ `commands.ts`, `index.ts`).

```ts
// ---------- Constantes de forme ----------
export const STEP_COUNT = 16;

/** Tuple de longueur fixe, évite les index hors-borne dans tout le moteur. */
export type Tuple16<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T];
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

// ---------- Hauteur ----------
/** 0 = C … 11 = B. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type OctaveOffset = -1 | 0 | 1;

// ---------- Séquence basse ----------
export interface Step {
  readonly note: PitchClass;
  readonly octave: OctaveOffset;
  readonly accent: boolean;
  readonly slide: boolean;
  readonly rest: boolean;
}

export type BassPattern = Tuple16<Step>;

// ---------- Séquence rythmique ----------
export type DrumVoiceId = 'kick' | 'clap' | 'closedHat' | 'openHat';
export const DRUM_VOICES: readonly DrumVoiceId[] = ['kick', 'clap', 'closedHat', 'openHat'];

/** 0 = pas inactif, ]0, 1] = vélocité. */
export type Velocity = number;
export type DrumPattern = Readonly<Record<DrumVoiceId, Tuple16<Velocity>>>;

export interface Pattern {
  readonly bass: BassPattern;
  readonly drums: DrumPattern;
}

// ---------- Paramètres de voix ----------
/** Toute valeur de knob est normalisée dans [0, 1] ; mapping.ts fait la conversion. */
export type Normalized = number;

export type BassWaveform = 'sawtooth' | 'square';

export interface BassParams {
  readonly waveform: BassWaveform;
  readonly tuning: Normalized; // 0.5 = accord de référence, ±TUNING_RANGE_SEMITONES
  readonly cutoff: Normalized;
  readonly resonance: Normalized;
  readonly envMod: Normalized;
  readonly decay: Normalized;
  readonly accent: Normalized;
  readonly drive: Normalized;
}
export type BassKnobId = Exclude<keyof BassParams, 'waveform'>;

export interface DrumVoiceParams {
  readonly level: Normalized;
  readonly muted: boolean;
}
export type DrumParams = Readonly<Record<DrumVoiceId, DrumVoiceParams>>;
export type DrumMutes = Readonly<Record<DrumVoiceId, boolean>>;

export interface MixParams {
  readonly bassLevel: Normalized;
  readonly drumsLevel: Normalized;
  readonly masterLevel: Normalized;
}

// ---------- Transport ----------
export interface SidechainParams {
  readonly enabled: boolean;
  readonly amount: Normalized;
}

export interface TransportParams {
  readonly bpm: number; // en BPM, borné par BPM_MIN / BPM_MAX
  readonly shuffle: Normalized; // 0 = droit, 1 = SHUFFLE_MAX_RATIO
  readonly sidechain: SidechainParams;
}

export type TransportStatus = 'stopped' | 'playing';

// ---------- Générateur ----------
export type ScaleId = 'minor' | 'phrygian';

export interface GeneratorParams {
  readonly scale: ScaleId;
  readonly root: PitchClass;
  readonly noteDensity: Normalized;
  readonly accentDensity: Normalized;
  readonly slideDensity: Normalized;
  readonly octaveJumpDensity: Normalized;
  readonly seed: number | null; // null = aléatoire à chaque run
}

// ---------- Audio ----------
export type AudioAvailability = 'unavailable' | 'locked' | 'running' | 'interrupted';

export interface AudioInfo {
  readonly availability: AudioAvailability;
  readonly sampleRate: number | null;
  readonly outputLatency: number; // secondes, 0 si inconnu
}

// ---------- État global (snapshot immuable exposé à l'UI) ----------
export interface EngineState {
  readonly audio: AudioInfo;
  readonly transport: TransportParams & { readonly status: TransportStatus };
  readonly pattern: Pattern;
  readonly previousPattern: Pattern | null; // undo à un niveau du générateur
  readonly bass: BassParams;
  readonly drums: DrumParams; // muted = mute demandé
  readonly appliedMutes: DrumMutes; // mute entendu : rejoint drums au pas 0 en lecture, aussitôt à l'arrêt
  readonly mix: MixParams;
  readonly generator: GeneratorParams;
}

// ---------- Tête de lecture (canal séparé, haute fréquence, hors snapshot) ----------
export interface PlayheadEvent {
  readonly step: StepIndex;
  readonly time: number; // temps AudioContext auquel le pas devient audible
}

// ---------- Persistance ----------
export interface PersistedStateV1 {
  readonly version: 1;
  readonly pattern: Pattern;
  readonly bass: BassParams;
  readonly drums: DrumParams;
  readonly mix: MixParams;
  readonly transport: TransportParams;
  readonly generator: GeneratorParams;
}
```

```ts
// ---------- Commandes (commands.ts) ----------
export type Command =
  | { type: 'transport/play' }
  | { type: 'transport/stop' }
  | { type: 'transport/setBpm'; bpm: number }
  | { type: 'transport/setShuffle'; value: Normalized }
  | { type: 'transport/setSidechain'; patch: Partial<SidechainParams> }
  | { type: 'pattern/setStep'; index: StepIndex; patch: Partial<Step> }
  | { type: 'pattern/toggleStepFlag'; index: StepIndex; flag: 'accent' | 'slide' | 'rest' }
  | { type: 'pattern/setDrumVelocity'; voice: DrumVoiceId; index: StepIndex; velocity: Velocity }
  | { type: 'pattern/replace'; pattern: Pattern }
  | { type: 'pattern/clearBass' }
  | { type: 'pattern/clearDrums' }
  | { type: 'bass/setWaveform'; waveform: BassWaveform }
  | { type: 'bass/setKnob'; knob: BassKnobId; value: Normalized }
  | { type: 'drums/setMuted'; voice: DrumVoiceId; muted: boolean }
  | { type: 'drums/setLevel'; voice: DrumVoiceId; value: Normalized }
  | { type: 'mix/set'; patch: Partial<MixParams> }
  | { type: 'generator/setParams'; patch: Partial<GeneratorParams> }
  | { type: 'generator/run' }
  | { type: 'generator/undo' };
```

```ts
// ---------- API publique du moteur (index.ts) ----------
export interface Engine {
  /** À appeler depuis un geste utilisateur : crée/reprend l'AudioContext. */
  unlock(): Promise<void>;
  dispatch(command: Command): void;
  getState(): EngineState;
  subscribe(listener: (state: EngineState) => void): () => void;
  /** Lecture par l'UI (rAF) : pas audible à l'instant courant, null si arrêté. */
  audibleStep(): StepIndex | null;
  dispose(): void;
}

export interface EngineOptions {
  readonly createContext?: AudioContextFactory; // injecté pour test / offline
  readonly visibility?: VisibilitySource; // Page Visibility, fake en test
  readonly timer?: TimerSource; // worker par défaut, fake en test
  // storage?: StorageAdapter — lot 7 : localStorage par défaut, mémoire en test
}
```

**Plan d'automation (interne, clé de la testabilité)** : `bass-plan.ts` ne
touche pas Web Audio. Il prend `{ step, held, params, time, stepDuration }`, où
`held` est fourni par la voix (voir lot 4), et retourne une liste de `ParamEvent`
`{ target: 'frequency' | 'filterDetune' | 'filterQ' | 'vca', kind: 'cancel' | 'set' | 'target', time, value?, timeConstant? }`.
Le knob cutoff écrit la `frequency` du filtre et l'enveloppe son `detune` en
cents : les deux ne se battent jamais. `bass-voice.ts` applique ces événements
aux `AudioParam`. Les sémantiques accent / slide / liaison sont donc testables
par assertions sur des données.

---

## 5. Découpage en lots livrables

Chaque lot se termine sur un état **jouable dans le navigateur**, avec CI
verte, et fait l'objet d'un ou plusieurs commits (sur demande). Difficulté :
★ faible, ★★ moyenne, ★★★ élevée.

### Lot 0 — Socle et premier son ★

- Scaffold Vite + Svelte 5 + TS strict, pnpm, ESLint/Prettier/Stylelint/svelte-check, Vitest.
- `tokens.css` initial (palette neutre provisoire), `base.css`, règle Stylelint.
- Règle de frontière `no-restricted-imports` sur `src/engine`.
- `audio/context.ts` : création paresseuse + unlock sur geste, état `AudioInfo`.
- `AudioGate.svelte` : overlay de démarrage.
- CI + déploiement Pages.
- README avec les principes d'architecture (scheduler, frontière, thématisation).
- **On entend** : un son de test (oscillateur bref) après le premier tap. Démo en ligne.

### Lot 1 — Horloge, transport, tête de lecture ★★

- Types du modèle (§4), `defaults.ts`, `constants.ts`, reducers de `state.ts` pour le transport.
- `timing.ts` (pur) : durée de pas, offset de shuffle sur les 16es impairs.
- `worker-timer.ts` + `scheduler.ts` : boucle à lookahead avec `SCHEDULE_INTERVAL_MS` et `SCHEDULE_AHEAD_S` nommées ; changement de tempo pris au pas suivant.
- `playhead-queue.ts` + `playhead.svelte.ts` (rAF, compensation `outputLatency`).
- `Transport.svelte` : play/stop, tempo, shuffle. Barre d'espace.
- Un « clic » de métronome synthétisé (très court) sur chaque pas, accent sur le temps 1, pour entendre la grille.
- **On entend** : un métronome à 16es, shuffle audible, curseur visuel calé sur le son.
- C'est le lot fondateur : tout ce qui suit s'y branche.

### Lot 2 — Le knob et le geste ★★

- `knob-drag.ts` (action Svelte) : Pointer Events, `setPointerCapture`, `touch-action: none`, drag vertical avec sensibilité constante, mode fin (Shift), double-clic = valeur par défaut, flèches clavier, focus visible.
- `Knob.svelte` : rendu SVG piloté par tokens (rayon, couleur, largeur d'arc), étiquette et valeur affichée via une fonction de formatage injectée.
- Écriture immédiate dans l'AudioParam via `setTargetAtTime` avec `KNOB_SMOOTHING_S` (anti-zipper).
- Branché sur le son de test du lot 0 (hauteur, volume) pour valider le ressenti avant le vrai synthé.
- **On entend** : un knob qui répond sans latence perceptible, à la souris et au doigt.

### Lot 3 — La voix basse ★★★

- `graph.ts` : bus basse → bus master ; `filter-stage.ts` (biquad lowpass).
- `bass-voice.ts` : un oscillateur **persistant** (jamais stoppé pendant la lecture), filtre, VCA, `drive.ts` (pré-gain + WaveShaper tanh à courbe fixe, `oversample: '2x'`).
- `bass-plan.ts` : notes, octaves, silences, gate `GATE_RATIO`, enveloppe de filtre à decay seul (`setTargetAtTime`), enveloppe d'amplitude fixe.
- `mapping.ts` : courbes cutoff (exponentielle, `CUTOFF_MIN_HZ`–`CUTOFF_MAX_HZ`), résonance (Q d'un passe-bas en dB, linéaire sur le knob, borné par `RESONANCE_Q_MAX_DB`), decay (constante de temps exponentielle, `DECAY_MIN_S`–`DECAY_MAX_S`), env mod, drive.
- `BassSequencer.svelte` / `StepCell.svelte` : édition note / octave / silence.
- `BassPanel.svelte` : sawtooth/square + les 7 knobs.
- **On entend** : une ligne de basse séquencée, filtre et decay jouables en direct.

### Lot 4 — Accent et slide ★★★

- Accent dans `bass-plan.ts` : pic de VCA, ouverture de filtre supplémentaire, résonance poussée par `accentedQ` (poussée additive en dB, bornée par `RESONANCE_Q_MAX_DB`), décroissance du filtre fixée au plus court (`ACCENT_ENV_DECAY_S`) ; profondeur par le knob accent.
- Slide : glissé exponentiel de fréquence (`setTargetAtTime`, constante `SLIDE_TAU_S`, qu'aucun pas suivant ne peut effacer), **sans** événement d'enveloppe ; la liaison est décidée par la voix d'après ce qu'elle a réellement joué ; note tenue jusqu'au prochain pas joué (liaison à travers les silences) ; gestion du bouclage 15 → 0.
- Drapeaux accent / slide dans `StepCell.svelte`.
- Cas limites documentés et testés : slide sur le dernier pas, chaîne de slides, accent + slide, tous les pas en silence.
- Décisions prises en revue (PR #4) :
  - **La liaison se décide d'après ce que la voix a joué**, pas d'après le pattern : la voix retient si la dernière note jouée portait un slide, un silence ne change rien, `release` remet à zéro. Déduire la tenue du pattern rend une note muette (slide sur le pas 15 puis play, stop puis play, pattern d'un seul pas slidé). Le glissé part de la hauteur qui sonne.
  - **Un événement futur d'un pas ne compte pas survivre au `cancel` du pas suivant.** Le créneau jusqu'au prochain onset descend à `D·(1 − SHUFFLE_MAX_RATIO)` pour un 16e impair à shuffle maximal. Un événement plus lointain se pose au temps du pas sous forme de `setTargetAtTime`, ou se borne par le créneau réel.
  - **Un retour « à la valeur du knob » programmé par un plan appartient à la voix** : la valeur est figée une fenêtre de lookahead plus tôt, donc la voix garde la dernière valeur du knob et reprogramme le retour quand le knob bouge, sans `cancel`. `release` ramène les paramètres au knob et remet l'état de la voix à zéro.
- Préréglage acid au démarrage (`defaults.ts`) ; `DEFAULT_BASS` exporté par `@engine` pour les valeurs par défaut du panneau.
- **On entend** : le phrasé acid caractéristique.

### Lot 5 — Rythmique et sidechain ★★

- `noise.ts` (buffer généré), `kick.ts` (sinus + enveloppe de pitch), `clap.ts` (bruit filtré + rafale de retriggers + queue), `hihat.ts` (bruit passe-haut, decay court/long, choke).
- `drum-plan.ts` : vélocité → amplitude et légère variation de decay.
- Nœuds source créés **par frappe** et arrêtés à `t + durée`.
- `sidechain.ts` : GainNode sur le bus basse, automation programmée à chaque kick non muté (`SIDECHAIN_ATTACK_S`, `SIDECHAIN_RELEASE_S`, profondeur = amount).
- `DrumGrid.svelte`, `DrumPanel.svelte` (mute, niveau), interrupteur + knob sidechain dans le transport, `mix` (basse, rythmique, master).
- Décisions prises à l'implémentation :
  - **Les frappes qui sonnent sont suivies par le kit** jusqu'à `ended`, puis oubliées. Sans ce registre, une frappe déjà programmée dans la fenêtre de lookahead partirait après le stop, et le choke ne saurait pas quel hat ouvert couper. Le stop coupe tout par une constante de temps courte (`DRUM_CUT_TAU_S`) ; une frappe pas encore partie est arrêtée avant son départ et ne sonne pas.
  - **Le choke se décide d'après ce qui sonne**, comme la liaison au lot 4 : toute frappe de hat, fermé ou ouvert, coupe les hats ouverts du registre.
  - **Niveau et mute par voix sur une tranche persistante de deux gains** : le niveau, lissé et immédiat, agit sur la queue en cours ; le mute a son propre gain, pour qu'un knob tourné pendant qu'un mute attend la mesure ne l'avance jamais. Une voix mutée ne crée en plus aucun nœud.
  - **Un mute ou un démute en lecture attend le début de la mesure suivante** (retour d'écoute). L'état distingue le mute demandé (`drums[v].muted`) du mute entendu (`appliedMutes`) ; au pas 0, le moteur recopie l'un dans l'autre et programme le gain de mute au temps de ce pas. Le mute coupe les queues par `DRUM_CUT_TAU_S`, le démute saute à 1 pour garder l'attaque du temps (la tranche mutée est silencieuse). À l'arrêt, le mute est immédiat. L'interrupteur clignote tant que les deux diffèrent ; le clignotement s'arrête quand le pas 0 est programmé, jusqu'à une fenêtre de lookahead plus la latence de sortie avant de l'entendre.
  - **Le sidechain est un gain dédié entre le bus basse et le master**, séparé du niveau de mix de la basse : le knob et le ducking n'écrivent jamais sur le même AudioParam. La remontée est posée `SIDECHAIN_HOLD_S` après le kick, sous le plus court créneau entre deux pas, et le kick suivant l'annule par un `cancel`.
- Groove house par défaut (`defaults.ts`) : kick sur les temps, clap sur 2 et 4, hat ouvert entre les temps, étouffé par le hat fermé suivant.
- **On entend** : le groove complet, la basse qui « pompe » sous le kick.

### Lot 6 — Générateur de patterns ★★

- `rng.ts` seedable, `scales.ts`.
- `acid-generator.ts` : tonique sur le pas 0, notes contraintes à la gamme, densités notes / accents / slides / sauts d'octave, quelques heuristiques de plausibilité (pas de slide vers un silence isolé, répétitions de tonique favorisées, sauts d'octave sur les notes de la gamme).
- Commandes `generator/run` et `generator/undo`, `GeneratorPanel.svelte`.
- **On entend** : une nouvelle ligne crédible à chaque pression, retour arrière possible.

### Lot 7 — Persistance, robustesse, finition ★

- `serialize.ts` versionné + `storage.ts` ; sauvegarde debounced à chaque commande, restauration au démarrage.
- Passe iOS / Safari réelle (voir §7) : interruption, verrouillage d'écran, latence.
- Tests navigateur `OfflineAudioContext` (§6).
- Mise en page desktop / tablette paysage finale, vérification tactile de la grille.
- README complet, capture d'écran, lien de la démo.
- **On entend** : la même chose qu'au lot 6, mais l'état survit au rechargement et l'app tient sur iPad.

Ordre alternatif possible : le lot 5 (rythmique) peut passer avant le lot 4
si l'on veut un groove complet plus tôt ; les deux sont indépendants.

---

## 6. Stratégie de test

Principe : **séparer ce qui décide de ce qui touche Web Audio**. Tout ce qui
décide (quand, quelle valeur, quelle courbe) est pur et testé en node. Ce qui
touche Web Audio est mince et testé soit contre des fakes, soit en rendu réel
hors ligne.

### 6.1 Tests unitaires purs (Vitest, node) — la majorité

| Module                                                                    | Ce qu'on vérifie                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timing.ts`                                                               | durée de pas pour plusieurs BPM ; offsets de shuffle uniquement sur les 16es impairs, bornés par `SHUFFLE_MAX_RATIO`, nuls à shuffle 0                                                                                                                                                                                                                                                                                            |
| `scheduler.ts` (avec `FakeClock` + `FakeTimer` + collecteur d'événements) | chaque tick programme exactement les pas dont le temps tombe dans `[now, now + SCHEDULE_AHEAD_S[` ; aucun pas programmé deux fois ; aucun pas manqué si le timer est en retard (rattrapage) ; **absence de dérive** sur 1000 pas (temps du pas n = t0 + n·durée, à l'epsilon près) ; changement de tempo appliqué au pas suivant sans saut ; stop vide la file et réinitialise                                                    |
| `playhead-queue.ts`                                                       | l'étape audible est la dernière dont `time + latency ≤ now` ; les événements passés sont purgés ; retourne null à l'arrêt                                                                                                                                                                                                                                                                                                         |
| `bass-plan.ts`                                                            | note + octave → fréquence attendue (le tuning passe par `applyParams`) ; silence → aucun événement ; **pas tenu → glissé `setTargetAtTime` au temps du pas et aucun événement d'enveloppe ni de Q** ; pas qui slide → VCA laissé ouvert ; accent → valeurs de pic supérieures sur VCA, cutoff et Q ; pas sans accent → Q intact ; `timeConstant` > 0 ; temps croissants au sens large par cible, `cancel` en tête de chaque cible |
| `drum-plan.ts`                                                            | vélocité 0 → rien ; amplitudes monotones en vélocité                                                                                                                                                                                                                                                                                                                                                                              |
| `sidechain.ts` (partie pure)                                              | événements de ducking aux temps des kicks non mutés ; désactivé → rien                                                                                                                                                                                                                                                                                                                                                            |
| `mapping.ts`                                                              | bornes (0 → min, 1 → max), monotonie, cutoff exponentiel, résonance linéaire en dB, `accentedQ` à poussée constante et borné                                                                                                                                                                                                                                                                                                      |
| `acid-generator.ts`                                                       | déterminisme à seed égale ; pas 0 = tonique ; toutes les notes dans la gamme ; densités observées dans une tolérance sur 200 tirages ; densité 0 → aucun drapeau ; densité 1 → tous                                                                                                                                                                                                                                               |
| `state.ts` (reducers)                                                     | chaque commande produit l'état attendu, immuabilité (le snapshot précédent n'est pas muté), clamping des valeurs hors borne                                                                                                                                                                                                                                                                                                       |
| `serialize.ts`                                                            | aller-retour JSON, rejet d'un payload corrompu (retour aux défauts), champ `version`                                                                                                                                                                                                                                                                                                                                              |

### 6.2 Tests contre des fakes (Vitest, node)

- `tests/fakes/FakeAudioContext` : enregistre les créations de nœuds et les appels
  aux `AudioParam` (`setValueAtTime`, rampes…). Permet de vérifier que
  `bass-voice.ts` applique le plan fidèlement, que les drums créent un nœud par
  frappe et appellent `stop`, et qu'aucune rampe exponentielle ne reçoit 0.
- Test de frontière : le lint suffit, mais un test explicite qui importe
  `@engine` dans un contexte sans DOM ni Svelte (node pur) garantit qu'aucune
  dépendance n'a fui.

### 6.3 Tests de composants (Vitest + happy-dom + @testing-library/svelte)

- `Knob.svelte` : séquence pointerdown / pointermove / pointerup → dispatch avec
  valeurs clampées ; Shift = sensibilité réduite ; double-clic = défaut ;
  flèches clavier ; attributs ARIA (`role="slider"`, `aria-valuenow`).
- `StepCell.svelte` / `DrumGrid.svelte` : clics → commandes attendues.
- Le pont `engine.svelte.ts` avec un moteur factice : un snapshot publié se
  reflète dans le composant.

### 6.4 Tests de rendu audio réel (Vitest browser mode, Chromium, lot 7)

Peu nombreux, marqués lents, exécutés en CI avec Playwright :

- rendre 1 mesure dans un `OfflineAudioContext` (le moteur accepte
  `createContext` injecté et un mode « tout programmer d'un coup ») ;
- assertions sur le signal : RMS non nul pendant une note, quasi nul pendant
  un silence ; pic plus élevé sur un pas accentué ; estimation de hauteur par
  zéro-crossing en début et en fin d'un pas slidé ; kick présent sur le pas 0.
- Ces tests sont aussi le socle de l'export WAV de v4.

### 6.5 Ce qui reste à l'oreille

Une checklist manuelle par lot dans le README (« écouter : pas de clic à
l'arrêt, pas de zipper au knob, shuffle sensible, sidechain visible »).
Le rendu musical final n'est pas automatisable ; le plan vise à ce que **tout
ce qui est logique** le soit.

---

## 7. Risques techniques et parades

| Risque / piège                                                                                                                                                                                      | Parade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AudioContext bloqué avant interaction** (autoplay policy)                                                                                                                                         | Création **paresseuse** de l'AudioContext dans un gestionnaire de geste (`pointerup`/`click`, pas `pointermove`), `await resume()`, et sur iOS lecture d'un buffer silencieux d'un échantillon pour « ouvrir » la sortie. `AudioGate.svelte` masque l'app tant que `availability !== 'running'`. Toute commande `transport/play` reçue avant déblocage appelle `unlock()` d'abord.                                                                                                                                            |
| **iOS / Safari** : contexte passé en `interrupted` (appel, Siri, verrouillage), sampleRate 48 kHz vs 44,1 kHz, `outputLatency` absent, timers throttlés en arrière-plan, scroll qui capture le drag | Écouter `statechange` et `visibilitychange`, retenter `resume()` au retour au premier plan, exposer l'état dans `AudioInfo` pour que l'UI affiche « tap pour reprendre ». Ne jamais coder en dur la fréquence d'échantillonnage. `outputLatency ?? baseLatency ?? 0`. `touch-action: none` + `setPointerCapture` sur les knobs et cellules. Passe de test réelle sur iPad au lot 7. Le bouton silencieux matériel coupant Web Audio sur d'anciennes versions est documenté, pas contourné.                                    |
| **Rampes exponentielles et zéro** (`exponentialRampToValueAtTime(0)` lève une exception ; une valeur de départ à 0 ne rampe pas)                                                                    | Constante `MIN_GAIN = 1e-4` (≈ −80 dB), jamais 0 sur un `AudioParam` rampé exponentiellement, et toute rampe précédée d'un `setValueAtTime` d'ancrage. La voix basse n'emploie aucune rampe : enveloppes et glissé passent par `setTargetAtTime`, qui part de la valeur courante et tolère une cible 0. Le faux AudioContext lève sur une rampe exponentielle vers ≤ 0.                                                                                                                                                       |
| **Nœuds source non réutilisables** (`OscillatorNode`, `AudioBufferSourceNode` : un seul `start`, un seul `stop`)                                                                                    | Basse : **un oscillateur persistant** démarré au premier play et jamais stoppé pendant la session ; le silence vient du VCA. Drums : un nœud **par frappe**, `stop(t + durée)`, déconnexion à `ended` ; le kit ne garde la frappe que jusqu'à `ended`, pour le stop et le choke (lot 5). Interdiction de créer des nœuds dans la boucle rAF.                                                                                                                                                                                  |
| **Timers throttlés en onglet caché** → trous dans la programmation                                                                                                                                  | Timer dans un **Web Worker** (`TimerSource`) ; `SCHEDULE_AHEAD_S` suffisamment large pour absorber un tick en retard ; le scheduler rattrape tous les pas dus plutôt que d'en sauter.                                                                                                                                                                                                                                                                                                                                         |
| **Automations qui se chevauchent** (tempo élevé, slide + accent, knob tourné pendant une enveloppe)                                                                                                 | Avant chaque pas, `cancelScheduledValues(tStep)` sur chaque cible touchée puis ré-ancrage par `setValueAtTime` ou par un `setTargetAtTime` qui part de la valeur courante (on connaît le plan, donc pas besoin de `cancelAndHoldAtTime`, absent de Firefox). Les pas sans accent ne touchent pas à Q. Les knobs écrivent via `setTargetAtTime` avec une petite constante de lissage, ce qui se compose avec les enveloppes ; un retour au knob programmé par un plan est reprogrammé par la voix quand le knob bouge (lot 4). |
| **Programmation dans le passé** (tick en retard)                                                                                                                                                    | `tSafe = max(t, currentTime + SCHEDULE_EPSILON_S)` dans `params.ts`. Test de rattrapage du scheduler.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Événement d'un pas effacé par le pas suivant** (shuffle, tempo élevé)                                                                                                                             | Aucun événement posé au-delà du créneau réel jusqu'au prochain onset, qui descend à `D·(1 − SHUFFLE_MAX_RATIO)` ; sinon, poser l'événement au temps du pas en `setTargetAtTime` (lot 4).                                                                                                                                                                                                                                                                                                                                      |
| **Clics à l'arrêt** ou au changement de forme d'onde                                                                                                                                                | Stop = `release` : annulation des événements futurs, VCA refermé par `setTargetAtTime` (`STOP_RELEASE_TAU_S`), Q ramené au knob ; un glissé en cours continue sans saut ; `osc.type` modifiable à chaud sans recréer le nœud.                                                                                                                                                                                                                                                                                                 |
| **Zipper noise** sur les knobs                                                                                                                                                                      | `setTargetAtTime` systématique (jamais `.value =` sur un paramètre audible), constante `KNOB_SMOOTHING_S`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Coût de régénération de la courbe de WaveShaper** à chaque mouvement du knob drive                                                                                                                | Courbe tanh **fixe** ; le knob pilote un pré-gain (AudioParam lissé) et un post-gain de compensation.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Biquad instable** à Q élevé + cutoff automatisé vite                                                                                                                                              | Q du passe-bas en dB, borné par `RESONANCE_Q_MAX_DB` dans `mapping.ts`, accent compris (`accentedQ`). C'est aussi la motivation du filtre en échelle v2 ; l'interface `FilterStage` est prête dès v1.                                                                                                                                                                                                                                                                                                                         |
| **Édition d'un pas déjà programmé**                                                                                                                                                                 | Latence ≤ lookahead assumée (H12).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Fuite de dépendance UI dans le moteur**                                                                                                                                                           | Lint de frontière + test d'import en node pur.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Littéraux visuels dans les composants**                                                                                                                                                           | Stylelint interdit couleurs / rayons / tailles hors `tokens.css`.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **GitHub Pages** : chemin de base, 404 sur le worker                                                                                                                                                | `base` Vite configuré depuis une variable d'environnement en CI ; worker chargé via `new URL(..., import.meta.url)` pour que Vite le hache et le résolve correctement.                                                                                                                                                                                                                                                                                                                                                        |

---

## 8. Roadmap ultérieure (esquisse)

- **v2 — Filtre en échelle saturant (AudioWorklet)** : implémentation de
  `FilterStage` en worklet (modèle Huovilainen ou Stilson-Smith avec saturation
  tanh par étage, oversampling ×2), sélecteur biquad / ladder dans
  `BassPanel`, comparaison à l'oreille. Préparé en v1 par l'interface
  `FilterStage` et par le fait que cutoff / résonance sont déjà des
  `AudioParam` abstraits.
- **v3 — Banque, enregistrement, chaînage** : `persistence` étendu à N slots
  nommés, champ `length` sur `Pattern`, enregistrement temps réel par capture
  de commandes horodatées (le journal de commandes est un sous-produit naturel
  de `dispatch`), chaînage par liste de patterns dans le transport.
- **v4 — Export WAV, partage par URL, Web MIDI** : le moteur rendu dans un
  `OfflineAudioContext` (déjà nécessaire pour les tests du lot 7), encodage
  WAV, sérialisation compacte de `PersistedState` en base64url dans le hash
  d'URL, Web MIDI mappé sur les commandes (`bass/setKnob` via CC, notes vers
  la séquence).

---

## Vérification de fin de v1

1. `pnpm typecheck && pnpm lint && pnpm stylelint && pnpm test` verts en local et en CI.
2. Démo Pages : premier tap → son ; play → métronome absent, groove complet ; les 7 knobs répondent au drag et au doigt ; curseur calé sur le son (vérifier à 60 et 240 BPM).
3. Scénarios d'écoute : slide sur le dernier pas vers le premier ; chaîne de slides à travers des silences ; accent seul ; sidechain à amount max ; stop en plein slide (pas de clic).
4. Rechargement de la page : pattern et knobs restaurés.
5. iPad Safari : déblocage, verrouillage / déverrouillage de l'écran, reprise ; drag des knobs sans scroll de page.
6. Onglet caché 30 s puis retour : la lecture n'a pas décroché.

---

## Dette et points ouverts

Écarts connus entre le code et ce plan, et points remontés en revue sans être
tranchés. On retire une ligne dans la PR qui la corrige. La revue les signale en
« Hors périmètre » quand une PR passe à côté, et les suggère quand elle touche le
fichier.

**Dette**

- README : la liste « À écouter à chaque lot » ne couvre que les lots 0 et 5, alors que §6.5 promet une checklist par lot ; celles des lots 1 à 4 vivent dans les descriptions de PR.
- `main` n'est pas protégée et `pnpm verify` ne lance pas `pnpm build`, que seule la CI exécute.

**Points ouverts**

- `StepCell.svelte` : la hauteur est quantifiée mais le geste relit la valeur quantifiée à chaque événement ; un drag lent ou une flèche ne change jamais la note, Shift est inopérant.
- Gate calculé sur la durée nominale du pas alors que le temps inclut le shuffle : au-delà d'un shuffle de 0,9, la fermeture d'un 16e impair tombe après l'attaque du pas suivant, qui l'efface.
- `safeTime` appliqué événement par événement écrase les durées d'un pas très en retard : attaque et relâchement tombent au même instant et la note est avalée.
- `App.svelte` : la garde `[role="slider"]` neutralise la barre d'espace après tout geste, `knobDrag` posant le focus sur le slider (H11).
- Le plancher `MIN_GAIN` est inutile sous `setTargetAtTime`, et son résidu est amplifié par le drive.
- Deux accents dans la même fenêtre de lookahead : le retour de Q du premier reste figé pendant au plus un pas.
- `StepCell.svelte` : boutons A et S sous `--control-size` ; « tenu » absent sur les silences traversés par un slide et non annoncé aux lecteurs d'écran ; `~` affiché au-dessus de la note ; `.flag.on` déclaré deux fois.
- `constants.ts` : `ACCENT_Q_ATTACK_TAU_S` et `ACCENT_Q_HOLD_S` sans commentaire d'intention.
- `DrumGrid.svelte` : la colonne des noms décale la grille rythmique par rapport à la séquence basse ; alignement des deux grilles à reprendre avec la mise en page du lot 7.
- Hat fermé et hat ouvert sur le même pas : les deux sonnent, le hat ouvert étant déclenché après le fermé ; à trancher si l'on veut que le fermé l'emporte.
