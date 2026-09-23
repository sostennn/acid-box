# Checklists par lot

Dérivé de `docs/PLAN.md` §5 (lots), §3 (arborescence cible), §7 (risques), §8 (roadmap
v2+), « Vérification de fin de v1 », et des PR #1 à #4. État au 2026-09-23 : lots 0 à 3
fusionnés (PR #1 à #3), lot 4 en cours sur `feature/accent-slide` avec la PR #4 ouverte,
CI verte.

**Le code fait foi.** Ces checklists décrivent ce que le plan attend ; si une PR contient
autre chose, c'est la PR qu'on lit et la checklist qu'on signale en « Hors périmètre »
pour rafraîchissement. Attention en particulier : ce fichier a été rédigé depuis un worktree
sur la branche du lot 4, pas depuis `main`.

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
vus : `project`, `clock`, `ui`, `synth`. Attendus : `pattern`, `drums`, `generator`,
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
  Décisions défendables, non écrites dans le plan : à consigner.

## Lot 4 — Accent et slide (en cours, PR #4 sur `feature/accent-slide`, commit `7f165c6`)

- Livre :
  - accent dans `bass-plan.ts` : pic de VCA, ouverture de filtre supplémentaire, résonance
    poussée, profondeur par le knob accent, décroissance fixe `ACCENT_ENV_DECAY_S` ;
  - slide : glissé exponentiel de fréquence sur `SLIDE_TIME_S` **sans** événement
    d'enveloppe ; note tenue jusqu'au prochain pas joué, à travers les silences
    (`model/pattern.ts`, `holdContext`) ; bouclage 15 → 0 ;
  - drapeaux accent / slide dans `StepCell.svelte`, indication « tenu » ;
  - cas limites **documentés et testés** : slide sur le dernier pas, chaîne de slides,
    accent + slide, tous les pas en silence.
- Hypothèses : slide → silence = note tenue et glissée vers le prochain pas joué
  (décision de la table « Décisions déjà prises »).
- Risques §7 : automations qui se chevauchent (`cancel` puis ré-ancrage, C3), rampes
  exponentielles (ancre avant `expRamp`, C2), clic à l'arrêt en plein slide (C6).
- Tests §6.1 attendus : ligne `bass-plan.ts` complète, plus les quatre cas limites ;
  `index.test.ts` « un slide dans le pattern produit une rampe au pas suivant » étendu au
  bouclage ; `StepCell.svelte.test.ts` : bascule accent et slide, indication « tenu ».
- À écouter : le phrasé acid ; slide sur le dernier pas vers le premier ; chaîne de slides
  à travers des silences ; accent seul ; stop en plein slide sans clic.
- Vigilance : le slide ne redéclenche pas l'enveloppe ; un pas qui slide laisse le VCA
  ouvert et c'est le pas d'arrivée qui ferme ; les durées dérivées (gate, glissé) doivent
  tenir compte du créneau réel jusqu'au prochain onset, shuffle compris (voir « Points
  ouverts ») ; C3 : chaque cible commence par un `cancel` au temps du pas.

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
  vélocité de la grille est un consommateur discret de `knobDrag` (E3).

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

- README « Feuille de route » : colonne État encore à « lot 0 en cours » alors que les
  lots 1 à 3 sont fusionnés ; liste « À écouter à chaque lot » jamais enrichie depuis le
  lot 0.
- `Transport.svelte` recopie `125` et `0.8` ; `BassPanel.svelte` recopie les sept valeurs
  de `DEFAULT_BASS` ; `StepCell.svelte` recopie `DEFAULT_STEP`. `BPM_DEFAULT`,
  `DEFAULT_BASS`, `DEFAULT_STEP`, `DEFAULT_MIX` ne sont pas exportés par `@engine` (D2, A4).
- Tests exigés par le plan et absents : frontière `@engine` en node pur (§6.2), pont
  `engine.svelte.ts` avec un moteur factice (§6.3).
- Dérives du plan : §6.3 dit jsdom, le code utilise happy-dom ; §3 mentionne un
  `vitest.config.ts` qui n'existe pas (config dans `vite.config.ts`) ; §5 lot 3 dit
  « 20 Hz–~8 kHz » pour le cutoff, le code dit 80–6000 Hz ; §4 décrit des cibles
  `cutoff | q` remplacées par `filterDetune | filterQ`.
- `tests/fakes/fake-audio-context.ts` : `ParamCall` n'enregistre pas `timeConstant` et
  `cancelScheduledValues` enregistre `value: NaN`.
- `constants.ts` : le commentaire de `MAX_LATE_S` décrit le métronome à une source par
  frappe, plus la voix monophonique.

## Points ouverts remontés par la revue à blanc du 2026-09-22

Trouvés sur la PR #3 par deux revues indépendantes, non tranchés par l'auteur : à
confirmer par lui, jamais à reprocher à une PR qui ne touche pas la ligne.

- `mapping.ts` / `constants.ts` : le `Q` d'un biquad lowpass est en dB (C0) ; `resonanceToQ`
  applique une exponentielle à une grandeur déjà logarithmique et `BassPanel` affiche
  « Q 18.0 » pour 18 dB.
- `StepCell.svelte` + `knobDrag` : la hauteur est quantifiée mais le geste relit la valeur
  quantifiée à chaque événement ; un drag lent ou une flèche ne change jamais la note,
  Shift est inopérant (E3).
- `index.ts` → `bass-plan.ts` : le gate est calculé sur la durée nominale du pas alors que
  `time` inclut le shuffle ; à shuffle > 0,9 la fermeture du pas impair tombe après
  l'attaque du pas pair, dont le `cancel` l'efface.
- `bass-voice.ts` : `safeTime` appliqué événement par événement écrase les durées d'un pas
  en retard ; au-delà du gate de retard, attaque et relâchement tombent au même instant
  et la note est avalée (B2).
- `App.svelte` : la garde `[role="slider"]` sur la barre d'espace la neutralise après tout
  geste, `knobDrag` posant le focus sur le slider (H11, E5).
- `bass-plan.ts` / `constants.ts` : le plancher `MIN_GAIN` est inutile sous
  `setTargetAtTime` et son résidu est amplifié par le drive ; contestation argumentée
  d'une parade §7, pas un bloquant (D5).

---

<!-- manual:start -->

## Ajouts manuels

Zone préservée par `/forging-review-skill --refresh`. Y noter les points ouverts tranchés
par l'auteur et les checklists d'écoute ajoutées au fil des lots, avec leur date.

<!-- manual:end -->
