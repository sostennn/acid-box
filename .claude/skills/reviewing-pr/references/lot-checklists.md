# Checklists par lot

<!-- forged-by: forging-review-skill · 2026-09-23 · sources : docs/PLAN.md §3 §5 §7 §8, README.md, PR #1 à #5, code de main à 577e06d -->

Dérivé de `docs/PLAN.md` §5 (lots), §3 (arborescence cible), §7 (risques), §8 (roadmap
v2+), « Vérification de fin de v1 », et des PR #1 à #5. État au 2026-09-23 : lots 0 à 4
fusionnés (PR #1 à #4, dernier merge `577e06d`), skill de revue fusionné (PR #5), lot 5 à
venir. Rédigé depuis `main`.

**Le code fait foi.** Ces checklists décrivent ce que le plan attend ; si une PR contient
autre chose, c'est la PR qu'on lit et la checklist qu'on signale en « Hors périmètre »
pour rafraîchissement.

---

## Identifier le lot

Dans l'ordre :

1. Titre de la PR : `(lot N)` en fin de titre, convention des PR #1 à #4.
2. Corps de la PR : première ligne `## Lot N — …`.
3. Nom de branche : `clock-transport` → 1, `knob` → 2, `bass-voice` → 3,
   `accent-slide` → 4, `drums`, `rhythm`, `sidechain` → 5, `generator` → 6,
   `persistence`, `polish`, `finish` → 7.
4. Contenu : les fichiers créés pointent vers un lot via l'arborescence §3 (`synth/drums/`
   → 5, `generator/` → 6, `persistence/` → 7).

Pas de lot identifiable : c'est une PR « hors lot » (correctif, chore, docs, CI), voir la
section dédiée.

Une PR peut clore un lot ou n'en livrer qu'une partie : la description doit le dire. Un
lot livré en plusieurs PR n'est pas un défaut ; un lot annoncé clos alors qu'il manque un
item de « Livre » l'est.

---

## Convention de description de PR

Observée sur les PR #1 à #4, non versionnée dans `.github/` :

```markdown
## Lot N — <nom du lot>

### Contenu

- <une puce par élément livré, orientée comportement, cinq à sept puces>

### À écouter (ou « À essayer » pour un lot d'interface)

- <ce que l'auteur a vérifié à l'oreille ou au doigt, et que le reviewer doit refaire>

### Tests

<nombre> tests, dont <les plus significatifs>.
```

Titre : `type(scope): description in English (lot N)`, sans le verbe du commit. Scopes
vus : `project`, `clock`, `ui`, `synth`. Une PR hors lot (chore, docs) n'a pas de suffixe
et remplace « À écouter » et « Tests » par « Vérifications » et « À essayer » (PR #5). Attendus : `pattern`, `drums`, `generator`,
`persistence`, `ci`, `docs`. Branches : `feature/<sujet-kebab>`. Merge par merge-commit.

---

## Lot 0 — Socle et premier son (fusionné, commit `5d5df1b`)

- Livre : scaffold Vite + Svelte 5 + TS strict, pnpm, ESLint/Prettier/Stylelint/svelte-check,
  Vitest ; `tokens.css` et `base.css` avec la règle Stylelint ; frontière ESLint ;
  `audio/context.ts` avec déblocage sur geste ; `AudioGate.svelte` ; CI et Pages ; README.
- Risques §7 : autoplay policy, iOS `interrupted`, Pages base path.
- Fait. Toute PR qui retouche ce socle est « hors lot » ou « livraison » (section G).

## Lot 1 — Horloge, transport, tête de lecture (fusionné, PR #1)

- Livre : types du modèle, `defaults.ts`, `constants.ts`, reducers du transport ;
  `timing.ts` ; `worker-timer.ts` + `timer.worker.ts` + `scheduler.ts` ;
  `playhead-queue.ts` + `playhead.svelte.ts` ; `Transport.svelte` ; barre d'espace.
- Hypothèses : H10 (worker), H12 (latence d'édition).
- Fait. Le métronome provisoire a été retiré au lot 3.

## Lot 2 — Le knob et le geste (fusionné, PR #2)

- Livre : `knob-drag.ts` + `knob-math.ts`, `Knob.svelte` + `knob-arc.ts`, écriture lissée
  via `setTargetAtTime`, bus master et commande `mix/set`.
- Fait. `knobDrag` est un geste **continu** (`KNOB_DRAG_RANGE_PX = 200`,
  `KNOB_KEY_STEP = 0.01`, `KNOB_FINE_FACTOR = 0.125`) : tout consommateur à valeurs
  discrètes doit lui donner une résolution ou accumuler pendant le geste (invariant E3).

## Lot 3 — La voix basse (fusionné, PR #3, tête `a587d8a`)

- Livre : `graph.ts` (bus basse → master), `filter-stage.ts` (biquad lowpass,
  `frequency` pour le knob, `detune` pour l'enveloppe), `bass-voice.ts`, `bass-plan.ts`
  (note, octave, silence, gate, enveloppe de filtre à decay seul, VCA), `drive.ts`,
  `mapping.ts` complet, `pitch.ts`, pattern par défaut en Do mineur, commandes
  `pattern/setStep`, `pattern/toggleStepFlag` (drapeau `rest` seul en interface),
  `bass/setWaveform`, `bass/setKnob`, `BassPanel.svelte`, `BassSequencer.svelte`,
  `StepCell.svelte` (hauteur au drag sur trois octaves, silence), retrait du métronome.
- Fait. **Pas dans la PR #3** : `model/pattern.ts` (`holdContext`), les drapeaux accent et
  slide de `StepCell`, les branches accent et slide de `bass-plan.ts` et leurs tests. Tout
  cela est le lot 4.
- Écarts au plan constatés à la livraison : cutoff `80–6000 Hz` au lieu de « 20 Hz–~8 kHz »
  (§5 lot 3), cibles `frequency | filterDetune | filterQ | vca` au lieu de `cutoff | q`
  (§4), tuning appliqué par `applyParams` sur `oscillator.detune` et non par le plan.
  Décisions défendables, non écrites dans le plan : à consigner. Depuis le lot 4, la
  résonance est linéaire en dB (commit `0f2eb65`) et la plage de decay vaut 20–600 ms.

## Lot 4 — Accent et slide (fusionné, PR #4, merge `577e06d`)

- Livré, après les corrections de revue :
  - accent dans `bass-plan.ts` : pic de VCA `1 + accent × ACCENT_MAX_GAIN_BOOST`, ouverture
    de filtre `+ accent × ACCENT_MAX_OCTAVES`, résonance par `accentedQ` (+6 dB bornés),
    décroissance fixe `ACCENT_ENV_DECAY_S` (50 ms), retour de Q à `ACCENT_Q_HOLD_S` ;
  - slide : glissé `setTargetAtTime` de τ `SLIDE_TAU_S` posé au temps du pas d'arrivée,
    sans ancre ni événement d'enveloppe ; le pas qui slide laisse le VCA ouvert, le pas
    d'arrivée ferme ; un accent sur un pas tenu est ignoré ;
  - liaison décidée par la voix (`noteOpen`, C11), à travers les silences et le bouclage
    15 → 0 ; `holdContext` (`model/pattern.ts`) reste la lecture du pattern pour
    l'indication « tenu » de `StepCell.svelte` ;
  - la voix reprogramme le retour de Q quand le knob bouge pendant le lookahead (C4) ;
    `release` ramène Q au knob et remet l'état de la voix à zéro (C6) ;
  - résonance linéaire en dB (commit séparé `fix(synth)`) ;
  - préréglage acid au démarrage (`defaults.ts` : ligne en Do mineur, 6 accents, 6 slides,
    son saw fermé et résonant), plage de decay 20–600 ms, `DEFAULT_BASS` exporté par
    `@engine` et lu par `BassPanel.svelte`.
- Tests livrés (117) : les quatre cas limites du plan, slide sur le pas 15 au premier play,
  liaison rompue par un stop, silence entre slide et arrivée, geste de résonance qui
  l'emporte sur le retour d'un accent, stop pendant un accent, poussée d'accent constante
  en dB et bornée, ligne de départ avec accents et slides bouclée par un slide.
- Pour une PR qui retouche ce code : C3 (exception du pas tenu), C4 (retour reprogrammé),
  C6 (remise à zéro de l'état de la voix), C11, C12 ; ne jamais réintroduire une rampe à
  échéance pour le glissé ni déduire la tenue du pattern.
- À écouter si la PR touche la voix : phrasé acid du préréglage ; slide du pas 16 vers le
  pas 1 au premier play ; chaîne de slides à travers des silences ; shuffle maximal à
  140 BPM avec slide vers un pas impair ; accent avec résonance au maximum ; knob résonance
  tourné pendant une ligne accentuée ; stop en plein slide ou sur un accent.

## Lot 5 — Rythmique et sidechain

- Livre : `synth/drums/noise.ts` (buffer généré une fois), `kick.ts` (sinus + enveloppe
  de pitch), `clap.ts` (bruit filtré + rafale + queue), `hihat.ts` (bruit passe-haut,
  decay court/long, choke), `drum-plan.ts` pur ; nœuds source **par frappe** arrêtés à
  `t + durée` ; `sidechain.ts` (GainNode sur le bus basse, `SIDECHAIN_ATTACK_S`,
  `SIDECHAIN_RELEASE_S`, profondeur = amount) ; `DrumGrid.svelte`, `DrumPanel.svelte`
  (mute, niveau) ; interrupteur + knob sidechain dans le transport ; `mix` complet
  (basse, rythmique, master) ; commandes `pattern/setDrumVelocity`, `drums/setMuted`,
  `drums/setLevel`, `transport/setSidechain`.
- Hypothèses : H7 (vélocité continue, clic = toggle, drag = fin), H8 (choke), H9 (trois
  niveaux), décision « Sidechain : interrupteur + amount ; attaque et retour en
  constantes ».
- Risques §7 : nœuds source non réutilisables (C5), rampes vers 0 (C2), `safeTime` (B2),
  fake à étendre (`FakeBufferSourceNode`, `stop`, `ended`, `timeConstant`).
- Tests : `drum-plan.ts`, partie pure de `sidechain.ts`, drums contre le fake (un nœud par
  frappe, `stop` appelé, pas de référence gardée), `DrumGrid.svelte` sous happy-dom,
  `state.test.ts` pour les nouvelles commandes.
- À écouter : le groove complet ; la basse qui « pompe » sous le kick ; hat ouvert coupé
  par le fermé ; mute instantané sans clic.
- Vigilance : timbres fixés par constantes (pas de knobs de timbre) ; la grille lit le
  même `audibleStep` que la basse (B4) ; le sidechain n'écrit que sur le bus basse ; la
  vélocité de la grille est un consommateur discret de `knobDrag` (E3) ; le choke du hat
  ouvert se décide d'après ce qui sonne, comme la liaison (C11) ; enveloppes de frappe et
  courbe de ducking en `setTargetAtTime` plutôt qu'en rampes (C2), avec des échéances
  qui tiennent dans le créneau d'un 16e impair (C12) ; `release` de chaque nouvelle voix
  appelé par `stop()` (C6).

## Lot 6 — Générateur de patterns

- Livre : `generator/rng.ts` seedable, `model/scales.ts` (mineure, phrygienne),
  `acid-generator.ts` pur (tonique au pas 0, notes dans la gamme, densités notes /
  accents / slides / sauts d'octave, heuristiques de plausibilité) ; commandes
  `generator/setParams`, `generator/run`, `generator/undo` avec `previousPattern` ;
  `GeneratorPanel.svelte`.
- Hypothèses : H6 (sauts d'octave, undo à un niveau).
- Tests : table §6.1 ligne `acid-generator.ts` ; reducer `generator/undo`.
- À écouter : une nouvelle ligne crédible à chaque pression, retour arrière possible.
- Vigilance : `Math.random` interdit hors `rng.ts` (déterminisme) ; le générateur ne
  touche pas aux drums en v1 sauf décision écrite.

## Lot 7 — Persistance, robustesse, finition

- Livre : `persistence/serialize.ts` versionné + `storage.ts` injectable ; sauvegarde
  debouncée, restauration au démarrage ; passe iOS / Safari réelle ; tests
  `OfflineAudioContext` dans `tests/browser/` ; mise en page desktop / tablette finale ;
  README complet avec capture et lien de démo.
- Risques §7 : iOS / Safari (C9), fuite de dépendance (A2).
- Tests : `serialize.ts`, §6.4 ; c'est aussi le moment du test de frontière `@engine` en
  node pur (§6.2) et du test du pont `engine.svelte.ts` (§6.3), tous deux encore absents.
- Vérification de fin de v1 (PLAN) : `pnpm verify` vert ; démo Pages jouable ; scénarios
  d'écoute (slide dernier → premier, chaîne de slides, accent seul, sidechain max, stop en
  plein slide) ; rechargement restaure pattern et knobs ; iPad Safari déblocage et reprise ;
  onglet caché 30 s puis retour en phase.

---

## Hors v1 : scope creep à signaler

Tout ceci est planifié pour plus tard. Une PR qui l'introduit sans mettre à jour le plan
sort du contrat :

- v2 : filtre en échelle en AudioWorklet, sélecteur biquad / ladder.
- v3 : banque de patterns à N slots, champ `length` sur `Pattern`, enregistrement par
  capture de commandes, chaînage de patterns.
- v4 : export WAV, partage par URL (`PersistedState` en base64url), Web MIDI.
- Jamais planifié : clavier musical, knobs de timbre pour les drums, routing configurable,
  optimisation mobile portrait.

---

## PR hors lot

Correctif, chore, docs, CI. Checklist minimale :

- Le problème corrigé est nommé et, s'il est reproductible, un test le capture d'abord.
- Le correctif vise la cause, sans refactor opportuniste.
- Les invariants des sections touchées (`invariants.md`) tiennent toujours.
- README et plan restent cohérents avec le code après la PR.

---

## Dette connue au 2026-09-23

À signaler en « Hors périmètre » si une PR passe à côté, à suggérer si elle touche le
fichier :

- README : la liste « À écouter à chaque lot » n'a pas bougé depuis le lot 0, alors que
  PLAN §6.5 promet une checklist par lot ; les checklists vivent dans les descriptions de
  PR. La colonne État de la feuille de route a été remise à jour avec ce rafraîchissement.
- `Transport.svelte` recopie `125` et `0.8` ; `StepCell.svelte` recopie `DEFAULT_STEP`.
  `BPM_DEFAULT`, `DEFAULT_STEP` et `DEFAULT_MIX` ne sont pas exportés par `@engine` (D2,
  A4). `BassPanel.svelte` est corrigé depuis le lot 4.
- Tests exigés par le plan et absents : frontière `@engine` en node pur (§6.2), pont
  `engine.svelte.ts` avec un moteur factice (§6.3).
- Dérives du plan, où le code fait foi :
  - préambule : « Aucune implémentation n'est écrite à ce stade » ;
  - §3 mentionne `vitest.config.ts` et `.stylelintrc` (config de test dans
    `vite.config.ts`, fichier `.stylelintrc.json`) ; §2 et §6.3 disent jsdom, le code
    utilise happy-dom ;
  - §4 : `ParamEvent` décrit avec les cibles `cutoff | q` et le type `expRamp`, le code a
    `filterDetune | filterQ`, `cancel | set | target` ; `planStep` décrit avec
    `(step, nextStep, …)`, le code prend `StepPlanInput` avec `held` fourni par la voix ;
    `EngineOptions` décrit avec `storage` (lot 7), le code a `createContext`, `visibility`,
    `timer` ;
  - §5 lot 3 : cutoff « 20 Hz–~8 kHz », le code dit 80–6000 Hz ;
  - §6.1 `bass-plan.ts` : « rampes exponentielles > 0 » sans objet, « temps strictement
    croissants » contredit par `cancel` et `set` au même temps (croissants au sens large) ;
  - §7 : `RESONANCE_Q_MAX` devenu `RESONANCE_Q_MAX_DB`, `MIN_FREQUENCY_HZ` et les helpers
    d'ancrage de `params.ts` n'existent pas (`safeTime` et `smoothSet` seulement),
    `STOP_RELEASE_S` est `STOP_RELEASE_TAU_S`, ré-ancrage par `target` plutôt que
    `setValueAtTime` (C3) ;
  - README et « Vérification de fin de v1 » vérifient le curseur à 160 BPM, `BPM_MAX` vaut
    240 et la PR #1 l'annonçait à 240.
- `tests/fakes/fake-audio-context.ts` : `ParamCall` n'enregistre pas `timeConstant` et
  `cancelScheduledValues` enregistre `value: NaN`.
- `bass-voice.test.ts` retrouve encore le VCA par « un appel avec `value === 1` » (quatre
  occurrences) ; `index.test.ts` a le bon modèle (`findVca`, par branchement après le
  filtre). Littéraux recopiés dans les tests : `36`, `1200`, `0.125`.

## Points ouverts

Remontés par les revues de la PR #3 (revue à blanc du 2026-09-22) et de la PR #4
(2026-09-23), non tranchés par l'auteur : à confirmer par lui, jamais à reprocher à une PR
qui ne touche pas la ligne.

- `StepCell.svelte` + `knobDrag` : la hauteur est quantifiée mais le geste relit la valeur
  quantifiée à chaque événement ; un drag lent ou une flèche ne change jamais la note,
  Shift est inopérant (E3).
- `index.ts` → `bass-plan.ts` : le gate est calculé sur la durée nominale du pas alors que
  `time` inclut le shuffle ; au-delà d'un shuffle de 0,9 la fermeture du pas impair tombe
  après l'attaque du pas pair, dont le `cancel` l'efface (C12, toléré).
- `bass-voice.ts` : `safeTime` appliqué événement par événement écrase les durées d'un pas
  en retard ; au-delà du gate de retard, attaque et relâchement tombent au même instant
  et la note est avalée (B2).
- `App.svelte` : la garde `[role="slider"]` sur la barre d'espace la neutralise après tout
  geste, `knobDrag` posant le focus sur le slider (H11, E5).
- `bass-plan.ts` / `constants.ts` : le plancher `MIN_GAIN` est inutile sous
  `setTargetAtTime` et son résidu est amplifié par le drive ; contestation argumentée
  d'une parade §7, pas un bloquant (D5).
- `StepCell.svelte` : boutons A et S de 24 px (`--space-5`), sous `--control-size` (E3) ;
  l'indication « tenu » manque sur les silences traversés par un slide et n'est pas
  annoncée aux lecteurs d'écran (`aria-valuetext` inchangé) ; le `~` du `::before` s'affiche
  au-dessus de la note, `.pitch` étant en grille ; `.flag.on` déclaré deux fois.
- `constants.ts` : `ACCENT_Q_ATTACK_TAU_S` et `ACCENT_Q_HOLD_S` sans commentaire
  d'intention (D2).

Tranché depuis : la résonance en dB (commit `0f2eb65`), la tenue décidée par la voix, le
glissé effaçable par le shuffle, le retour de Q figé, le stop en plein slide (PR #4).

---

<!-- manual:start -->

## Ajouts manuels

Zone préservée par `/forging-review-skill --refresh`. Y noter les points ouverts tranchés
par l'auteur et les checklists d'écoute ajoutées au fil des lots, avec leur date.

<!-- manual:end -->
