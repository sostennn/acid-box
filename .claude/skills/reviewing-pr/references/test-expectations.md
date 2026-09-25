# Attentes de tests pour la revue

<!-- forged-by: forging-review-skill · 2026-09-23 · commit 577e06d · sources : docs/PLAN.md §6, vite.config.ts, tests/fakes, conventions des tests de main -->

Dérivé de `docs/PLAN.md` §6, de `vite.config.ts`, des doublures de `tests/fakes` et des
conventions observées dans les tests. État au 2026-09-23 ; le code fait foi si les tests
ont bougé depuis.

Le principe qui gouverne tout : **séparer ce qui décide de ce qui touche Web Audio**. Ce
qui décide (quand, quelle valeur, quelle courbe) est pur et testé en node. Ce qui touche
Web Audio est mince et testé contre des fakes. Le rendu réel est vérifié à l'oreille par
l'auteur, et plus tard par les tests hors ligne du lot 7.

En revue, la question n'est pas « y a-t-il des tests ? » mais « la logique nouvelle
est-elle pure, et son test décrit-il un comportement que l'on peut casser ? ».

---

## Ce que chaque module doit tester (§6.1, tests purs en node)

| Module                                   | Attendu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clock/timing.ts`                        | Durée de pas pour plusieurs BPM ; offsets de shuffle uniquement sur les 16es impairs, bornés par `SHUFFLE_MAX_RATIO`, nuls à shuffle 0                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `clock/scheduler.ts`                     | Avec `FakeClock` + `FakeTimer` + collecteur : chaque tick programme exactement les pas dans `[now, now + SCHEDULE_AHEAD_S[` ; aucun pas deux fois ; aucun pas manqué si le timer est en retard ; **absence de dérive sur 1000 pas** ; changement de tempo au pas suivant sans saut ; stop vide et réinitialise ; pas trop en retard sautés sans perdre la phase                                                                                                                                                                                                                                 |
| `clock/playhead-queue.ts`                | Le pas audible est le dernier dont `time ≤ now` ; les événements passés sont purgés ; `null` avant le premier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `model/mapping.ts`                       | Bornes (0 → min, 1 → max), monotonie, cutoff exponentiel ; résonance linéaire en dB (milieu du knob = moyenne des bornes) ; `accentedQ` : même poussée en dB quelle que soit la résonance, jamais au-delà de `RESONANCE_Q_MAX_DB`                                                                                                                                                                                                                                                                                                                                                               |
| `model/pitch.ts`                         | Aller-retour pas ↔ index ↔ MIDI ↔ fréquence, bornes de la plage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `state.ts`                               | Chaque commande produit l'état attendu ; immuabilité (le snapshot précédent n'est pas muté) ; clamping des valeurs hors borne et de `NaN`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `synth/bass/bass-plan.ts`                | Note + octave → fréquence (le tuning passe par `applyParams`, testé dans `bass-voice.test.ts`) ; silence → aucun événement ; gate et enveloppe ; **pas tenu → glissé `target` de τ `SLIDE_TAU_S` au temps du pas, aucun événement d'enveloppe ni de Q** ; pas qui slide → pas de fermeture du VCA ; accent → pics supérieurs sur VCA, cutoff et Q, décroissance `ACCENT_ENV_DECAY_S` ; pas sans accent → aucun événement `filterQ` ; `timeConstant` > 0 et temps croissants au sens large par cible (`expectSane`) ; `cancel` en tête de chaque cible (C3, hors fermeture du VCA d'un pas tenu) |
| `model/pattern.ts`                       | `holdContext` : silences sautés, bouclage 15 → 0, pattern d'un seul pas lié à lui-même, tout en silence → aucun pas précédent                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `model/defaults.ts`                      | La ligne de départ porte accents et slides, commence sur la tonique accentuée et boucle par un slide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `synth/drums/drum-plan.ts` (lot 5)       | Vélocité 0 → rien ; voix mutée → rien ; niveau et queue monotones en vélocité (le choke se décide d'après ce qui sonne et se teste dans `drum-kit.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `synth/sidechain.ts` partie pure (lot 5) | Événements de ducking aux temps des kicks non mutés ; désactivé → rien ; profondeur = amount                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `generator/acid-generator.ts` (lot 6)    | Déterminisme à seed égale ; pas 0 = tonique ; toutes les notes dans la gamme ; densités observées dans une tolérance sur 200 tirages ; densité 0 → aucun drapeau ; densité 1 → tous ; undo restaure `previousPattern`                                                                                                                                                                                                                                                                                                                                                                           |
| `persistence/serialize.ts` (lot 7)       | Aller-retour JSON ; rejet d'un payload corrompu → défauts ; champ `version`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Un module de cette table modifié sans que son test bouge est suspect : soit le
changement n'est pas couvert, soit il ne change rien.

---

## Tests contre les fakes (§6.2, node)

`tests/fakes/fake-audio-context.ts` enregistre les nœuds créés par ordre de création
(`oscillators`, `bufferSources`, `gains`, `filters`, `shapers`), leurs branchements
(`connections`) et chaque appel aux `AudioParam` sous la forme `{ method, value, time }`
(`setValueAtTime`, rampes, `setTargetAtTime`, `cancelScheduledValues`). Il **lève sur une
rampe exponentielle vers ≤ 0** et sur un second `start()` d'une source. `currentTime` se
règle à la main, `setState('interrupted')` émet `statechange`, `createFakeVisibility()`
remplace l'API Page Visibility. `tests/fakes/fake-clock.ts` fournit `FakeClock` (temps
avancé à la main) et `FakeTimer` (`tick()` simule un réveil).

Ce qu'on vérifie avec :

- `bass-voice.ts` applique le plan fidèlement sur les bons paramètres, sans programmer
  dans le passé (`safeTime`), un oscillateur persistant câblé osc → filtre → VCA → drive
  → sortie, aucune allocation de source sur cent déclenchements, `release` annule le futur
  et referme le VCA, `dispose` arrête l'oscillateur. Liaison et accent : le pas qui suit un
  slide glisse sans rouvrir le VCA ; après un stop, il rejoue la note ; un silence entre
  les deux ne rompt pas la liaison ; un geste de résonance fait avant un accent programmé
  l'emporte après l'accent ; un stop pendant un accent ramène Q au knob.
- `index.ts` : `play` débloque l'audio, crée la voix, programme le premier pas ; `play`
  idempotent ; `stop` arrête le scheduler, relâche la voix, vide la tête de lecture ; les
  knobs atteignent la voix en lecture ; les niveaux du mix sont lissés, jamais écrits en
  direct ; `audibleStep` compense la latence de sortie ; `dispose` libère timer et
  oscillateur ; un slide fait glisser la fréquence au pas suivant, à son temps et vers sa
  note ; un slide sur le pas 15 n'avale pas le premier pas au démarrage et lie le pas 0 du
  deuxième tour.
- Drums (lot 5) : un nœud par frappe, `stop` appelé, débranché à `ended` et retiré du
  registre ; choke, stop avant départ, niveau et mute sur deux gains distincts dans
  `drum-kit.test.ts` ; mute quantifié à la mesure de bout en bout dans `index.test.ts`.
- Frontière : le lint suffit, mais un test qui importe `@engine` en node pur garantit
  qu'aucune dépendance DOM ou Svelte n'a fui.

Un nouveau nœud Web Audio utilisé par le moteur doit exister dans le fake, sinon le test
ne peut pas exister : vérifier que `fake-audio-context.ts` grandit avec le graphe. Avant
d'accepter une assertion sur un appel, relire ce que `ParamCall` enregistre à la version
revue. Depuis le lot 5, il enregistre le `timeConstant` de `setTargetAtTime`, et
`cancelScheduledValues` n'a pas de `value` : une assertion `every(c => c.value >= MIN_GAIN)`
doit filtrer les `cancel`. Une PR qui étend le fake est bienvenue.

Les tests localisent les nœuds par ordre de création (`ctx.gains.at(-1)`,
`const [master, bass] = ctx.gains`) ou par branchement : `findVca` dans `index.test.ts`
prend le gain branché en sortie du filtre, et survit à un changement de pattern ou d'accent.
Un test qui retrouve le VCA par « un appel avec `value === 1` » puis asserte « un appel à
1 » ne prouve rien, et casse dès que le premier pas est accentué ; `bass-voice.test.ts` le
fait encore (dette, `docs/PLAN.md`). Un nouveau test suit le modèle `findVca`.

---

## Tests de composants (§6.3, happy-dom)

Première ligne du fichier : `// @vitest-environment happy-dom` (le plan disait jsdom, le
code a tranché happy-dom). `render` de `@testing-library/svelte`, requêtes par rôle
(`getByRole('slider')`), de vrais `PointerEvent` construits avec `pointerId`, `clientX`,
`clientY`, `shiftKey`.

On vérifie :

- `Knob.svelte` : séquence pointerdown / pointermove / pointerup → `onchange` avec des
  valeurs bornées ; Shift = sensibilité réduite ; double-tap sans déplacement = défaut ;
  drag suivi d'un tap ≠ défaut ; pointeur non capturé ignoré ; clavier ; attributs ARIA.
- `StepCell.svelte` : affichage de la hauteur, bascule silence / accent / slide via les
  commandes attendues, indication « tenu », drag vertical et clavier changent la hauteur.
- Futur `DrumGrid.svelte` : clic = toggle à la vélocité par défaut, drag = réglage fin.
- Le pont `engine.svelte.ts` avec un moteur factice : un snapshot publié se reflète dans
  le composant.

Un composant ajouté sans test happy-dom n'est pas forcément bloquant si sa logique est
dans un module pur testé (ex. `knob-arc.ts`, `knob-math.ts`), mais un nouveau geste ou
un nouveau contrôle interactif sans test est une Suggestion ferme, et une régression
d'accessibilité non testée est un Bloquant.

---

## Tests de rendu audio réel (§6.4, lot 7)

Peu nombreux, lents, en Vitest browser mode avec Playwright et Chromium, dans
`tests/browser/` : rendre une mesure dans un `OfflineAudioContext`, RMS non nul pendant
une note et quasi nul pendant un silence, pic plus élevé sur un pas accentué, hauteur par
zéro-crossing en début et fin d'un pas slidé, kick présent au pas 0. Avant le lot 7, ne
pas les exiger ; au lot 7, ils conditionnent aussi l'export WAV de v4.

---

## Ce qui reste à l'oreille (§6.5)

La revue ne peut pas l'entendre. Elle le liste dans « À écouter avant de merger » à
partir de la section du lot dans `lot-checklists.md` et de ce que la PR touche :

- pas de clic à l'arrêt ni au changement de forme d'onde ;
- pas de zipper quand on tourne un knob ;
- le curseur tombe sur le pas entendu, à 60 comme à 160 BPM ;
- onglet caché puis retour : la lecture n'a pas décroché.

---

## Conventions observées dans le dépôt

- Fichier de test voisin : `x.ts` → `x.test.ts`, `X.svelte` → `X.svelte.test.ts`.
- `describe('<nomDeFonction | Composant>')`, parfois suffixé d'un thème
  (`planStep — accent`) ; `it('<comportement observable, en français>')`. Le libellé
  décrit le comportement, pas l'implémentation : « un silence ne programme rien », pas
  « appelle planStep avec rest ».
- Un helper `setup()` dans les fichiers qui construisent fakes et sujet (`index`,
  `bass-voice`, `context`, `scheduler`), `renderKnob()` et `pointer()` pour `Knob` ;
  `flush()` pour laisser passer les promesses de `play` ; aucun `beforeEach`.
- Assertions explicites, `toBe` largement en tête, puis `toEqual`, `toBeCloseTo` et
  `toMatchObject`, `expect.objectContaining` dans `toContainEqual` ; aucun snapshot, aucun
  `vi.mock`, `vi.fn()` seulement pour les callbacks.
- Les tests importent les constantes nommées (`GATE_RATIO`, `MIN_GAIN`,
  `START_DELAY_S`) plutôt que de recopier leur valeur : un test qui écrit `0.55` en dur
  cassera au premier réglage.

---

## Signaux d'alerte

- `vi.mock` d'un module du moteur (`bass-plan`, `mapping`, `timing`) : on teste le mock.
  Les seuls remplaçants légitimes sont les fakes Web Audio, horloge et timer.
- Test qui ne peut pas échouer : assertions sur des constantes, `expect(true)`, ou vérité
  recopiée depuis l'implémentation.
- Assertion non discriminante : oracle égal à la valeur par défaut (un moteur qui jouerait
  toujours C2 passerait), `toMatchObject` sur méthode et valeur sans le temps quand un
  autre événement a la même méthode et la même valeur (la fermeture de gate et le
  `release` posent tous deux `MIN_GAIN`), branche `if` d'un test jamais exécutée (un
  contrôle sur un type d'événement que le plan ne produit pas : préférer
  `expect(events).toEqual([])` sur la cible).
- Test de `bass-voice` qui asserte des compteurs d'appels sans vérifier valeur et temps.
- Chaîne de nœuds vérifiée seulement aux extrémités : un maillon débranché passe.
- `.only`, `.skip`, `.todo` : jamais fusionnés.
- Test lent ou dépendant d'un vrai timer (`setTimeout` de plusieurs centaines de ms) :
  `FakeTimer.tick()` existe pour ça.
- Nombre de tests annoncé dans la PR qui ne correspond pas au décompte : en mode local,
  la sortie de `pnpm test` ; en mode PR, les `it(` à la version revue
  (`references/github.md`, avec `[[:space:]]` et non `\s`, que le `git grep` de macOS ne
  connaît pas). À signaler en Nit, c'est la description qui est fausse.
- Test de geste avec un `dispatch` factice : la valeur ne bouge jamais pendant le geste,
  donc un tap « avec tremblement » passe même si le code relit une valeur déjà modifiée.
  Tester l'action elle-même avec un `getValue` qui suit les `onchange`
  (`knob-drag.test.ts`), avec des mouvements sous le seuil de tap et en plusieurs petits
  pas.
- Littéraux recopiés dans un test à la place d'une constante exportée (`36` pour
  `BASE_OCTAVE_MIDI`, `1200` pour `TUNING_RANGE_SEMITONES * 100`) : cassera au premier
  réglage.
