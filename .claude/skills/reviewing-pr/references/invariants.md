# Invariants d'acid-box pour la revue

<!-- forged-by: forging-review-skill · 2026-09-23 · commit 577e06d · sources : README.md, docs/PLAN.md, eslint.config.js, .stylelintrc.json, tsconfig.app.json, code de main -->

Des règles, pas une photo du code. Chaque règle cite sa source dans `README.md`,
`docs/PLAN.md` (décisions, hypothèses H1 à H12, risques §7, décisions du lot 4) ou les
configs d'outillage. Les valeurs vivent dans `src/engine/model/constants.ts` et
`src/ui/theme/tokens.css`, l'état des lots dans le README, la dette et les points ouverts
dans la section « Dette et points ouverts » de `docs/PLAN.md` : les relire à la version
revue plutôt que de s'en souvenir. État au 2026-09-23 ; le code et le plan font foi.

Chaque invariant donne : la règle, sa source, comment le vérifier sur une PR, et la
sévérité si la PR le viole. La mention « Outillage » indique ce qui est déjà garanti par
la CI : ne pas le revérifier, ne pas le commenter.

Identifiants stables pour citer un invariant dans un finding : `A1`, `C2`, etc. Les sections
A et C0 sont transverses : les lire quel que soit le domaine revu.

---

## Repères temporels

Les findings de timing comparent des durées. Les calculer à partir des constantes lues à
la version revue, aux tempos extrêmes `BPM_MIN` et `BPM_MAX` :

| Grandeur                                        | Formule                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Durée d'un pas D (double-croche)                | `stepDurationSeconds(bpm)` = 60 / bpm / 4                                     |
| Gate d'un pas                                   | `GATE_RATIO` · D                                                              |
| Retard d'un 16e impair                          | shuffle · `SHUFFLE_MAX_RATIO` · D                                             |
| Créneau minimal jusqu'au prochain onset         | D · (1 − `SHUFFLE_MAX_RATIO`), 16e impair à shuffle 1, calculé à `BPM_MAX`    |
| Fenêtre de programmation                        | `SCHEDULE_AHEAD_S`, réveil `SCHEDULE_INTERVAL_MS`, retard toléré `MAX_LATE_S` |
| Constantes de temps (`*_TAU_S`, decay, lissage) | τ : 63 % de la cible à τ, 95 % à 3τ, 99 % à 5τ                                |
| Transition visuelle `--duration-fast`           | à comparer à D à `BPM_MAX` pour tout état piloté par la tête de lecture       |

---

## A — Frontière moteur / interface

Source : README « Le moteur ne connaît pas l'interface », PLAN §3 « Frontière rendue
explicite et vérifiée ».

### A1 — Le moteur n'importe rien de Svelte ni de `src/ui`

- Outillage : ESLint `no-restricted-imports` sur `src/engine/**`. Acquis si la CI est verte.
- Vérifier seulement que la CI a tourné.

### A2 — Le moteur ne touche ni `document`, ni `window`, ni `navigator` hors de `audio/context.ts` et du worker

- Pourquoi : le moteur doit rester rendable dans un `OfflineAudioContext` (tests du lot 7,
  export WAV v4).
- Outillage : **non couvert** par le lint.
- Vérifier : `grep -nE '\b(document|window|navigator|localStorage|requestAnimationFrame)\b'`
  sur les fichiers `src/engine/**` du diff. Exceptions : `audio/context.ts`,
  `clock/timer.worker.ts`, et `persistence/storage.ts` au lot 7 pour `localStorage`.
- Sévérité : Bloquant — Form.

### A3 — Un seul fichier de l'interface instancie le moteur

- Règle : `createEngine()` n'est appelé que dans `src/ui/state/engine.svelte.ts`. Les
  composants reçoivent des tranches de snapshot et `dispatch` en props.
- Vérifier : `grep -rn 'createEngine(' src/ui` ne doit sortir que ce fichier et ses tests.
- Sévérité : Bloquant — Form.

### A4 — L'interface ne connaît que l'API publique `@engine`

- Règle : l'UI importe depuis `@engine` (c'est `src/engine/index.ts`), pas depuis
  `@engine/…`. Ce qu'un composant a besoin d'afficher ou de convertir est ré-exporté par
  `index.ts` : relire ses ré-exports à la version revue.
  Une valeur par défaut recopiée dans un composant faute d'export est un manque d'export,
  pas une raison de la recopier. Les tests et `tests/fakes` peuvent importer les internes.
- Vérifier : `grep -rn "from '@engine/" src/ui` sur le diff.
- Sévérité : Suggestion — Form. Bloquant si l'import court-circuite `dispatch` pour muter
  l'état ou programmer du son depuis l'interface.

### A5 — Le reducer décide, `index.ts` fait les effets

- Règle : `state.ts` est pur, sans effet. Tout effet (démarrer le scheduler, écrire un
  AudioParam, créer un nœud) vit dans `index.ts` ou dans les modules qu'il pilote. Une
  nouvelle commande a trois volets : sa variante dans l'union `Command`, son `case` dans
  `reduce`, et si elle a un effet audible, son routage dans le `switch` de `dispatch`.
- Outillage : l'exhaustivité du `switch` du reducer est garantie par le typage ; **le
  routage des effets dans `dispatch` ne l'est pas**, la branche `default` avale tout.
- Vérifier : pour chaque nouveau `type` de commande à effet audible (`drums/*`, `mix/*`,
  `bass/*`, `transport/setSidechain`…), retrouver le `case` correspondant dans `dispatch`
  et l'appel au module audio (`graph`, `voice`, futur `drums`).
- Sévérité : Bloquant — Purpose si l'effet manque (la commande change l'état sans changer
  le son).

---

## B — Horloge, scheduler, tête de lecture

Source : README « Aucun son n'est déclenché par un timer du navigateur » et « La tête de
lecture affiche ce qui s'entend », PLAN §7 lignes « Timers throttlés », « Programmation
dans le passé », « Édition d'un pas déjà programmé », H10, H12.

### B1 — Aucun événement audio déclenché par un timer du navigateur

- Outillage : ESLint interdit `setTimeout`/`setInterval` dans `src/engine` hors
  `timer.worker.ts` et tests.
- **Non couvert** : `window.setTimeout`, `globalThis.setTimeout`, `self.setTimeout` (la
  règle `no-restricted-globals` ne voit que les identifiants nus), `requestAnimationFrame`,
  `queueMicrotask`, `await` sur une promesse temporisée, `performance.now()` ou
  `Date.now()` utilisés pour décider d'un temps audio.
- Vérifier : dans le diff moteur, tout appel `start(`, `stop(`, `setValueAtTime(`,
  `setTargetAtTime(`, rampe, ou `connect(` doit être atteint depuis `onStep` du scheduler,
  depuis une commande `dispatch`, ou depuis l'initialisation, et son temps doit dériver
  de `ctx.currentTime` ou du temps de pas fourni par le scheduler.
- Sévérité : Bloquant — Reliability.

### B2 — Tout événement est programmé dans le futur via `safeTime`

- Règle : un tick en retard peut demander un temps déjà passé ; `safeTime(ctx, t)` le
  décale de `SCHEDULE_EPSILON_S` après `currentTime`. `bass-voice.apply` le fait pour tous
  les événements d'un plan ; `release` aussi. Toute nouvelle voix (drums, sidechain) fait
  pareil.
- Point ouvert (PLAN, « Dette et points ouverts ») : appliqué événement par événement,
  `safeTime` écrase les durées d'un pas très en retard. Ne pas exiger de solution, mais
  signaler tout nouveau code qui hérite du même comportement.
- Vérifier : chaque site d'écriture d'AudioParam ou de `source.start(t)` dans une nouvelle
  voix passe par `safeTime` ou reçoit un temps qui en vient.
- Sévérité : Bloquant — Edge.

### B3 — Le scheduler reste la seule source de vérité du temps musical

- Règle : boucle à lookahead avec `SCHEDULE_INTERVAL_MS` et `SCHEDULE_AHEAD_S` nommées ;
  tempo et shuffle relus à chaque pas ; rattrapage des pas dus jusqu'à `MAX_LATE_S`
  au-delà duquel les pas sont sautés sans perdre la phase ; `start` idempotent ; `stop`
  arrête le timer. Les tests §6.1 « scheduler » (fenêtre, doublons, rattrapage, dérive sur
  1000 pas, tempo, stop) doivent survivre à toute modification.
- Vérifier : si `scheduler.ts` ou `timing.ts` change, les tests correspondants changent
  de façon cohérente et aucun n'est retiré. Un nouveau consommateur du temps (drums,
  sidechain) se branche sur `onStep`, pas sur un second timer.
- Sévérité : Bloquant — Reliability.

### B4 — La tête de lecture affiche ce qui s'entend

- Règle : l'affichage compare les temps programmés au temps courant moins
  `outputLatency` (`Engine.audibleStep`), dans une boucle rAF active seulement en lecture
  (`playhead.svelte.ts`). Rien de visuel n'est piloté par le scheduler ni par un
  `setTimeout`. Toute nouvelle grille (drums) lit le même `audibleStep`.
- Vérifier : aucun composant ne reçoit un « pas courant » venu d'ailleurs que
  `createPlayhead`.
- Sévérité : Bloquant — Purpose.

### B5 — Latence d'édition assumée, pas de re-planification

- Règle : H12. Éditer un pas déjà programmé prend effet au tour suivant, au plus une
  fenêtre de lookahead plus tard. On ne re-planifie pas.
- Vérifier : du code qui tente d'annuler et de reprogrammer des pas déjà envoyés à la
  suite d'une commande d'édition est de la complexité non justifiée.
- Sévérité : Suggestion — Form, à retirer sauf motivation écrite.

### B6 — Le timer vit dans un Web Worker chargé par `new URL(…, import.meta.url)`

- Pourquoi : throttling en onglet caché (H10) et hachage correct par Vite pour GitHub
  Pages (PLAN §7 dernière ligne).
- Vérifier : tout nouveau worker suit `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`.
- Sévérité : Bloquant — Reliability, le déploiement casse sinon.

---

## C — Web Audio : automation et nœuds

Source : PLAN §7 lignes « Rampes exponentielles et zéro », « Nœuds source non
réutilisables », « Automations qui se chevauchent », « Clics à l'arrêt », « Zipper noise »,
« Coût de régénération de la courbe », « Biquad instable », « iOS / Safari ».

### C0 — Unités et sémantiques Web Audio qu'aucun outil ne vérifie

- Source : la spécification Web Audio. Ce ne sont pas des règles du projet mais des faits
  que le typage ne porte pas : un `number` en dB ou en Q linéaire compile pareil.
- Vérifier : à chaque mapping, constante bornée, libellé affiché ou test de bornes qui
  touche l'une de ces grandeurs, confronter l'unité supposée par le code à celle de la
  spec. Une erreur d'unité est un bug démontrable, donc un Bloquant, même si le paramètre
  reste « borné ».

| Paramètre ou API                                  | Ce que la spec dit                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BiquadFilterNode.Q` pour `lowpass` et `highpass` | **en décibels** ; conversion interne 10^(Q/20). Pour `bandpass`, `notch`, `allpass`, `peaking`, Q est linéaire. Un « Q 18 » lowpass vaut 18 dB de bosse, soit environ 7,9 en Q linéaire |
| `detune` (oscillateur, filtre)                    | en cents ; 1200 cents = une octave, effet exponentiel sur la fréquence                                                                                                                  |
| `frequency`, `gain`                               | Hz et gain linéaire ; aucun paramètre n'est en dB sauf le `Q` ci-dessus                                                                                                                 |
| Temps des automations                             | secondes sur l'horloge de l'AudioContext, jamais des millisecondes                                                                                                                      |
| `setTargetAtTime(v, t, τ)`                        | approche `v` de façon asymptotique et ne l'atteint jamais exactement ; part de la valeur courante, tolère une cible 0                                                                   |
| `exponentialRampToValueAtTime(v, t)`              | `v` doit être strictement positif, sinon exception ; si la valeur de départ est 0 ou de signe opposé, aucune rampe : la valeur saute à `t`                                              |
| `linearRampToValueAtTime`                         | tolère 0                                                                                                                                                                                |
| `cancelScheduledValues(t)`                        | annule tous les événements dont le temps est **≥ t**, y compris ceux posés exactement à `t` par un pas précédent                                                                        |
| Deux événements au même temps                     | s'appliquent dans l'ordre d'insertion ; `cancel` puis `set` puis `target` au même `t` est la séquence légitime de C3                                                                    |
| Valeur non finie (`NaN`, `Infinity`)              | exception sur toute méthode d'automation et sur `.value =`                                                                                                                              |
| `GainNode.gain`                                   | démarre à 1 : un nœud créé et connecté sans initialisation est audible                                                                                                                  |
| `OscillatorNode`, `AudioBufferSourceNode`         | un seul `start()`, un seul `stop()`, jamais redémarrés                                                                                                                                  |
| `AudioParam` hors plage nominale                  | la valeur est bornée silencieusement (fréquence de filtre entre 0 et Nyquist)                                                                                                           |

### C1 — Jamais `param.value =` sur un paramètre audible pendant que le son tourne

- Règle : les knobs et le mix écrivent via `smoothSet` (`setTargetAtTime` avec
  `KNOB_SMOOTHING_S`). La seule écriture directe tolérée est l'initialisation d'un nœud
  fraîchement créé, avant `start()` ou avant connexion, comme dans `createBassVoice` et
  `createDrive`.
- Vérifier : `grep -nE '\.value\s*='` sur le diff moteur ; chaque occurrence est à la
  création du nœud, sinon c'est un zipper.
- Sévérité : Bloquant — Reliability.

### C2 — Rampes : jamais vers ≤ 0, toujours ancrées, et évitées dans les plans

- Source : PLAN §7 « Rampes exponentielles et zéro ».
- Règle : les plans préfèrent `setTargetAtTime`, qui part de la valeur courante, tolère
  une cible 0 et, posé au temps du pas, survit au `cancel` du pas suivant (C12). Toute
  rampe a une valeur strictement positive (plancher `MIN_GAIN`, fréquence > 0), une ancre
  `set` sur la même cible à un temps ≤ au sien, et une échéance qui tient dans le créneau.
- Outillage : le faux AudioContext lève sur une rampe exponentielle vers ≤ 0, si un test
  exerce le chemin.
- Vérifier : `grep -nE "exponentialRamp|linearRamp|Ramp'"` sur le diff moteur ; chaque
  occurrence a sa valeur > 0, son ancre et son échéance (C12). Ne pas exiger d'ancre devant
  un `setTargetAtTime` : c'est justement ce qui le rend robuste.
- Sévérité : Bloquant — Edge.

### C3 — Avant chaque pas : `cancelScheduledValues` puis ré-ancrage

- Source : PLAN §7 « Automations qui se chevauchent ».
- Règle : chaque cible touchée par un pas commence par `cancel` à `time`, puis `set` ou
  `target`. Pas de `cancelAndHoldAtTime`, absent de Firefox. Les pas sans accent ne
  touchent pas à Q : le knob garde la main. Exception tolérée : sur un pas d'arrivée de
  slide, la fermeture du VCA sans `cancel`, le pas d'origine ayant annulé le VCA à son temps
  sans rien poser après.
- Vérifier : dans un plan, la première opération sur une cible pour un pas donné est un
  `cancel` ; lire la liste des cibles dans le `ParamTarget` du plan revu.
- Sévérité : Bloquant — Edge.

### C4 — Un knob ne cancel jamais, et garde le dernier mot sur les retours programmés

- Source : PLAN §7 « Automations qui se chevauchent », décisions du lot 4.
- Règle : les écritures de knob se composent avec les enveloppes grâce à
  `setTargetAtTime` ; un `cancelScheduledValues` depuis un gestionnaire de knob tuerait
  l'enveloppe du pas en cours. Un retour « à la valeur du knob » programmé par un plan est
  figé une fenêtre de lookahead plus tôt : la voix garde la dernière valeur du knob et
  reprogramme ce retour quand le knob bouge, sans `cancel`.
- Vérifier : `applyParams`, `applyMix`, `setAmount` et leurs équivalents ne contiennent que
  des `smoothSet`, plus ce retour reprogrammé ; tout nouvel événement de plan qui recopie la
  valeur d'un knob dans le futur a le même mécanisme.
- Sévérité : Bloquant — Reliability.

### C5 — Oscillateur de basse persistant, nœuds de drums par frappe

- Règle : la basse démarre un oscillateur au premier play et ne le stoppe qu'au
  `dispose` ; le silence vient du VCA. Les drums (lot 5) créent un nœud source **par
  frappe**, `start(t)`, `stop(t + durée)`, `disconnect` sur `ended`, aucune référence
  gardée. Interdiction de créer un nœud dans la boucle rAF ou dans un gestionnaire de
  pointer.
- Vérifier : aucun `oscillator.stop()` hors `dispose` ; dans une voix percussive, pas de
  réutilisation d'un `AudioBufferSourceNode` ; les buffers de bruit sont générés une fois.
- Sévérité : Bloquant — Reliability.

### C6 — Stop sans clic, forme d'onde à chaud

- Source : PLAN §7 « Clics à l'arrêt », décisions du lot 4.
- Règle : `release(time)` annule le futur sur toutes les cibles, referme le VCA par
  `setTargetAtTime(MIN_GAIN, t, STOP_RELEASE_TAU_S)`, ramène au knob tout paramètre qu'un
  `cancel` peut laisser « poussé » (Q après un accent) et remet à zéro l'état mémorisé par
  la voix. `osc.type` change sans recréer le nœud. Toute nouvelle voix expose un `release`
  appelé par `stop()` dans `index.ts`.
- Vérifier : `stop()` appelle le `release` de chaque voix ; aucun `gain.value = 0` ; tout
  nouvel état de voix est remis à zéro dans `release`.
- Sévérité : Bloquant — Edge.

### C7 — Filtre : `frequency` pour le knob, `detune` pour l'enveloppe, Q borné

- Règle : deux paramètres séparés pour que knob et enveloppe ne se battent jamais ;
  l'enveloppe est exponentielle en octaves via les cents. Q d'un passe-bas en dB, linéaire
  sur le knob (`resonanceToQ`), borné par `RESONANCE_Q_MAX_DB`, accent compris
  (`accentedQ`, poussée additive en dB). Le filtre passe par l'interface `FilterStage` (biquad v1, worklet
  v2).
- Vérifier : toute nouvelle modulation du filtre passe par `detune` ; aucun accès direct
  au `BiquadFilterNode` hors `filter-stage.ts` ; toute valeur de Q vient de `resonanceToQ`
  ou `accentedQ`, jamais d'un calcul local (C0 : le Q d'un lowpass est en dB).
- Sévérité : Suggestion — Form ; Bloquant si une modulation écrit `frequency` pendant la
  lecture.

### C8 — Courbe de WaveShaper fixe

- Règle : `makeTanhCurve` est appelée une fois à la création ; le knob drive pilote un
  pré-gain et un post-gain de compensation lissés.
- Vérifier : aucun `shaper.curve =` en dehors de `createDrive`.
- Sévérité : Bloquant — Reliability.

### C9 — iOS / Safari : rien en dur, contexte paresseux, interruption gérée

- Règle : jamais de fréquence d'échantillonnage en dur, toujours `ctx.sampleRate` pour
  créer un buffer ; `outputLatency ?? baseLatency ?? 0` ; AudioContext créé dans un geste
  (`click`, `pointerup`, `keydown`, jamais `pointermove`) ; état `interrupted` exposé et
  reprise tentée au retour au premier plan ; buffer silencieux d'un échantillon au premier
  déblocage.
- Vérifier : `grep -nE '44100|48000'` sur le diff ; tout `createBuffer` reçoit
  `ctx.sampleRate` ; toute commande qui peut arriver avant déblocage passe par `unlock()`
  d'abord, comme `play()`.
- Sévérité : Bloquant — Edge.

### C10 — Les voix sortent par les bus, jamais par `destination`

- Règle : basse → bus basse → master ; drums → bus rythmique → master ; le sidechain
  s'insère sur le bus basse. Seul `graph.ts` connaît `ctx.destination`.
- Vérifier : `grep -n 'destination' src/engine` ne sort que `graph.ts` et
  `audio/context.ts` (buffer silencieux).
- Sévérité : Bloquant — Form.

### C11 — La liaison se décide d'après ce que la voix a joué

- Source : PLAN §5 lot 4, décisions prises en revue.
- Règle : le plan reçoit `held` de la voix, qui retient si la dernière note jouée portait
  un slide ; un silence ne change rien, `release` remet à zéro. Le pattern (`holdContext`)
  ne sert qu'à l'indication « tenu » de l'interface. Le glissé part de la hauteur qui
  sonne, pas d'une note lue dans le pattern.
- Vérifier : `grep -rn holdContext src/engine` ne sort que `model/pattern.ts` et son
  ré-export ; `planStep` ne reçoit ni le pattern ni le pas précédent ; tout futur état « ce
  qui sonne » (choke du hat au lot 5) vit dans la voix.
- Sévérité : Bloquant — Edge : déduire la tenue du pattern rend une note muette.

### C12 — Un événement futur d'un pas ne compte pas survivre au `cancel` du pas suivant

- Source : PLAN §5 lot 4, décisions prises en revue ; PLAN §7 « Événement d'un pas effacé
  par le pas suivant » ; C0 (`cancelScheduledValues(t)` efface tout ce qui est ≥ t).
- Règle : un événement posé à `time + X` n'est garanti que si X est inférieur au créneau
  minimal (repères temporels). Au-delà, le poser au temps du pas en `setTargetAtTime`, ou le
  borner par le créneau réel. Toléré : la fermeture de gate, point ouvert du plan.
- Vérifier : pour chaque nouvel événement à `time + X` dans un plan, calculer le créneau
  minimal à `BPM_MAX` et le comparer à X.
- Sévérité : Bloquant — Edge si un événement audible est perdu pour un BPM et un shuffle
  concrets ; Suggestion sinon.

---

## D — Modèle, état, constantes

Source : PLAN §4, H3 à H9, README « Ce qui décide est pur ».

### D1 — Valeurs de knobs normalisées 0..1 dans l'état

- Règle : H3. L'état stocke des `Normalized` ; `mapping.ts` convertit vers Hz, Q,
  secondes, gain par des courbes nommées. Le BPM est l'exception assumée, borné par
  `BPM_MIN`/`BPM_MAX`. L'interface ne convertit que pour afficher, via les fonctions
  exportées par `@engine`.
- Vérifier : aucune propriété en Hz, cents ou secondes n'entre dans `EngineState` ;
  aucune formule de mapping dupliquée côté UI.
- Sévérité : Bloquant — Form si l'état porte une unité physique ; Suggestion si l'UI
  duplique une courbe.

### D2 — Pas de nombre magique : `constants.ts` avec commentaire d'intention

- Règle : tout nombre du moteur qui règle un comportement vit dans `model/constants.ts`
  avec un commentaire qui dit ce qu'il fait. Côté interface, les constantes de geste sont
  dans `gestures/knob-math.ts`, le visuel dans `tokens.css`. Sont tolérés sans nom : 0, 1,
  2, 12 et 1200 (demi-tons et cents), 60 (BPM vers secondes), 440 et 69 (La 440), les
  index de tableau.
- Vérifier : les littéraux numériques nouveaux dans le diff moteur ; les valeurs par
  défaut recopiées dans l'UI (un `defaultValue={0.8}` qui redouble `DEFAULT_MIX`, un
  `125` qui redouble `BPM_DEFAULT`) sont des duplications à faire passer par un export
  de `@engine`, comme `DEFAULT_BASS` pour le panneau basse.
- Sévérité : Suggestion — Clarity ; Bloquant si la même valeur de réglage existe à deux
  endroits qui peuvent diverger.

### D3 — Reducer pur, état immuable, entrées bornées

- Règle : `reduce` ne mute jamais `state` ; il retourne un nouvel objet par spread ;
  toute valeur numérique venue de l'extérieur passe par `clamp` (qui traite `NaN` comme le
  minimum). Le test « publie des snapshots immuables distincts » protège l'interface qui
  compare par référence (`$state.raw`).
- Vérifier : aucun `state.x =` ni `push`/`splice` sur une structure de l'état ; chaque
  nouveau champ numérique est clampé ; `state.test.ts` couvre la nouvelle commande, y
  compris la valeur hors borne.
- Sévérité : Bloquant — Reliability.

### D4 — Casts et assertions non nulles justifiés

- Règle : `noUncheckedIndexedAccess` rend `pattern[i]` possiblement `undefined` : traiter
  avec `??` ou un test explicite, pas avec `!`. Les casts acceptés du dépôt sont
  documentés : `as unknown as Tuple16<T>` dans `tuple16()` et `as unknown as BassPattern`
  après un `map`, `as StepIndex` après un `% STEP_COUNT`, `as PitchClass` et `as OctaveOffset`
  après un modulo ou un clamp dans `pitch.ts`, `as AudioParam[]` sur `Object.values` de la
  table des cibles de la voix, `as Partial<MixParams>` en sortie de `clampPatch`. Tout autre `as` ou `!` mérite
  une justification en commentaire.
- Vérifier : `grep -nE '\bas\b|!\.' ` sur le diff TypeScript, en excluant les motifs
  acceptés et `as const`.
- Sévérité : Suggestion — Clarity ; Bloquant si le cast masque un vrai hors-borne.

### D5 — Hypothèses tranchées du modèle

- H4 : octave de base C2 = MIDI 36, décalage −1/0/+1, plage C1–B3, tuning
  ±`TUNING_RANGE_SEMITONES`.
- H5 : `STEP_COUNT = 16` fixe, **pas de champ `length`** avant v3.
- H6 : générateur avec sauts d'octave et undo à un niveau via `previousPattern`.
- H7 : vélocité rythmique continue 0..1, 0 = pas inactif ; clic = toggle à la vélocité
  par défaut, drag vertical = réglage fin.
- H8 : le hat ouvert est étouffé par le hat fermé.
- H9 : un master, un bus basse, un bus rythmique.
- H11 : espace = play/stop ; pas de clavier musical en v1.
- Vérifier : une PR qui contredit une hypothèse sans modifier `docs/PLAN.md` est hors
  contrat.
- Sévérité : Bloquant — Purpose, sauf si le plan est mis à jour dans la même PR, auquel
  cas c'est une décision à discuter, pas un bug.
- Sens inverse : le reviewer peut contester une hypothèse ou une parade du plan par une
  Suggestion argumentée (exemple réel : le plancher `MIN_GAIN` n'a pas d'objet sous
  `setTargetAtTime` et son résidu passe dans le drive). Jamais un Bloquant contre l'auteur
  qui suit le plan.

### D6 — Types du modèle : `readonly` partout, unions littérales

- Règle : `Step`, `Pattern`, params et état sont `readonly` ; les index et hauteurs sont
  des unions littérales (`StepIndex`, `PitchClass`, `OctaveOffset`) ; `Tuple16<T>` pour
  les seize pas. Les commandes ont un `type` en `domaine/action`.
- Vérifier : un nouveau type mutable ou un `number` là où une union existe.
- Sévérité : Suggestion — Form.

---

## E — Interface Svelte 5

Source : PLAN §2 « Svelte 5 (runes) », « Gestion d'état : le moteur est la source de
vérité », H2, H11, lot 2, cible « Desktop + tablette paysage ».

### E1 — Runes uniquement, snapshots en `$state.raw`

- Règle : `$props()`, `$derived`, `$state`, `$effect` avec nettoyage ; le snapshot du
  moteur remplace un `$state.raw`, jamais un proxy profond. Pas de `export let`, de `$:`,
  de `writable`, de `createEventDispatcher` : les composants reçoivent des callbacks en
  props (`onchange`, `dispatch`).
- Vérifier : `grep -nE 'export let|\$:|createEventDispatcher|svelte/store'` sur le diff UI.
- Sévérité : Suggestion — Form ; Bloquant si un second état source de vérité apparaît.

### E2 — Aucune copie de l'état du moteur dans un composant

- Règle : un composant lit la tranche de snapshot qu'il reçoit et dispatche des
  commandes. Il ne garde pas de copie locale d'une valeur de knob ni de pas. Le geste lit
  la valeur courante à chaque événement via `getValue: () => …`.
- Vérifier : un `$state` local initialisé depuis une prop du moteur et modifié ensuite
  diverge de l'état réel à la première commande extérieure.
- Sévérité : Bloquant — Reliability.

### E3 — Geste de knob complet et accessible

- Règle : Pointer Events avec `setPointerCapture`, `touch-action: none`, drag relatif
  vertical et horizontal, Shift = mode fin, double-tap = valeur par défaut, flèches,
  PageUp/PageDown, Home/End ; `role="slider"`, `aria-label`, `aria-valuemin/max/now`,
  `aria-valuetext` lisible, `tabindex="0"`, anneau `:focus-visible` via token. Les
  boutons à état portent `aria-pressed`. Textes et `aria-label` en français (H2).
- `knobDrag` est **continu** (`KNOB_DRAG_RANGE_PX`, `KNOB_KEY_STEP`, `KNOB_KEY_PAGE_STEP`,
  `KNOB_FINE_FACTOR` dans `gestures/knob-math.ts`), et il
  relit `getValue()` à chaque événement. Un consommateur à valeurs discrètes (hauteur sur
  36 demi-tons, vélocité par pas) qui renvoie une valeur déjà quantifiée perd tout
  déplacement inférieur à un cran : drag lent et flèches ne font rien, Shift devient
  inopérant. Il lui faut soit une résolution passée au geste, soit un accumulateur non
  quantifié pendant le geste.
- Vérifier : tout nouveau contrôle draggable réutilise `knobDrag` plutôt qu'un geste ad
  hoc ; tout contrôle nouveau ou modifié est opérable au clavier (flèches comprises) et au
  doigt, avec une cible d'au moins `--control-size` ; les tests happy-dom couvrent
  le clavier avec les flèches, un drag en plusieurs petits mouvements, et l'ARIA.
- Sévérité : Bloquant — Edge pour un contrôle nouveau ou modifié inopérable au clavier ou
  au doigt, ou pour une régression d'accessibilité ; Suggestion sinon.

### E4 — Tokens visuels, au-delà de ce que Stylelint interdit

- Outillage : Stylelint bloque couleurs, rayons, `font-size`, `font-family`, espacements
  et `box-shadow` littéraux hors `tokens.css`.
- **Non couvert** : `width`, `height`, `min-*`, `max-*`, `line-height`, `letter-spacing`,
  durées et easings de `transition` ; les attributs `style=` inline dans les templates
  Svelte ; tout CSS hors `src/` (`public/`, `index.html`). Les tokens `--duration-fast`,
  `--easing`, `--control-size`, `--space-*` existent pour ça.
- Vérifier : une valeur récurrente ou sémantique (taille de contrôle, durée) passe par un
  token ; une dimension structurelle unique (largeur maximale de page) est tolérée ; une
  transition sur un état piloté par la tête de lecture reste très inférieure à la durée
  d'un pas au tempo maximal (repères temporels : `--duration-fast` vaut un pas entier à
  125 BPM).
- Sévérité : Suggestion — Form ; Suggestion — Edge si l'affichage du pas audible en pâtit.

### E5 — Raccourcis globaux respectueux du focus

- Règle : la barre d'espace bascule play/stop sauf quand le focus est sur un contrôle
  (`button, input, select, textarea, [role="slider"]`) et ignore `event.repeat`. Tout
  nouveau raccourci global suit la même garde.
- Point ouvert (PLAN, « Dette et points ouverts ») : la garde neutralise l'espace après
  tout geste sur un knob ou un pas. Toute modification de la garde ou du geste doit le
  prendre en compte.
- Sévérité : Suggestion — Edge.

### E6 — Cible d'écran et tactile

- Règle : desktop et tablette paysage ; le mobile portrait ne doit pas casser mais n'est
  pas optimisé. Ne pas demander d'optimisation mobile. Les surfaces draggables ont
  `touch-action: none` et `user-select: none`.
- Sévérité : Suggestion — Edge, uniquement si une grille devient inutilisable au doigt.

---

## F — Tests

Voir `test-expectations.md` pour le détail par module. Résumé des règles :

### F1 — Ce qui décide est pur et testé en node

- Règle : nouvelle logique de timing, d'enveloppe, de mapping, de génération = fonction
  pure + test Vitest en node. La couche Web Audio est mince et testée contre
  `tests/fakes/fake-audio-context.ts`.
- Sévérité : Bloquant — Evidence si un module pur arrive sans test.

### F2 — Les tests ne mockent pas l'implémentation testée

- Règle : les fakes remplacent Web Audio, le timer et l'horloge, jamais un module du
  moteur. Un `vi.mock('./bass-plan')` dans un test de `bass-voice` est un signal d'alerte.
- Sévérité : Bloquant — Evidence.

### F3 — Conventions

- Fichier voisin `x.test.ts` ; composants en `// @vitest-environment happy-dom` avec de
  vrais `PointerEvent` ; libellés `it` en français décrivant un comportement observable ;
  aucun `.only`, `.skip`, `.todo` fusionné.
- Sévérité : Suggestion — Form ; Bloquant pour `.only` ou `.skip`.

---

## G — Livraison, CI, documentation

Source : PLAN §2 « Points volontairement écartés », §5 « Chaque lot se termine sur un état
jouable, CI verte », H2, README « Feuille de route ».

### G1 — Dépendances : rien d'écarté sans décision écrite

- Règle : Tone.js, une bibliothèque de knobs, Zustand/Redux, Tailwind ou CSS-in-JS,
  SvelteKit sont écartés avec justification. Toute nouvelle dépendance est justifiée dans
  la PR et `pnpm-lock.yaml` suit (`--frozen-lockfile` en CI).
- Vérifier : diff de `package.json` et présence du diff de `pnpm-lock.yaml`.
- Sévérité : Bloquant — Form pour une dépendance écartée ; Suggestion pour une dépendance
  nouvelle non justifiée.

### G2 — CI et Pages

- Règle : `ci.yml` exécute `pnpm verify`, qui se termine par `pnpm build`, sur PR ;
  `deploy.yml` déploie `main` sur Pages avec `BASE_PATH`. Le `base` Vite vient de
  l'environnement. Les assets et workers sont résolus par `new URL(…, import.meta.url)`.
- Vérifier : une PR qui touche la CI ou le script `verify` y garde le build ; un nouvel
  asset ne suppose jamais `/` comme racine.
- Sévérité : Bloquant — Reliability.

### G3 — Une PR = un lot jouable, avec sa description

- Règle : la PR livre un état jouable, CI verte, description `## Lot N — …` avec
  `### Contenu`, `### À écouter`, `### Tests`. Le README « Feuille de route » et sa
  colonne État suivent la livraison ; la liste « À écouter à chaque lot » s'enrichit si le
  lot ajoute un risque audible.
- Vérifier : titre `type(scope): … (lot N)` ; section « À écouter » présente ; README mis
  à jour si le lot se clôt.
- Sévérité : Suggestion — Clarity.

### G4 — Langues et messages de commit

- Règle : H2. Identifiants en anglais ; commentaires, README, textes d'interface et
  `aria-label` en français ; messages de commit en anglais au format
  `type(scope): message` (`feat(synth): …`, `chore(project): …`).
- Sévérité : Nit — Taste.

### G5 — Persistance (lot 7)

- Règle : `PersistedStateV1` avec champ `version` ; payload corrompu → défauts sans
  exception ; adaptateur de stockage injectable, mémoire en test ; sauvegarde debouncée à
  chaque commande ; `localStorage` n'apparaît que dans `persistence/storage.ts`.
- Sévérité : Bloquant — Reliability.

---

<!-- manual:start -->

## Ajouts manuels

Zone préservée par `/forging-review-skill --refresh`. Y noter les invariants décidés en
revue et pas encore écrits dans `docs/PLAN.md` ou le README, avec leur date.

<!-- manual:end -->
