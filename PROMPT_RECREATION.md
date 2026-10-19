# Prompt de recréation — éditeur Blockly pour micro:bit V2

> À copier-coller intégralement dans une IA. Tout ce qui suit est prescriptif :
> chaque point marqué **PIÈGE** correspond à une erreur réellement commise et
> corrigée. Les ignorer redonne une application non fonctionnelle.

---

Agis en développeur expert JavaScript, Blockly et MicroPython pour micro:bit.
Génère une application web **locale**, sans build ni gestionnaire de paquets,
qui permet de programmer une carte **micro:bit V2** avec des blocs, de voir la
transcription MicroPython, de simuler le programme dans le navigateur, et
d'exporter un fichier `.hex` réellement exécutable sur la carte.

Le code, les commentaires et l'interface sont **en français**.

## 1. Architecture imposée

Un seul dossier, servi par son propre serveur Python (`app.py`, voir ci-dessous) :

| Fichier | Rôle |
| --- | --- |
| `index.html` | Interface, CSS, simulateur écrit en Python via Brython |
| `un.js` | Blocs, générateurs MicroPython, boîte à outils, téléchargements, simulateur (partie JS) |
| `deux.js` | Écriture du programme dans le système de fichiers MicroPython |
| `trois.js` | Emballage au format Universal Hex |
| `ia.js` | Reconnaissance d'images et de sons (Teachable Machine, `lib/tm/`), panneau IA |
| `tuto.js` | Visites guidées (menu Aide) : bulle, surbrillance, étapes qui attendent une action réelle |
| `bandeau.js` | Colle du bandeau : libellés Afficher/Masquer, voyant, sélecteur de carte, pastilles, recherche de blocs (§22, §23) |
| `exercices.js` + `exercices.json` | Exercices pas à pas, progression, mode évaluation ; les exercices sont des données (§25) |
| `site_web/` | Copie prête à héberger en site statique (§26) — à régénérer après chaque modification |
| `firmware.hex` | Image MicroPython officielle (fournie par l'utilisateur) |
| `app.py` | Serveur local : sert le dossier et **interdit la mise en cache** |
| `app.spec` | Recette PyInstaller, pour produire un `.exe` autonome |
| `lancer_projet.bat` | Démarrage du serveur local |
| `readme.txt` | Documentation destinée à l'utilisateur — aussi chargée en runtime par `fetch()` dans l'onglet Aide du panneau administrateur (§12) : doit rester à côté d'`index.html`, y compris dans `app.spec` |

`un.js`, `deux.js`, `trois.js` sont des **modules ES** (`<script type="module">`).
`file://` ne fonctionne pas : il faut impérativement passer par le serveur HTTP.

### PIÈGE nº 0 — ne pas servir avec `python -m http.server`

C'est le premier réflexe, et il coûte des heures. Ce serveur n'envoie **aucun**
en-tête `Cache-Control` : le navigateur applique alors sa propre heuristique et
ressert un ancien `index.html` ou `un.js` après modification. On corrige un
défaut, on recharge, le défaut est toujours là — et on cherche dans le code
alors que le code servi n'est pas celui du disque. Pire quand un autre projet a
occupé le même `http://localhost:8000` : son `firmware.hex` est resservi à la
place du bon.

Écrire un serveur d'une trentaine de lignes qui force les trois en-têtes :

```python
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
```

Y ajouter `allow_reuse_address = True` sur le `TCPServer` (sinon un redémarrage
rapide échoue sur « Address already in use »), l'ouverture du navigateur
**après** que le serveur écoute, et un message clair si le port est pris.

## 2. Bibliothèques (CDN, aucune installation)

```html
<script src="https://unpkg.com/blockly@10.4.3/blockly_compressed.js"></script>
<script src="https://unpkg.com/blockly@10.4.3/blocks_compressed.js"></script>
<script src="https://unpkg.com/blockly@10.4.3/python_compressed.js"></script>
<script src="https://unpkg.com/blockly@10.4.3/msg/fr.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.11.2/brython.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.11.2/brython_stdlib.min.js"></script>
```

**PIÈGE — épingler la version de Blockly.** Sans numéro, unpkg sert la dernière
parue ; une montée de version majeure casse la page du jour au lendemain sans
qu'on ait rien changé. Blockly 10.4.3 et 13.2.1 fonctionnent tous les deux.

Dans les modules :

```js
// trois.js — import nommé, ce paquet expose bien des exports nommés
import { createUniversalHex, isUniversalHex, separateUniversalHex, microbitBoardId }
  from 'https://esm.sh/@microbit/microbit-universal-hex';

// deux.js
import microbitFsDefaut, * as microbitFsNommes
  from 'https://cdn.skypack.dev/@microbit/microbit-fs';
const microbitFs = microbitFsDefaut || microbitFsNommes;
```

**PIÈGE — Skypack ne fournit pas d'export par défaut pour `microbit-fs`.**
`import microbitFs from '…'` donne `null`. D'où le double import ci-dessus.
La classe s'appelle **`MicropythonFsHex`** (M majuscule), pas `micropythonFsHex`.

**PIÈGE — Skypack ne sert pas `nrf-intel-hex`** (pas d'en-tête CORS). Ne pas en
dépendre : voir §3, la manipulation du hex se fait sur le texte.

## 3. Génération du `.hex` — la partie la plus piégeuse

### Le principe

MicroPython n'est pas compilé. Le programme est écrit **tel quel**, sous le nom
`main.py`, dans le petit système de fichiers situé à la fin de l'image
MicroPython. C'est le travail de `@microbit/microbit-fs`, et de lui seul.

### PIÈGE nº 1 — la forme de `createUniversalHex`

Elle attend **un tableau d'objets `{hex, boardId}`**. Ces deux écritures sont
fausses et produisent `Cannot read properties of undefined (reading 'replace')` :

```js
createUniversalHex([firmware, systemeDeFichiersHex]);              // FAUX
createUniversalHex([firmware, {name: 'main.py', data: code}]);     // FAUX
```

Forme correcte : `createUniversalHex([{ hex: monHexIntel, boardId: 0x9903 }])`.

### PIÈGE nº 2 — sans `microbit-fs`, le programme n'est nulle part

Une version qui n'importe que `microbit-universal-hex` produit un `.hex` de
taille plausible **qui ne contient aucun programme**. La carte redémarre sur
MicroPython nu. Il faut obligatoirement passer par `MicropythonFsHex`.

### PIÈGE nº 3 — le firmware n'est pas vierge

Un `.hex` exporté depuis <https://python.microbit.org> contient déjà un
programme. `MicropythonFsHex` le refuse :
`There are files in the MicropythonFsHex constructor hex file input`.
Aucune option ne contourne ce garde-fou (vérifié dans la source du paquet).

Solution : effacer la zone du système de fichiers **avant** de construire
l'objet. Les bornes viennent des données UICR du firmware, jamais de son
contenu — l'effacement ne change donc pas la taille de stockage disponible.

```js
function effacerFichiersDuFirmware(hexIntel) {
  const info = microbitFs.getIntelHexDeviceMemInfo(hexIntel);
  const debut = info.fsStartAddress, fin = info.fsEndAddress;
  if (!(fin > debut)) return hexIntel;

  const gardees = [];
  let basePoidsFort = 0;
  for (const ligne of hexIntel.split(/\r?\n/)) {
    if (!ligne.startsWith(':')) { if (ligne.trim()) gardees.push(ligne); continue; }
    const type = parseInt(ligne.substr(7, 2), 16);
    if (type === 0x04) {          // Extended Linear Address
      basePoidsFort = parseInt(ligne.substr(9, 4), 16) * 0x10000;
    } else if (type === 0x02) {   // Extended Segment Address
      basePoidsFort = parseInt(ligne.substr(9, 4), 16) * 0x10;
    } else if (type === 0x00) {
      const nb = parseInt(ligne.substr(1, 2), 16);
      const adresse = basePoidsFort + parseInt(ligne.substr(3, 4), 16);
      if (adresse < fin && adresse + nb > debut) continue;   // dans la zone : jeté
    }
    gardees.push(ligne);
  }
  return gardees.join('\n') + '\n';
}
```

Un enregistrement Intel hex fait au plus 32 octets et les bornes de la zone sont
alignées sur une page de flash : aucun enregistrement n'est à cheval, il suffit
donc de jeter ceux qui tombent dedans. Les enregistrements d'adresse et l'UICR
sont conservés.

Le constructeur doit être appelé en deux temps :

```js
function construireSystemeDeFichiers(entree) {
  const MicropythonFsHex = classeSystemeDeFichiers();
  try {
    return new MicropythonFsHex(entree);
  } catch (erreur) {
    if (!/There are files/i.test(erreur.message)) throw erreur;
    const nettoyee = Array.isArray(entree)
      ? entree.map(({hex, boardId}) => ({ hex: effacerFichiersDuFirmware(hex), boardId }))
      : effacerFichiersDuFirmware(entree);
    return new MicropythonFsHex(nettoyee);
  }
}
```

### PIÈGE nº 4 — firmware universel contre firmware Intel

Un firmware universel doit être **redécoupé** avant d'être confié au système de
fichiers, et le résultat récupéré par la méthode correspondante :

```js
const entree = isUniversalHex(firmwareDeBase)
  ? separateUniversalHex(firmwareDeBase).map(({hex, boardId}) => ({hex, boardId}))
  : firmwareDeBase;
const fs = construireSystemeDeFichiers(entree);
fs.write('main.py', codePython);
const resultat = Array.isArray(entree) ? fs.getUniversalHex() : fs.getIntelHex();
```

### PIÈGE nº 5 — firmware tronqué

Une copie interrompue donne un fichier sans enregistrement de fin, dont
l'analyse échoue bien plus loin sur un message incompréhensible
(`Checksum failed at record 847`). Refuser tout de suite :

```js
if (!/^:00000001FF\s*$/m.test(hex))
  throw new Error("firmware.hex est incomplet : l'enregistrement de fin manque "
                + `(${hex.length} octets reçus).`);
```

Indiquer le nombre d'octets reçus : c'est ce qui permet de distinguer un fichier
réellement tronqué d'un fichier valide sur le disque mais servi par le cache.

### PIÈGE nº 6 — ne jamais avaler l'erreur

```js
catch (error) { alert("Erreur de génération du fichier .hex."); }   // À BANNIR
```

Ce message passe-partout masque toutes les causes ci-dessus et fait perdre des
heures. Prévoir une zone de message dans la barre du haut qui affiche
`error.message`, et un `console.error` en plus.

Ne pas non plus **coller un conseil qui ne vaut que pour une phase** à toutes les
erreurs. Le suffixe « recliquez pour redésigner le lecteur » avait été ajouté à
tout échec d'envoi, y compris à ceux de la génération du `.hex` — il envoyait
chercher du côté du lecteur un défaut qui était dans le firmware. Générer le
fichier **avant** d'ouvrir le sélecteur de dossier, et ne suffixer que les
erreurs de la phase d'écriture.

### PIÈGE nº 7 — lire le firmware avec `cache: 'no-store'`

```js
const reponse = await fetch('./firmware.hex', { cache: 'no-store' });
```

Même avec le serveur du §1, une entrée déjà en cache survit. Un autre projet
servi auparavant sur le même `http://localhost:8000` laisse son propre
`firmware.hex` à la même adresse ; le navigateur ressert ce fichier-là, et
l'erreur est incompréhensible puisque le fichier sur le disque est valide.

### Le `.hex` produit n'est pas importable dans MakeCode — c'est normal

À préciser dans la documentation, sinon la question revient. Un `.hex` MakeCode
contient du code ARM compilé depuis TypeScript, plus le projet compressé en LZMA
derrière un en-tête JSON :

```json
{"compression":"LZMA","headerSize":290,"textSize":889,"name":"Untitled",
 "eURL":"https://makecode.microbit.org/","eVER":"1.2.13","pxtTarget":"microbit"}
```

C'est cet en-tête que MakeCode relit pour reconstruire les blocs. Le `.hex`
produit ici est une image MicroPython avec `main.py` dans le système de fichiers :
aucun en-tête PXT, donc MakeCode le refuse. L'inverse est vrai aussi.

Le fichier fonctionne parfaitement **sur la carte**, et
<https://python.microbit.org> sait le rouvrir (il lit `main.py` avec la même
bibliothèque `microbit-fs`). Prévoir en plus un bouton « Télécharger le script
.py » pour l'éditeur officiel et Mu. Ne pas chercher à produire un `.hex`
MakeCode : cela suppose la chaîne de compilation PXT.

### Import — le chemin inverse, avec la même bibliothèque

Demande de l'utilisateur : réimporter un `.py` ou un `.hex` déjà produit.
Comme Blockly ne sait pas transformer du Python en blocs (§13), un fichier
importé bascule directement en édition manuelle du code — jamais de
reconstruction en blocs, quelle que soit la source.

Le `.py` est trivial (texte lu tel quel avec `File.text()`). Le `.hex` est le
chemin inverse exact de la génération : reconstruire la même base propre
(notre `firmware.hex`, nettoyée si besoin — même fonction que pour écrire),
puis `MicropythonFsHex.importFilesFromHex(hexImporte)` pour charger la zone
système de fichiers **du fichier importé, pas de la base** — c'est bien ce
hex-là qui est lu, l'instance sert seulement de contexte —, et enfin
`.read('main.py')`. Vérifié par un aller-retour complet : générer un `.hex`,
l'importer aussitôt, comparer le texte relu à l'original (identique).

**PIÈGE nº 44 — un message d'erreur écrit pour un seul appelant devient faux
quand on réutilise la fonction pour un second cas d'usage.** La vérification
« fichier `.hex` complet » (`verifierFirmwareComplet`, regarde
`:00000001FF` en fin de fichier) existait déjà pour notre propre
`firmware.hex` sur disque, avec un message qui suppose ce contexte-là
(« le fichier a été copié à moitié... recharger par Ctrl+Maj+R »). Réutilisée
telle quelle pour valider un `.hex` importé par l'utilisateur, elle produit
un message qui parle à tort du cache du serveur et d'un fichier que
l'utilisateur n'a jamais touché. Paramétrer le nom du fichier ET le conseil
qui suit (deux branches de texte, pas seulement une interpolation de nom) dès
qu'une fonction de validation sert à plus d'un appelant.

### Envoi direct sur la carte

Bouton « Envoyer sur la carte » qui écrit le `.hex` sur le lecteur `MICROBIT`
via l'API d'accès aux fichiers (`showDirectoryPicker({ mode: 'readwrite' })`),
ce qui revient à un glisser-déposer.

**PIÈGE — le lecteur n'accepte que des `.hex`.** Y déposer un `.py` ne fait
rien : ce bouton envoie donc le `.hex`, pas le script.

Points à respecter :

- Vérifier que le dossier choisi porte `DETAILS.TXT` ou `MICROBIT.HTM`, et
  refuser tout autre dossier avec un message qui dit quoi choisir.
- `queryPermission` puis `requestPermission` en mode `readwrite` avant chaque
  écriture sur un dossier déjà mémorisé.
- **Après un transfert, la carte se réinitialise : son lecteur se démonte et se
  remonte, la référence mémorisée devient invalide.** Attraper l'échec, remettre
  la référence à zéro et inviter à recliquer. Sans cela, le deuxième envoi
  échoue sans explication.
- Distinguer `AbortError` (l'utilisateur a fermé le sélecteur) d'une vraie
  erreur : ce n'est pas un échec.
- L'API n'existe que sur Chrome et Edge. Ailleurs, désactiver le bouton avec
  l'explication en infobulle plutôt que de le laisser échouer.

Les alternatives — flash WebUSB via `dapjs` (`DAPLink.flash`), ou écriture de
`main.py` par le REPL série — sont plus rapides ou plus universelles, mais
demandent une bibliothèque externe et bien plus de mise au point.
`@microbit/microbit-connection` n'est pas utilisable depuis esm.sh : ses classes
de connexion n'y sont pas réexportées.

### Le chemin du firmware

`fetch('./firmware.hex')` suffit dans tous les cas, y compris derrière un
exécutable PyInstaller : le serveur sert depuis le dossier de `index.html`.
Ne pas ajouter de détection `blob:` ou `_MEIPASS` — elle ne se déclenche jamais
et les deux chemins résolvent vers la même URL.

## 4. API MicroPython réellement disponibles

Vérifiées présentes dans le firmware micro:bit V2 (v2.1.2, MicroPython 1.18) :

`neopixel`, `NeoPixel`, `fill`, `clear`, `show`, `i2c` (`init`/`read`/`write`/`scan`),
`machine.time_pulse_us`, `machine.freq`, `utime.sleep_us`, `utime.ticks_us`, `ustruct.unpack`,
`uart` (`baudrate`/`tx`/`rx`/`any`/`readline`), `write_digital`, `read_digital`,
`read_analog`, `write_analog`, `set_analog_period`, `set_pull`, `NO_PULL`,
`PULL_UP`, `radio` (`on`/`off`/`config`/`send`/`receive`/`receive_full`).

**`write_analog` n'accepte que 0 à 1023** et lève une exception au-delà. Tout
générateur qui y transmet une valeur venue de l'utilisateur doit la borner dans
le code produit — `max(0, min(1023, valeur))` — sinon le programme s'arrête sur
la carte sans le moindre message.

## 5. Blockly — blocs et générateurs

Syntaxe moderne **obligatoire** :

```js
Blockly.Python.forBlock['mon_bloc'] = function(block, generateur) { … };
```

### PIÈGE nº 8 — l'import `from microbit import *`

**Chaque générateur** produisant du code qui touche à l'API de la carte doit le
déclarer. Oublier revient à livrer un programme qui s'arrête au démarrage sur
`NameError: name 'display' isn't defined`. Sont concernés : `display`, `Image`,
`button_a`/`button_b`, `accelerometer`, `compass`, `microphone`, `SoundEvent`,
`Sound`, `pin_logo`, `pinN`, `temperature()`, `running_time()`, `sleep()`,
`reset()`. **`Sound` appartient au module microbit** : le bloc `audio.play` a
donc besoin des deux imports.

```js
function importerMicrobit() {
  Blockly.Python.definitions_['import_microbit'] = 'from microbit import *';
}
function importerModule(nom) {
  Blockly.Python.definitions_['import_' + nom] = 'import ' + nom;
}
```

### PIÈGE nº 9 — indentation

Toujours utiliser `Blockly.Python.INDENT` (2 espaces), jamais une valeur écrite
en dur. Mélanger 4 et 2 espaces dans la même suite donne un `IndentationError`
et le programme ne démarre pas.

### PIÈGE nº 10 — largeur des blocs

Un bloc dont tous les champs tiennent sur une ligne impose sa largeur au tiroir
de toute la catégorie. Mesuré : un bloc « répéter toutes les H h M min S s MS ms »
en une ligne faisait 539 px et portait le tiroir à 584 px, ne laissant que
quelques pixels de canevas utile. Répartir les champs sur plusieurs lignes
(`appendDummyInput()` successifs) ou utiliser `setInputsInline(false)`.
Viser un tiroir sous 400 px.

### PIÈGE nº 11 — conversion en texte

`display.scroll`, `display.show` et `radio.send` n'acceptent que des chaînes ;
un nombre lève un `TypeError` sur la carte. Ne pas mettre `setCheck("String")`
sur ces entrées — cela empêcherait d'y brancher un capteur — mais convertir dans
le générateur, en laissant les littéraux texte tranquilles :

```js
function versTexte(block, nomEntree) {
  const branche = block.getInputTargetBlock(nomEntree);
  if (!branche) return "''";
  const code = P.valueToCode(block, nomEntree, P.ORDER_NONE) || "''";
  const types = branche.outputConnection && branche.outputConnection.getCheck();
  return (Array.isArray(types) && types.includes('String')) ? code : 'str(' + code + ')';
}
```

### Espace de travail par défaut

Un espace vide au premier lancement laisse l'élève devant une page blanche.
Poser d'emblée un bloc **« Au démarrage »** et un bloc **« Répéter
indéfiniment »**, aux deux emplacements attendus. « Au démarrage » est limité à
un exemplaire : `maxInstances: { 'au_demarrage': 1 }` dans les options de
l'espace de travail — Blockly grise alors l'entrée du tiroir toute seule.

### Catégories dynamiques : Variables et Fonctions

`{ "kind": "category", "name": "Variables", "custom": "VARIABLE" }` et
`{ "kind": "category", "name": "Fonctions", "custom": "PROCEDURE" }`. Blockly
remplit ces tiroirs lui-même : définition, définition avec retour, retour
conditionnel, plus **un bloc d'appel par fonction créée**, portant son nom.

À dire à l'utilisateur, car cela surprend : tant qu'aucune fonction n'existe, le
tiroir ne montre que les blocs de définition. C'est la différence avec
Vittascience, qui affiche d'emblée un bloc d'appel générique. Un bloc d'appel ne
peut pas exister sans fonction cible.

Les fonctions sont écrites en tête du programme, avant tout code exécutable,
comme les gestionnaires du §6 : les blocs peuvent donc être posés n'importe où.

### Réorganiser la boîte à outils à chaud

`workspace.updateToolbox({ kind: 'categoryToolbox', contents: […] })` remplace
le tiroir sans réinjecter Blockly. C'est la base d'une fonctionnalité bien
plus large réservée à l'enseignant — réordonner, masquer, renommer les
catégories et leurs sous-menus, en créer, changer le texte affiché sur un
bloc — détaillée au §12 (Panneau administrateur), à construire directement
sous cette forme complète plutôt que comme un simple bouton de réordonnancement
qu'il faudrait généraliser ensuite.

## 6. Les blocs « lorsque … » (événements)

MicroPython n'a **pas** de système d'événements. Chaque bloc « lorsque … »
produit une fonction `on_…()`, et l'application ajoute une boucle de scrutation.

```js
const GESTIONNAIRES = [
  ['def on_button_pressed_a(',  'if button_a.is_pressed(): on_button_pressed_a()'],
  ['def on_button_pressed_b(',  'if button_b.is_pressed(): on_button_pressed_b()'],
  ['def on_button_pressed_ab(', 'if button_a.is_pressed() and button_b.is_pressed(): on_button_pressed_ab()'],
  ['def on_logo_touched(',      'if pin_logo.is_touched(): on_logo_touched()'],
  ['def on_logo_released(',     'if not pin_logo.is_touched(): on_logo_released()'],
  ['def on_pin_pin0_touched(',  'if pin0.is_touched(): on_pin_pin0_touched()'],
  ['def on_pin_pin1_touched(',  'if pin1.is_touched(): on_pin_pin1_touched()'],
  ['def on_pin_pin2_touched(',  'if pin2.is_touched(): on_pin_pin2_touched()'],
  ['def on_pin_pin0_released(', 'if not pin0.is_touched(): on_pin_pin0_released()'],
  ['def on_pin_pin1_released(', 'if not pin1.is_touched(): on_pin_pin1_released()'],
  ['def on_pin_pin2_released(', 'if not pin2.is_touched(): on_pin_pin2_released()'],
  ['def on_gesture_shake(',     "if accelerometer.was_gesture('shake'): on_gesture_shake()"],
  ['def on_gesture_up(',        "if accelerometer.was_gesture('up'): on_gesture_up()"],
  ['def on_gesture_down(',      "if accelerometer.was_gesture('down'): on_gesture_down()"],
  ['def on_sound_LOUD(',        'if microphone.was_event(SoundEvent.LOUD): on_sound_LOUD()'],
  ['def on_sound_QUIET(',       'if microphone.was_event(SoundEvent.QUIET): on_sound_QUIET()'],
];
```

**PIÈGE nº 12 — toute fonction `on_…` que peuvent produire les blocs doit
figurer dans cette table.** Sinon le bloc correspondant définit une fonction que
personne n'appelle : il ne fait strictement rien, sans le moindre message.

Injection, avec l'indentation prise sur la ligne trouvée :

```js
if (appels.length) {
  const boucles = /^([ \t]*)while True:[ \t]*$/gm;
  if (boucles.test(code)) {
    boucles.lastIndex = 0;
    code = code.replace(boucles, (ligne, marge) =>
      ligne + '\n' + appels.map(a => marge + P.INDENT + a).join('\n'));
  } else {
    code += '\n# --- Boucle des événements (générée automatiquement) ---\n'
          + 'while True:\n' + appels.map(a => P.INDENT + a).join('\n') + '\n'
          + P.INDENT + 'sleep(100)\n';
  }
}
```

**PIÈGE nº 13 — `String.replace` avec une chaîne ne remplace que la première
occurrence.** Utiliser une expression régulière avec `g`, sinon un programme à
deux boucles infinies ignore les boutons dans l'une d'elles.

**PIÈGE nº 14 — les fonctions `on_…` doivent remonter en tête de programme.**
Blockly génère les blocs de premier niveau dans l'ordre de leur **position**. Un
bloc « lorsque … » posé à droite ou en dessous d'une boucle produit donc sa
fonction *après* l'appel qui l'utilise, et le programme s'arrête sur un
`NameError: on_button_pressed_a`. Les émettre via `definitions_` plutôt qu'en
retour du générateur :

```js
function declarerGestionnaire(nom, corps) {
    const contenu = corps.replace(/\s+$/, '');
    P.definitions_['gestionnaire_' + nom] =
        'def ' + nom + '():\n' + (contenu || P.INDENT + 'pass');
    return '';
}
```

Les définitions sont placées avant tout code exécutable, quelle que soit la
disposition des blocs.

**PIÈGE nº 43 — `workspaceToCode()` génère aussi le code des blocs de
premier niveau qui ne sont accrochés à RIEN.** `Blockly.Python.workspaceToCode()`
appelle `blockToCode` sur chaque bloc de haut niveau (`getTopBlocks()`), pas
seulement sur `au_demarrage`/`boucle_infinie`/les blocs « lorsque … » — un
bloc d'instruction posé seul sur l'espace de travail (jamais accroché, ou
détaché d'une pile) est TOUT AUSSI « de haut niveau » à ses yeux, donc son
code est généré et exécuté une fois, en dehors de toute structure visible à
l'écran. Un piège pour l'élève (il croit qu'un bloc posé sans le connecter
ne fait rien) découvert seulement après une demande explicite de
l'utilisateur (afficher ces blocs comme désactivés). Détection d'un
« conteneur légitime » par la **structure**, pas par une liste de noms de
blocs à maintenir : `!bloc.previousConnection && !bloc.outputConnection`
(un bloc qui ne PEUT structurellement pas être accroché à autre chose —
vrai pour tous les blocs « lorsque … » et `au_demarrage`). Piège dans le
piège : `boucle_infinie` a les deux connecteurs (`setPreviousStatement` ET
`setNextStatement`, pour pouvoir en théorie être chaîné) alors qu'il doit
rester fonctionnel tout seul comme les autres conteneurs — la seule
exception non déductible de la structure, à exclure à la main
(`bloc.type === 'boucle_infinie'`). `bloc.getRootBlock()` remonte à
l'ancêtre commun quel que soit le type d'emboîtement (pile « suivant »,
entrée d'instruction, entrée de valeur), donc un seul passage sur
`getAllBlocks()` — comparé à `estContainerLegitime(bloc.getRootBlock())` —
suffit à la fois pour désactiver un orphelin et pour réactiver
automatiquement un bloc qui vient d'être correctement accroché, sans cas
particulier à écrire pour ce second sens. `Block.setEnabled()` (API Blockly
standard, pas une classe CSS maison) fait les deux choses d'un coup : rendu
visuel grisé/hachuré ET exclusion de `blockToCode` (qui saute un bloc
désactivé — et, point d'attention, saute SEULEMENT ce bloc-là, pas sa pile
« suivant » en dessous : désactiver uniquement la racine d'un orphelin ne
suffit pas si d'autres blocs sont accrochés dessous, d'où le passage sur
TOUS les blocs, pas seulement les racines).

## 7. Le simulateur (Brython)

Panneau de droite : une carte dessinée en CSS (25 LED, boutons A/B, logo,
broches), un bouton « Lancer la simulation », un bouton « Secouer la carte »,
un bouton « Réinitialiser la simulation ».

Le code MicroPython courant est exécuté par `exec(code, env)` où `env` contient
des objets factices (`display`, `button_a`, `accelerometer`, `radio`, `music`,
`audio`, `speech`, `pinN`…) qui pilotent le dessin.

Points à respecter :

- **Remplacer `while True:` par `for _ in range(5):`** — avec `replace()` sans
  argument de comptage, qui en Python remplace **toutes** les occurrences.
  Sinon la seconde boucle fige l'onglet.
- **Retirer les lignes d'import** (`from microbit import *`, `import radio`,
  `import music`, `import audio`, `import speech`, `import time`, `import math`,
  `import random`, `import neopixel`, `import machine`, `import utime`,
  `import ustruct`) avant l'`exec`.
- **`radio` doit figurer dans `env`.** Son oubli donne
  `name 'radio' is not defined` sur tout programme radio.
- **Remonter l'erreur à l'écran**, pas seulement dans la console : sinon la
  simulation semble ne rien faire.
- **File d'attente** : les actions (affichage, son, LCD, ruban) sont empilées
  puis rejouées dans l'ordre, avec les pauses. Les capteurs (distance, joystick,
  couleur, température) sont lus **directement** au moment où le programme les
  demande.
- **Jeton d'exécution** : chaque suite différée (pause, défilement, note) vérifie
  qu'elle appartient toujours à l'exécution courante avant de reprendre la file.
  Sans cela, une exécution interrompue reprend la main au milieu de la suivante.
- **Gestes ponctuels** : « Secouer » arme le geste, lance la simulation, puis le
  désarme. `was_gesture()` **consomme** le geste (vrai une seule fois),
  `is_gesture()` le constate sans le consommer. Vérifiable : sur 5 tours de
  boucle, le premier déclenche 1 fois, le second 5 fois.

**PIÈGE nº 37 — les icônes prédéfinies (`Image.HAPPY`, `SAD`, `GHOST`...) ont
un motif de pixels précis, pas un dessin approximatif.** `display.show(val)`
mappe chaque nom d'icône à une liste d'index (0-24, `y*5+x`) de LED allumées ;
rien ne rapproche automatiquement ce mapping du vrai micro:bit, donc une liste
tapée à la main peut « ressembler » à un visage sans être la bonne — c'est
resté indétecté jusqu'à ce qu'un utilisateur compare visuellement HAPPY et
SAD affichés côte à côte et remarque que ni l'un ni l'autre n'avait la forme
attendue. Vérifier chaque icône contre la définition officielle
(`microbit_constimage.c` du dépôt `microbit-foundation/micropython-microbit-v2`,
`SMALL_IMAGE(...)` en grille 5×5 de 0/1) plutôt que de redessiner à l'œil :

```
HAPPY : 0,0,0,0,0 / 0,1,0,1,0 / 0,0,0,0,0 / 1,0,0,0,1 / 0,1,1,1,0
  → index allumés : 6,8,15,19,21,22,23
SAD   : 0,0,0,0,0 / 0,1,0,1,0 / 0,0,0,0,0 / 0,1,1,1,0 / 1,0,0,0,1
  → index allumés : 6,8,16,17,18,20,24
GHOST : 1,1,1,1,1 / 1,0,1,0,1 / 1,1,1,1,1 / 1,1,1,1,1 / 1,0,1,0,1
  → index allumés : 0,1,2,3,4,5,7,9,10,11,12,13,14,15,16,17,18,19,20,22,24
```

`HEART` était déjà correcte (comparée à la même source en corrigeant ce
piège) ; seules HAPPY, SAD et GHOST avaient un motif erroné.

### Le son

Le simulateur doit **réellement** émettre du son, via Web Audio, en onde carrée
(timbre proche du buzzer de la carte). Chaque note est un couple
`[fréquence Hz, durée ms]`, fréquence nulle = silence, avec une petite enveloppe
d'attaque et d'extinction pour éviter les claquements.

Les mélodies de `music` suivent le découpage officiel : 1 temps = 4 tics à
120 bpm, donc **1 tic = 125 ms**. Exemple fidèle pour `DADADADUM`
(`['r4:2','g','g','g','eb:8','r:2','f','f','f','d:8']`) :

```
[[0,250],[392,250],[392,250],[392,250],[311.13,1000],
 [0,250],[349.23,250],[349.23,250],[349.23,250],[293.66,1000]]
```

`speech.say()` passe par `window.speechSynthesis` en `en-GB` (le module speech
de la carte parle anglais), avec repli sur une alerte.

### Les périphériques dessinés

Sous la carte, un panneau « Périphériques Grove » où **chaque section
n'apparaît que si un bloc du module correspondant est posé** dans le programme
(voir §11). Une simple table `[idDeSection, expressionRégulièreSurLeTypeDeBloc]`
suffit, réévaluée à chaque changement de l'espace de travail.

Ces sections valent la peine d'être dessinées pour de bon, pas résumées en
texte — c'est ce qui permet de reconnaître le montage réel :

- **Afficheur 4 digits** — de vrais sept segments : n'affichez pas un texte,
  allumez les segments d'après le **motif exact** que le pilote envoie à la
  puce. Boîtier noir à bord arrondi, chiffres cyan penchés de 8°, halo sur les
  segments allumés, segments éteints faiblement visibles.
- **Écran LCD 1602** — cadre noir, rétroéclairage bleu, caractères clairs.
  Chaque caractère occupe **sa propre cellule** de 5 × 8 points (10 × 16 px),
  ce qui aligne le texte en colonnes et rend visible une cellule vide. Une
  trame sombre au pas du point, posée **par-dessus** le texte
  (`repeating-linear-gradient` sur les deux axes, `pointer-events: none`),
  découpe les jambages et donne l'aspect matriciel sans avoir à redessiner une
  fonte 5 × 8 caractère par caractère. Rétroéclairage éteint : l'écran vire au
  gris-vert et le texte reste faiblement lisible, plutôt qu'un fondu global qui
  effacerait tout.
- **LED sur broche** — une pastille par broche effectivement pilotée. L'éclat
  suit la **racine carrée** du rapport cyclique : la luminosité perçue ne suit
  pas le rapport cyclique, et à 256/1023 l'œil voit environ 57 %, pas 25 %.
- **Servomoteurs** — un cadran par broche, avec le bras qui tourne. Rotation
  continue : une animation, dont la durée est l'inverse de la vitesse.
- **Ruban RGB**, **joystick**, **gestes**, **capteurs** (curseurs), **radio**
  (champ texte + « Simuler la réception »).

**PIÈGE nº 15 — l'opacité s'applique à tous les descendants.** Une pastille de
LED dont l'éclat tombe à zéro emporte le socle sombre dessiné à l'intérieur
d'elle. Séparer les deux éléments : le socle porte l'apparence au repos, un
enfant distinct porte l'éclat.

**PIÈGE nº 16 — un caractère rogné ne se voit pas au premier coup d'œil.**
Dans une cellule LCD de 10 px de large, une police de 16 px déborde de 1 px sur
`A`, `V` et `_`. Se mesure : `canvas.measureText(ch).actualBoundingBoxLeft +
actualBoundingBoxRight` pour l'encre réelle, comparé à la largeur de la
cellule. Ne pas mesurer avec un `Range` sur le contenu — cela donne la boîte de
ligne, identique pour tous les caractères, donc inutile.

**PIÈGE nº 41 — un dégradé de fond partagé entre deux formes voisines peut
cacher une collision géométrique, puis la révéler brutalement dès qu'on le
modifie.** Le connecteur de bord du micro:bit (`#microbit-board`, réglette
`.mb-edge`) simulait ses petites dents dorées avec un seul
`repeating-linear-gradient` en fond, et les gros plots ronds (`.mb-pin`,
coins arrondis à 15px) posés PAR-DESSUS avec `justify-content: space-around`
pour laisser voir le dégradé dans les interstices. Avec un motif dense et
fin (2px/2px), ça passait inaperçu. Signalé une première fois par
l'utilisateur (deux captures d'écran comparant notre rendu et le diagramme
officiel) comme trop dense — rendu plus épars par pixel-diffing des deux
images (voir plus haut) — puis, deuxième signalement (« c'est encore pire »),
il est apparu que le motif épars révélait un vrai défaut resté invisible
jusque-là : dans l'espace étroit laissé entre deux plots voisins, leurs
coins à 15px de rayon se rapprochaient presque jusqu'à se toucher, dessinant
une pointe triangulaire parasite au lieu d'une dent verticale nette — un
défaut de géométrie, pas de couleur, que la densité de l'ancien motif
masquait simplement en noyant le tracé dans une texture uniforme. Confirmé
en isolant un seul espace inter-plot à fort zoom (`element.cloneNode` dans
un conteneur `position:fixed` séparé — nécessaire ici car l'appli réapplique
elle-même une échelle responsive sur `#microbit-board`, qui écrasait un
`style.transform` posé directement dessus). Corrigé en séparant les deux
rôles en deux éléments : les dents deviennent un rectangle plein à part
(`.mb-dents`, `flex: 1 1 auto`, son propre dégradé), les plots gardent des
coins à peine arrondis (4px) — aucune circonstance où les deux formes
peuvent se chevaucher. Leçon générale : quand deux formes voisines
partagent un même fond dégradé pour économiser du balisage, une modification
de l'une (ici, l'espacement du motif) peut rendre visible un défaut de
l'autre (ici, le rayon des coins) qui n'a rien à voir avec ce qu'on vient de
changer — vérifier la géométrie sous-jacente, pas seulement retoucher les
couleurs/espacements en boucle.

**PIÈGE nº 42 — un même mot de l'utilisateur peut désigner un défaut
différent à chaque fois ; et une forme organique (bord ondulé) résiste au
CSS, pas au SVG.** Le connecteur de bord du micro:bit a traversé huit passes
de corrections successives, chacune déclenchée par un nouveau message
utilisateur contenant le mot « encoches » ou « bord » — mais visant à
chaque fois un défaut réellement différent : d'abord un rayon de coin trop
grand qui grignotait la réglette (§ précédent), puis un motif de dents trop
dense, puis une collision géométrique entre deux formes voisines, puis un
style de référence entièrement différent (photo produit vs simulateur
MakeCode officiel), et enfin le vrai bord « bosselé » propre au V2
(explicitement documenté sur microbit.org : bord ondulé sur V2, plat sur
V1) — une caractéristique réelle de la carte que la toute première capture
de référence utilisée ne montrait simplement pas, d'où une fausse piste
tenue pour acquise pendant plusieurs passes. Leçon : ne jamais supposer que
deux signalements qui se ressemblent en surface parlent du même défaut —
demander ou obtenir une capture/un repère visuel précis dès que la première
correction ne suffit pas, plutôt que de deviner une deuxième fois. Deuxième
leçon, technique celle-ci : le bord ondulé (une suite d'arcs peu profonds)
a résisté à plusieurs tentatives en CSS pur (`border-radius`, dégradés
partagés entre éléments voisins) qui ratent systématiquement les formes
organiques — un simple `<path>` SVG avec des commandes `Q` (courbe
quadratique) le trace directement, sans recoller des rectangles/cercles
entre eux. Le motif de petites dents, peint dans le même `<path>` via un
`<pattern>` en remplissage, ne déborde plus jamais du contour ondulé
(contrairement à un dégradé CSS posé à côté d'une forme découpée par
ailleurs). Les identifiants `#pin0`/`#pin1`/`#pin2` utilisés par
`lierCapteurTactile()` (écouteurs `mousedown`/`mouseup`) portent aussi bien
sur un `<rect>` SVG que sur un `<div>` — `getElementById` et
`addEventListener` ne distinguent pas les deux, aucune adaptation JS n'a
été nécessaire pour ce changement de balisage.

## 8. Servomoteurs

Catégorie « Servos » sur P0, P1, P2. Conventions reprises de MakeCode
(`pxt-common-packages`, `libs/servo`) — **les relever à la source plutôt que de
les supposer** :

- angle 0–180° ↔ impulsion **500–2500 µs** dans une période de 20 ms (50 Hz) ;
- `setRange` : le mini est ramené entre 0 et 90, le maxi entre 90 et 180 ;
- `run(vitesse)` transpose −100…100 % sur l'intervalle ;
- avec « arrêt au neutre », MakeCode compare l'angle à `(maxi − mini) >> 1`.
  Avec l'intervalle 0–180 par défaut cela donne bien 90, mais avec un intervalle
  décalé le résultat surprend. Reproduire tel quel pour rester fidèle, et le
  documenter ;
- `stop()` cesse d'envoyer des impulsions : le servomoteur reste où il est.

En MicroPython : `broche.set_analog_period(20)` puis
`broche.write_analog(int(microsecondes * 1023 / 20000))`.

**PIÈGE — la clé d'état.** Ne pas indexer l'état par l'objet broche : passer le
nom de la broche depuis le générateur (`_servo_angle(pin0, "P0", 45)`). Sinon la
clé dépend de la représentation de l'objet, ce qui n'est pas garanti unique.

## 9. Modules Grove

Catégorie « Grove », **découpée en sous-catégories** (une par module) : 39 blocs
dans un seul tiroir demandent plus de deux écrans de défilement et les derniers
deviennent introuvables. Blockly accepte les catégories imbriquées dans un
`categoryToolbox`.

### Le cas de la LED simple : pas de pilote du tout

Sous-catégorie « LED », deux blocs :

```python
pin0.write_digital(1)                       # contrôler la LED à HAUT / BAS
pin0.write_analog(max(0, min(1023, 1023)))  # régler la luminosité
```

C'est le seul module **sans pilote**, et c'est délibéré : une LED se commande
directement par la broche, et c'est justement ce qu'il faut montrer à l'élève.
Ne pas l'envelopper dans une fonction `_grove_led()` par souci d'uniformité —
cela masquerait la seule chose qu'il y a à comprendre. Bornage obligatoire,
voir §4.

Conséquence côté simulateur : ce sont `write_digital` / `write_analog` du
substitut de broche qui alimentent l'affichage. Toute écriture y figure donc,
servomoteur compris — c'est exact, une LED réellement câblée sur cette broche
s'allumerait aussi ; le dire plutôt que d'essayer de filtrer.

### Registre des périphériques

**PIÈGE nº 17 — ne pas exiger un bloc « définir » préalable.** Un programme qui
utilise « afficher le nombre » sans avoir posé « définir l'afficheur » échoue sur
`name 'afficheur' is not defined`, à l'exécution seulement, et silencieusement
sur la carte. Créer les périphériques à la première utilisation :

```python
_grove_objets = {}

def _grove_obj(nom, fabrique):
    if nom not in _grove_objets:
        _grove_objets[nom] = fabrique()
    return _grove_objets[nom]

def _grove_afficheur():
    return _grove_obj("afficheur", lambda: _Afficheur4(pin0, pin1))
```

Les blocs d'usage appellent `_grove_afficheur().nombre(12)`. Le bloc « définir »
devient facultatif et se contente d'écrire dans le registre :
`_grove_objets["afficheur"] = _Afficheur4(pin2, pin8)`.

Un **dictionnaire** et non des variables : on peut y écrire depuis l'intérieur
d'une fonction « lorsque … » sans déclarer `global`.

### Pilotes encadrés par des marqueurs

Les pilotes de ces modules ne sont pas dans le firmware : ils sont écrits dans
le programme généré, via `definitions_`. Chacun est encadré par un marqueur qui
**porte son nom** :

```
# >>> pilote lcd1602
…
# <<< pilote lcd1602
```

Le simulateur retire ces régions :

```python
code = re.sub(r"# >>> pilote \S+.*?# <<< pilote \S+", "", code, flags=re.S)
```

et injecte ses propres objets à la place. Sans cette séparation, le pilote
TM1637 bit-bangerait dans le vide et le PAJ7620 planterait sur l'I²C.

Le nom dans le marqueur n'est pas décoratif : c'est lui qui sert d'intitulé au
repli décrit juste après. Un marqueur générique (`# >>> pilote grove` pour
tous) rendrait ce repli inutilisable.

### Replier les pilotes dans la transcription affichée

Sans cela la transcription est illisible : sur un programme LCD de trois blocs,
le pilote fait **1470 caractères pour 144 de programme**. L'élève ne voit que de
la plomberie.

Remède : à l'affichage seulement, remplacer chaque région marquée par un
`<details>` refermé, dont le résumé annonce le module et la taille — « pilote
lcd1602 — 39 lignes ». Ce qui est déplié le reste quand les blocs changent.

**Le repli ne concerne QUE l'affichage** : le `.hex` et le `.py` contiennent
toujours les pilotes en entier. C'est la différence avec Vittascience, qui écrit
ses pilotes dans des modules séparés sur la carte (`from lcd_i2c import
LCD1602`) : leur transcription est courte parce que le pilote est ailleurs, pas
parce qu'il est plus petit. Le choix retenu ici garde un `main.py` autonome,
donc un `.py` téléchargeable qui fonctionne seul — à expliquer à l'utilisateur,
qui compare forcément les deux.

### Constantes vérifiées (sources : bibliothèques Seeed)

| Module | Adresse I²C | Points clés |
| --- | --- | --- |
| LED simple | — | aucun pilote : `write_digital` / `write_analog` bornés à 0–1023 |
| Ruban WS2813 | — | module `neopixel` intégré ; pas de réglage de luminosité, atténuer les couleurs avant envoi |
| TM1637 4 digits | 2 fils | `0x40` mode écriture, `0xC0` adresse, `0x88 \| lum` contrôle ; segments `0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F` |
| Ultrason | 1 fil | déclenchement 10 µs, `machine.time_pulse_us(broche, 1, 30000)`, cm = durée/58, pouces = durée/148 |
| Joystick | analogique | 0–1023 ; appui sur le manche → axe X sous 250 |
| PAJ7620 gestes | `0x73` | banque `0xEF`, résultats `0x43` (8 gestes) et `0x44` (vague) ; table d'init de 50 registres, à reprendre de `Seeed-Studio/Gesture_PAJ7620`, `src/paj7620.h` |
| AHT20 / DHT20 | `0x38` | init `BE 08 00`, mesure `AC 33 00` + 80 ms, lecture 7 octets, CRC8 sur les 6 premiers |
| LCD 16x2 v1 (JHD1802) | `0x3E` | commande `[0x80, cmd]`, donnée `[0x40, val]`, curseur `col\|0x80` ou `col\|0xC0` |
| VEML6040 | `0x10` | config `[0x00,0x00,0x00]` ; canaux R `0x08`, V `0x09`, B `0x0A`, W `0x0B` ; 16 bits, poids faible en tête |
| DRV8830 | canal 1 `0x65`, canal 2 `0x60` | vitesse `((abs(v)&0x3F)<<2) \| (1 si v<0 sinon 2)` en `0x00` ; défaut en `0x01`, effacement `0x80` |
| SCD30 | `0x61` | démarrage `0x0010`, prêt `0x0202`, lecture `0x0300` → 18 octets, 3 flottants IEEE `>f` |
| SCD41 | `0x62` | `0x3F86` arrêt, `0x3646` réinit, `0x21B1` démarrage, prêt `0xE4B8`, lecture `0xEC05` → 9 octets |

CRC8 Sensirion commun à AHT20 et SCD, à factoriser : polynôme `0x31`, valeur
initiale `0xFF`.

**Attention aux adresses DRV8830** : la documentation Seeed donne `0xCA` et
`0xC0` sur 8 bits ; il faut les décaler d'un bit → `0x65` et `0x60`.

### DHT11 et DHT22 — protocole 1 fil, fiables seulement sur micro:bit V1

Le protocole impose de mesurer des impulsions de 26 à 70 µs, hors de portée
d'une boucle Python interprétée. Solution : un pilote en **assembleur ARM
Thumb** (`@micropython.asm_thumb`), repris de `rhubarbdog/microbit-dht11`
(MIT) — ne pas réécrire ces instructions à la main sans banc de mesure, un
décalage de délai casse silencieusement la lecture. DHT11 et DHT22 partagent
exactement la même capture bas niveau (mêmes durées d'impulsion) ; seul le
décodage des 5 octets reçus diffère :

- **DHT11** : quatre octets entier+décimale (humidité, température), un
  octet de somme de contrôle.
- **DHT22** : deux fois 16 bits ×10 (humidité, température avec bit de signe
  sur le poids fort du 3ᵉ octet), même octet de somme de contrôle.

**PIÈGE nº 18 — un pilote calibré sur un modèle de carte ne l'est pas
forcément sur un autre, même « compatible ».** micro:bit V1 (nRF51822) tourne
à 16 MHz, V2 (nRF52833) à 64 MHz : les boucles de délai de l'assembleur
échantillonnent 4× trop vite sur V2 et ratent le signal. Un correctif
communautaire existe (multiplier le délai par 4) mais reste décrit comme
instable par son propre auteur. Le décalage bit-à-bit qui relie chaque broche
au registre GPIO n'a, lui, jamais été revérifié pour le V2 par personne — et
rien ne garantit qu'il soit identique, les deux puces n'ayant pas le même
routage physique. **Ne pas deviner : refuser proprement au runtime.**
`machine.freq()` distingue les deux cartes (`> 20 000 000` = V2) ; la lecture
renvoie alors `None` en amont, et les blocs `-1`, plutôt qu'une valeur
plausible mais fausse rendue sans avertissement. Le dire dans le tooltip de
chaque bloc, pas seulement dans le code : ça renvoie vers AHT20/DHT20 (I²C,
fiable sur les deux cartes) pour qui a besoin d'un V2.

### Modules à ne PAS implémenter, et pourquoi

- **Vision AI V2** — pile SSCMA complète (JSON transporté par blocs sur I²C).
  C'est un projet en soi.
- **UartWiFi** — faisable, mais initialiser l'UART sur des broches externes coupe
  la liaison série USB (plus de `print`, plus de REPL), et le dialogue en
  commandes AT dépend de temporisations à régler avec le module en main.

## 10. La radio

Catégorie « Communication », quatre sous-catégories : **Groupe** (activer,
désactiver, choisir le groupe 0–255), **Envoi** (nombre, texte, couple
nom/valeur), **Réception** (bloc « lorsque un nombre / un texte / une valeur est
reçu », et un bloc de lecture), **Plus** (puissance 0–7, longueur d'onde).

Convention de transport, purement textuelle, celle de MicroPython : un nombre
part comme `"42"`, un couple comme `"nom=valeur"`, un texte tel quel. Un
répartiteur `_radio_traiter()` classe le message reçu — `=` présent → couple ;
sinon convertible en nombre → nombre ; sinon → texte — puis appelle le
gestionnaire correspondant. Les valeurs lues vivent dans une liste unique
`_radio_dernier = [texte, nom, valeur, force]`.

**PIÈGE nº 19 — les valeurs d'une liste déroulante Blockly doivent être
uniques.** Le premier jet mappait « le texte reçu » et « le nombre reçu » sur le
même rang `0`, donc sur la même valeur de champ : Blockly n'affichait qu'une des
deux entrées et le générateur lisait l'autre. Donner des valeurs distinctes
(`texte`, `nom`, `valeur`, `nombre`, `force`) et convertir en rang dans le
générateur, jamais dans le champ.

**PIÈGE nº 20 — pas de `globals()` dans un mock Brython.** Sur la carte tout vit
dans un seul module, donc `_radio_traiter` y trouve les gestionnaires par
`globals()`. Dans le simulateur, le programme est exécuté par `exec(code, env)` :
les gestionnaires atterrissent dans `env`, pas dans les globales du module. Le
répartiteur du simulateur doit donc être **défini à l'intérieur de la fonction où
`env` existe**, chercher dans `env`, et y être injecté (`env['_radio_traiter'] =
…`). Symptôme : le message est bien délivré, aucun gestionnaire ne s'exécute, et
rien ne signale l'erreur.

**PIÈGE nº 21 — `except ValueError` imbriqué sous Brython.** Le motif
`try: int(x) / except ValueError: try: float(x) / except ValueError: None`
fonctionne sur MicroPython mais laisse échapper l'exception du `float` sous
Brython. Aplatir en deux `try` successifs avec `except:` nu.

**Non compatible en l'air avec MakeCode**, et il faut le dire à l'utilisateur :
MakeCode emploie un format binaire propre avec en-tête et numéro de série. Deux
cartes, l'une sous MakeCode l'autre sous MicroPython, ne se comprennent pas même
sur le même groupe. Deux blocs MakeCode sont donc sans équivalent et à ne pas
implémenter : « régler le numéro de série de transmission » et « radio déclencher
l'événement ».

Côté simulateur : une section « Radio : message à recevoir » (champ texte +
bouton « Simuler la réception »), visible seulement si un bloc de réception est
posé. Une boîte aux lettres à un seul message, vidée à la lecture. Force du
signal simulée : `-42`.

## 11. Mise en page

Trois colonnes : blocs / transcription MicroPython / simulateur.

### PIÈGE nº 22 — `min-height: 0`

```css
#main-container { display: flex; flex-grow: 1; min-width: 0; min-height: 0; }
#blocklyDiv { flex: 1 1 auto; min-width: 260px; min-height: 0; height: 100%; }
#code-container, #simulator-container { flex: 0 0 24%; min-height: 0; overflow-y: auto; }
```

Sans `min-height: 0`, un enfant flex ne peut pas devenir plus petit que son
contenu : le panneau du simulateur, une fois garni, pousse la rangée bien au-delà
de la fenêtre. Mesuré sans ce correctif : le canevas Blockly atteignait
**4754 px de haut**, et sa corbeille se retrouvait très loin sous la ligne de
flottaison — invisible.

### PIÈGE nº 23 — prévenir Blockly des changements de taille

Blockly met en cache les dimensions de son conteneur et place corbeille et barres
de défilement d'après ce cache. Appeler `Blockly.svgResize(workspace)` après
**tout** changement de mise en page : repli d'un panneau, affichage ou masquage
d'une section, redimensionnement. Ajouter en filet un `ResizeObserver` sur
`#blocklyDiv`.

### PIÈGE nº 24 — le zoom dans la barre, pas dans le canevas

Les contrôles de zoom internes de Blockly sont dessinés **à l'intérieur** de
l'espace de travail : ils sont rognés par le bord dès que la place manque et
peuvent chevaucher la corbeille. Mettre `zoom.controls: false` et placer des
boutons `−`, pourcentage, `+`, `Ajuster` dans la barre du haut.

Accrocher l'indicateur de pourcentage à `setScale` plutôt qu'aux événements :
toutes les façons de zoomer y passent, alors que `viewport_change` ne se
déclenche pas de façon fiable.

```js
zoom: { controls: false, wheel: true, pinch: true,
        startScale: 1, minScale: 0.3, maxScale: 3, scaleSpeed: 1.2 },
move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
```

Avec `zoom.wheel` **et** `move.wheel` à `true` : Ctrl+molette agrandit, molette
seule fait défiler.

### Panneaux repliables et sections conditionnelles

Deux boutons « Code » et « Simulateur » replient les colonnes de droite : c'est
le remède le plus direct quand le tiroir de la boîte à outils prend toute la
place. Mesuré : le canevas utile passe de 3 px à 593 px.

À dire dans la documentation, parce que l'intuition dit le contraire : **replier
le panneau du code n'agrandit pas le simulateur.** Les deux colonnes de droite
ont chacune une largeur fixe de 24 % ; la place libérée va à la zone de blocs,
ce qui est bien le but. Seule la taille de la fenêtre change l'échelle de la
carte.

Chaque section du panneau Grove n'apparaît **que si un bloc du module
correspondant est présent** dans le programme. Sans aucun bloc Grove, le panneau
entier est masqué.

### La carte s'adapte à la largeur de sa colonne

La carte est dessinée en pixels fixes. Plutôt que de la laisser déborder ou
flotter, la mettre à l'échelle de la place disponible — et **la réduire d'un
quart** au passage, pour laisser respirer les sections placées au-dessous :

```js
const echelle = 0.75 * Math.max(0.55, Math.min(1.5, cadre.clientWidth / LARGEUR));
carte.style.transform = 'scale(' + echelle.toFixed(3) + ')';
cadre.style.height = Math.round(HAUTEUR * echelle) + 'px';   // voir ci-dessous
```

Un `transform` **ne modifie pas la place occupée** : sans un cadre dont on ajuste
la hauteur, la carte réduite laisse un vide et la carte agrandie déborde. Les
zones cliquables, elles, suivent la transformation toutes seules.

### PIÈGE nº 25 — la barre de défilement et l'échelle s'entraînent l'une l'autre

Le panneau du simulateur est en `overflow-y: auto`. Une carte plus petite fait
disparaître sa barre de défilement, ce qui **élargit** le cadre de 16 px, ce qui
réagrandit la carte, ce qui ramène la barre. La mise en page oscille, ou se fige
sur une échelle qui ne correspond pas à la mesure.

```css
#simulator-container { overflow-y: auto; scrollbar-gutter: stable; }
```

La gouttière est réservée en permanence : la largeur ne dépend plus du contenu,
la boucle est rompue.

### Thème clair / sombre

Demande de l'utilisateur. Deux moitiés bien séparées, pas une seule technique :

1. **Les grandes surfaces de la page** (barre d'outils, panneaux latéraux,
   panneau de code, menu « Fichier », panneau administrateur) passent par des
   variables CSS (`--fond-chrome`, `--fond-saisie`, `--texte-chrome`,
   `--bordure-chrome`, `--fond-code`, `--texte-code`), deux jeux de valeurs —
   `:root` (sombre, l'état d'origine du projet) et `:root[data-theme="light"]`
   (le nouveau). Un attribut sur `<html>`, pas une classe sur `<body>` : ça
   n'a pas d'importance technique ici, mais évite d'avoir à choisir entre
   `document.body` (pas encore parsé si le script tourne dans `<head>`) et
   `document.documentElement` (toujours disponible).

   **Toutes les couleurs ne suivent pas le thème.** Les couleurs
   « d'appareil » (sprites de robots, carte micro:bit, DEL, bézel du
   joystick Grove, étiquette des fanions départ/arrivée) représentent
   quelque chose de réel — elles restent fixes, exactement comme les
   couleurs d'accent des boutons d'action (vert = lancer, orange = secouer)
   ne changent pas non plus. Seule la « chrome » de l'application (ce qui
   n'existe que dans l'interface) suit le thème.

2. **L'espace de travail Blockly** ne suit **pas** les variables CSS : son
   fond est peint par un `<rect>` SVG avec un `fill` en `url(#pattern...)`
   (le motif de grille), pas par un simple `background-color` — une variable
   CSS n'y changerait rien. Blockly ne livre par ailleurs aucun thème sombre
   (seuls `Classic` et `Zelos` existent, vérifié avec
   `Object.keys(Blockly.Themes)` avant de chercher plus loin). Un thème sur
   mesure, avec `Blockly.Theme.defineTheme(nom, { base: Blockly.Themes.Classic,
   componentStyles: {...} })`, couvre correctement l'espace de travail, la
   boîte à outils et le tiroir :

   ```js
   const themeSombre = Blockly.Theme.defineTheme('sombreMicrobitV2', {
     base: Blockly.Themes.Classic,
     componentStyles: {
       workspaceBackgroundColour: '#1e1e2e',
       toolboxBackgroundColour: '#2c3e50',
       toolboxForegroundColour: '#ecf0f1',
       flyoutBackgroundColour: '#26333f',
       flyoutForegroundColour: '#ecf0f1',
       flyoutOpacity: 1,
       scrollbarColour: '#4a5a6a',
       insertionMarkerColour: '#ffffff',
       insertionMarkerOpacity: 0.3,
       cursorColour: '#ffffff'
     }
   });
   workspace.setTheme(sombre ? themeSombre : Blockly.Themes.Classic);
   ```

Choix persisté en `localStorage`, appliqué par un petit `<script>` synchrone
placé **avant** le `<style>` principal dans `<head>` — sinon la page peint
une première fois avec le thème par défaut avant que le script (chargé en
même temps que le reste, donc pas nécessairement plus tôt) ne bascule vers
le thème mémorisé, un flash visible à chaque rechargement.

### Contraste normal / élevé — un second réglage, orthogonal au premier

Demande séparée de l'utilisateur, arrivée après le thème clair/sombre : ne
pas le fondre dans le même bouton/attribut, mais ajouter un second attribut
(`data-contrast="high"`) qui se combine librement avec `data-theme` — quatre
états au total, sélecteurs CSS composés (`:root[data-contrast="high"]`,
`:root[data-theme="light"][data-contrast="high"]`). Même idée pour Blockly :
pas 2 mais **3** thèmes personnalisés en plus du `Classic` fourni (un par
combinaison sombre/clair × élevé — « clair normal » reste `Classic` tel
quel), choisis en croisant les deux réglages plutôt qu'en gardant un seul
« thème actif » à quatre valeurs :

```js
function themeBlocklyActif() {
  const clair = document.documentElement.dataset.theme === 'light';
  const eleve = document.documentElement.dataset.contrast === 'high';
  if (clair) return eleve ? themeClairEleve : Blockly.Themes.Classic;
  return eleve ? themeSombreEleve : themeSombreNormal;
}
```

Le contraste élevé pousse les mêmes variables vers le noir/blanc pur (pas de
teintes intermédiaires) et épaissit les bordures des grandes surfaces (2px) :
sans ça, une bordure à peine plus claire que le fond redevient invisible une
fois les nuances aplaties, l'inverse de ce qu'un contraste élevé doit faire.
Persistance et application avant le premier rendu identiques au thème
clair/sombre, sous une clé `localStorage` séparée — les deux réglages
doivent pouvoir changer indépendamment sans se marcher dessus.

**PIÈGE nº 45 — le thème Blockly (`componentStyles`) ne repeint QUE le fond
de l'espace de travail/de la boîte à outils, jamais le remplissage des
blocs.** Demande explicite de l'utilisateur avec une image de référence
(fond noir, blocs eux-mêmes en noir à simple contour blanc, pas remplis de
la couleur de leur catégorie) : la tentation est de chercher encore un
réglage dans `Blockly.Theme.defineTheme`, alors que chaque bloc pose sa
couleur via `setColour()` à l'initialisation, complètement indépendamment
du thème du workspace — un thème ne peut pas la changer après coup. Il faut
cibler directement les éléments SVG que Blockly dessine pour un bloc
(`.blocklyPath` le remplissage principal, `.blocklyPathDark`/`.blocklyPathLight`
les couches de relief ombre/reflet qui donnent l'effet 3D habituel — à
éteindre justement pour un contour plat —, `.blocklyText` le texte) :

```css
[data-contrast="high"] .blocklyPath { fill: #000 !important; stroke: #fff !important; stroke-width: 1.5px !important; }
[data-contrast="high"] .blocklyPathDark { fill: #000 !important; }
[data-contrast="high"] .blocklyPathLight { stroke: #fff !important; fill: none !important; }
[data-contrast="high"] .blocklyText { fill: #fff !important; }
```

Une règle de feuille de style l'emporte sans peine sur ces couleurs même si
Blockly les pose en `fill="..."`/`stroke="..."` directement sur l'élément :
un attribut de présentation SVG est la source de plus **basse** priorité de
la cascade CSS, en dessous de n'importe quelle règle d'auteur — `!important`
n'est même pas strictement nécessaire ici, juste une garantie bon marché.
Aucune modification du JS qui construit les blocs.

**PIÈGE nº 46 — un SVG exporté seul (comme image autonome) a son PROPRE
`:root`, qui n'est pas le `<html>` de la page.** Fonction "capture d'écran
des blocs → PNG" (menu Fichier) : le premier jet réutilisait telles quelles
les règles CSS `[data-theme="light"] ...`/`[data-contrast="high"] ...` du
§11 en les recopiant (via `document.styleSheets`) dans un `<style>` intégré
au SVG exporté. Ça fonctionne pour toutes les règles à sélecteur direct,
mais échoue silencieusement pour celles écrites `:root[data-contrast="high"]
.blocklyPath` : dans un document dont l'élément racine EST le `<svg>` (ce
qui est le cas dès qu'on le charge seul dans une `<img>`, hors de la page),
`:root` désigne ce `<svg>`, pas le `<html>` de la page d'origine — l'attribut
`data-contrast="high"` vit sur le `<html>` de la page, jamais copié dans le
SVG exporté, donc la règle ne correspond jamais et le contraste élevé
exportait silencieusement les couleurs normales (blocs verts au lieu de
noir/blanc). Repéré uniquement en comparant visuellement la capture aux 4
combinaisons thème/contraste — un simple test « le PNG se télécharge » ne
l'aurait pas révélé. Correction : recopier `data-theme`/`data-contrast`
directement comme attributs du `<svg>` exporté lui-même :

```js
svgExport.setAttribute('data-theme', document.documentElement.dataset.theme || '');
svgExport.setAttribute('data-contrast', document.documentElement.dataset.contrast || '');
```

Rappel plus général : `.blocklyText` n'a **aucun** attribut `fill` posé par
Blockly (contrairement à `.blocklyPath`) — son rendu dépend à 100 % des
feuilles de style, que Blockly injecte dans `<head>` et jamais dans le
`<svg>` lui-même. Un SVG exporté sans recopier ces règles affiche donc des
blocs sans aucun texte.

Demande de suivi : sortir le bouton "Capture d'écran des blocs" du menu
"Fichier" pour en faire un bouton autonome de la barre d'outils, entre
"Fichier" et "Envoyer sur la carte" — pur déplacement de balisage HTML
(retiré de `#menu-fichier-panneau`, inséré juste après `</div>` du menu),
aucun changement du JS de capture lui-même ni de son style (`#capture-ecran-btn`
gardait déjà sa propre couleur, indépendante des règles `#menu-fichier-panneau
button`).

**PIÈGE nº 47 — `workspace.undo()` déclenche le change listener général
AVANT que la pile "refaire" ne soit à jour.** Boutons "Annuler"/"Refaire"
ajoutés à droite de "Envoyer sur la carte", exposant `workspace.undo(false)`/
`workspace.undo(true)` (API publique existante, avec `getUndoStack()`/
`getRedoStack()` — pas besoin de manipuler des piles privées). Premier jet :
un seul `addChangeListener` recalculant `disabled` à partir de la longueur
des deux piles, en croyant qu'il suffisait pour tous les cas (glisser un
bloc, annuler, refaire). Testé par un aller-retour complet piloté au clavier/
souris (glisser un bloc, cliquer Annuler, cliquer Refaire, vérifier la
position ET l'état des boutons à chaque étape) : après un clic sur
« Annuler », le bouton « Refaire » restait grisé à tort alors que
`getRedoStack().length === 1` juste après — le listener général s'était
bien déclenché, mais avant que `redoStack_` ne soit repeuplée en interne.
Un appel manuel de la même fonction de rafraîchissement juste après, hors du
listener, donnait immédiatement le bon résultat. Corrigé en rafraîchissant
explicitement l'état des deux boutons dans le gestionnaire de clic
lui-même, juste après l'appel à `undo()`, en plus du `addChangeListener`
conservé pour les autres cas (glisser un bloc, etc.) :

```js
boutonAnnuler.addEventListener('click', () => {
    window.workspace.undo(false);
    mettreAJourAnnulerRefaire();
});
```

Piège à retenir plus généralement : ne pas supposer qu'un `addChangeListener`
Blockly se déclenche APRÈS la mise à jour complète de l'état interne
déclenchant l'événement — à vérifier au cas par cas plutôt qu'à supposer,
en particulier pour tout ce qui touche aux piles annuler/refaire.

**PIÈGE nº 48 — `element.textContent = ...` efface TOUS les enfants, pas
seulement le texte visible.** Demande : « réduire la taille des icônes » de
la barre d'outils. Chaque emoji (📁 📷 📤 ↶ ↷ ⚙ 🌙 ◐ ⬇ ⬆) enveloppé dans
`<span class="icone-bouton">` avec un `font-size` réduit, pour ne pas
toucher à la taille du texte du bouton. Ça casse silencieusement le bouton
thème : `appliquerTheme()` faisait `btnTheme.textContent = clair ? '☀️' :
'🌙'` pour changer l'icône au clic — correct tant que le bouton ne contenait
QUE du texte, mais `.textContent =` remplace la totalité du contenu par un
seul nœud texte, supprimant donc le `<span>` nouvellement ajouté (le bouton
perd sa réduction de taille dès le premier clic sur le thème). Corrigé en
ciblant le span lui-même plutôt que le bouton :

```js
const icone = btnTheme.querySelector('.icone-bouton') || btnTheme;
icone.textContent = clair ? '☀️' : '🌙';
```

Piège à retenir plus généralement : toute réécriture ultérieure de
`textContent`/`innerHTML` sur un élément qu'on vient d'enrichir avec du
balisage interne (icône, badge, etc.) doit être relue et corrigée en même
temps — sinon la régression n'apparaît qu'au premier clic, pas à l'oeil au
chargement de la page.

**PIÈGE nº 49 — un geste ponctuel (bouton, broche) réutilisant le bouton
« Lancer la simulation » comme déclencheur casse tout s'il est réutilisé SANS
regarder si un passage est déjà en cours.** Le simulateur n'exécute jamais le
programme en continu : un clic sur « Lancer la simulation » (`lancer_simulation`,
Brython) repart de zéro (file vidée, objets Grove/servos réinitialisés, code
ré-exécuté depuis le haut) puis enchaîne EXACTEMENT 5 tours de la première
boucle infinie (`window.simu_lancerTours(5)`, avec de vrais délais entre
chaque tour pour laisser un robot bouger — voir §14). `lierCapteurTactile()`
(bouton A/B, logo, broches 0/1/2) suit le même schéma que « Secouer la
carte » : poser un drapeau puis appeler `btnLancer.click()` pour que le
programme le voie. Ce schéma est correct quand la simulation est INACTIVE
(rien d'autre ne la ferait avancer), mais devient un bug quand un passage de
5 tours est DÉJÀ en train de tourner : l'appui redéclenche `lancer_simulation`
en plein milieu, qui repart de zéro — position du robot perdue, musique de
« Au démarrage » rejouée, etc. — alors que le passage déjà en cours aurait
tout simplement lu le drapeau au tour suivant, sans rien redémarrer. Corrigé
par un drapeau `window.simuEnCours` (vrai pendant les 5 tours, faux entre
deux passages et pendant la réinitialisation) : `lierCapteurTactile()` ne
relance `btnLancer.click()` que si `!window.simuEnCours`, sinon se contente
de poser le drapeau. Vérifié avec un programme à `sleep(1000)` dans la
boucle (fenêtre de plusieurs secondes réelles pour tester un appui pendant
un passage) et un compteur des démarrages effectifs (`simu_lancerTours`
appelé avec `n === 5`) : appui pendant un passage → 0 nouveau démarrage,
drapeau quand même posé ; appui une fois inactif → démarrage normal. Portée
délibérément limitée à `lierCapteurTactile()` : « Secouer la carte » et
« Simuler la réception » radio utilisent un code séparé, non touché (geste
ponctuel plutôt que maintenu, sémantique différente, pas demandé).

Suivi immédiat, même signalement : « un appui sur A/B/broches 0-1-2/logo
déclenche la simulation même si aucun de ces connecteurs [n'est] affecté ».
Le drapeau `simuEnCours` ci-dessus ne réglait que la moitié du problème : il
évite de redémarrer un passage déjà en cours, mais n'importe quel appui
déclenchait quand même un PREMIER passage, même si le programme n'utilisait
aucunement ce capteur précis (ex. appuyer sur la broche 2 alors que le
programme ne lit que le bouton A) — un passage inutile, sans aucun effet
visible puisque rien dans le code ne le regarde, mais qui rejoue quand même
toute la mise en scène (musique de démarrage, mouvement du robot...).
`lierCapteurTactile()` reçoit un 3ᵉ paramètre, l'identifiant MicroPython
correspondant (`button_a`, `pin0`...) : `btnLancer.click()` n'est appelé que
si `window.currentPythonCode.includes(identifiant)`. Recherche de
sous-chaîne volontairement grossière (pas une analyse du code) : elle
couvre aussi bien `button_a.is_pressed()` que les gestionnaires « lorsque »
générés (`on_button_pressed_a`, qui scrutent le même identifiant en
interne), et un faux positif (l'identifiant apparaît pour une tout autre
raison) ne fait que retomber sur l'ancien comportement — inoffensif, jamais
pire. Vérifié dans le navigateur : programme n'utilisant que `button_a` →
B/logo/broches 0/1/2 ne déclenchent plus rien (0 démarrage chacun), A
fonctionne toujours ; programme par défaut (`pass`) → aucun des 6 appuis ne
déclenche quoi que ce soit ; programme utilisant `pin1` → la broche 1
déclenche bien un passage (la détection n'est pas limitée aux boutons A/B).

Deuxième suivi, même signalement : « le problème reste avec la broche 1 ».
La recherche de sous-chaîne ci-dessus avait un angle mort précis à `pin1` :
`"pin12".includes("pin1")` (comme `pin13`...`pin16`, des broches Grove
valides et courantes, sans rapport avec la broche tactile 1) vaut `true` —
confirmé en isolant le cas avant de corriger (programme n'utilisant QUE
`pin12` → la broche 1 virtuelle déclenchait quand même un passage).
`button_a`/`button_b`/`pin_logo`/`pin0`/`pin2` n'ont pas cet angle mort :
aucun autre identifiant du jeu de broches ne les contient en préfixe, seul
`pin1` est le préfixe de `pin12`...`pin16`. Remplacé par une recherche à
limites de mot (`new RegExp('\\b' + identifiantPython + '\\b')`) : `\b` ne
marque pas de limite entre le `1` de `pin1` et le `2` de `pin12` — les deux
sont des caractères de mot — donc le motif ne correspond plus à l'intérieur
de `pin12`. Vérifié dans le navigateur : programme utilisant `pin12`+`pin13`
→ broche 1 virtuelle inerte (0 démarrage, contre 1 avant correction) ;
programme utilisant réellement `pin1` → déclenche toujours normalement.

Piège de méthode de test rencontré en vérifiant la non-régression : un
premier essai enchaînant plusieurs appuis coup sur coup (50 ms d'attente
entre chacun) a semblé montrer que `btn-a` ne déclenchait plus rien du
tout — inquiétant, mais faux : un passage précédent (5 tours avec de vrais
délais) n'avait simplement pas eu le temps de finir, laissant `simuEnCours`
à `true` et bloquant le suivant pour la bonne raison (déjà en cours), pas à
cause de ce correctif. Réisolé avec une attente suffisante entre chaque
essai : `btn-a` fonctionne normalement. À retenir plus généralement : un
test qui enchaîne plusieurs déclenchements du simulateur doit attendre la
fin du passage précédent (`simuEnCours === false`) avant le suivant, sous
peine de conclusions erronées.

**PIÈGE nº 50 — recalculer un état dérivé À CHAQUE passage, au lieu de
réagir aux seules TRANSITIONS, écrase silencieusement tout ce que
l'utilisateur a choisi entre deux passages.** Signalé par l'utilisateur,
capture d'écran du menu contextuel à l'appui : « la fonction "Activer le
bloc" n'a pas l'air de fonctionner ». `mettreAJourBlocsOrphelins()` (§ blocs
orphelins désactivés, plus haut) recalculait `actif` (le bloc est-il
accroché à un conteneur légitime ?) à chaque passage sur `getAllBlocks()` et
appelait `setEnabled(actif)` sans condition — y compris quand `actif`
n'avait pas changé depuis le dernier passage. Le clic sur « Activer le
bloc » (menu contextuel NATIF de Blockly, pas du code de ce projet)
déclenche lui-même un événement de changement d'espace de travail, qui
relance ce listener : pour un bloc toujours orphelin, `actif` reste `false`,
donc `setEnabled(false)` réécrase aussitôt le choix de l'utilisateur — sans
message, sans clignotement visible, juste un bouton qui « ne fait rien ».
Deuxième effet de bord, plus grave, découvert en creusant : ça cassait
« Désactiver le bloc » pour n'IMPORTE QUEL bloc correctement accroché — une
fonctionnalité Blockly native, sans aucun rapport avec les orphelins,
entièrement neutralisée par effet de bord. Corrigé en mémorisant le dernier
état structurel connu de chaque bloc (`bloc.legitimeOrphelin_`, une
propriété posée directement dessus) et en ne rappelant `setEnabled()` que
si cet état vient de changer :

```js
function mettreAJourBlocsOrphelins() {
    for (const bloc of window.workspace.getAllBlocks(false)) {
        const legitime = estContainerLegitime(bloc.getRootBlock());
        const etaitLegitime = bloc.legitimeOrphelin_;
        if (etaitLegitime === undefined || legitime !== etaitLegitime) {
            bloc.setEnabled(legitime);
        }
        bloc.legitimeOrphelin_ = legitime;
    }
}
```

Entre deux transitions (accroché ↔ détaché), l'état choisi par l'utilisateur
reste intact ; à la transition elle-même, le comportement automatique
d'origine (désactiver un bloc qui se détache, réactiver un bloc qui se
rattache) continue de s'appliquer sans exception à mémoriser à la main.
Vérifié avec de vrais clics de menu contextuel Blockly (coordonnées lues
depuis `getBoundingClientRect()` des `.blocklyMenuItem` réels, pas un appel
programmatique à `setEnabled()` — qui, lui, ne déclenche pas forcément le
même événement de changement, un piège de méthode de test à part entière,
rencontré en essayant de reproduire le bug avant de le corriger).

Piège à retenir plus généralement : un listener qui recalcule un état à
partir de zéro à chaque déclenchement, plutôt que de comparer à l'état
précédent, ne peut pas cohabiter avec une action manuelle sur ce même état
— quelle que soit sa source (menu contextuel natif, futur bouton, etc.).
Comparer avant d'agir, pas juste appliquer.

**PIÈGE nº 51 — le texte d'un `beforeunload` ne s'affiche jamais.** Demande
de l'utilisateur : une confirmation « Êtes-vous sûr ? » à la fermeture de
l'appli. `window.addEventListener('beforeunload', e => { e.preventDefault();
e.returnValue = ''; })` est le seul mécanisme JS pour ça — mais tous les
navigateurs modernes (depuis ~2011, contre les faux messages d'alerte
trompeurs) ignorent délibérément tout texte personnalisé passé via
`e.returnValue` ou `return` : ils affichent toujours leur propre message
générique et non traduisible depuis le code (« Quitter le site ? »/« Leave
site? » selon la langue du navigateur, pas celle de la page). Vérifié en
lisant la spec avant d'essayer d'y passer le texte exact demandé — inutile
d'y perdre du temps, seul `e.preventDefault()` compte, le texte n'a plus
d'effet depuis longtemps. Se limite en plus à la fermeture d'onglet/fenêtre,
au rechargement (F5) et à la navigation qui quitte la page — aucune barre
d'outils/action interne à l'appli (téléchargement, envoi sur la carte) ne
déclenche cet événement, ce n'est jamais qu'une navigation qui le fait.

**PIÈGE nº 52 — reconstruction de blocs depuis du Python : possible
UNIQUEMENT parce que nos propres générateurs sont déterministes, jamais
pour du Python quelconque.** Demande de l'utilisateur : « je veux pouvoir
reconstruire les fichiers générés par l'appli ». Ce chantier tient sur un
fait précis, vérifié avant d'écrire la moindre ligne : chaque bloc du
projet produit toujours EXACTEMENT le même motif Python (`_mq_moteur("gauche",
150)`, jamais une autre formulation équivalente) — l'inverse d'un compilateur
classique où plusieurs sources produisent le même binaire, ici une seule
« sortie » possible par bloc rend la correspondance inverse table-driven
plutôt qu'un vrai problème de décompilation. Architecture : `ast.parse()`
côté Brython (le module `ast` standard, pas une regex — un commentaire ou
un changement d'indentation ne doit jamais faire échouer l'analyse) renvoie
l'arbre en JSON à un moteur JS qui tente, pour chaque noeud, une liste de
« reconnaisseurs » (un par bloc couvert) puis retombe sur un bloc générique
`code_brut`/`expression_brute` gardant le texte Python d'origine tel quel —
jamais d'échec silencieux, une couverture partielle qui grandit avec le
temps plutôt qu'un tout-ou-rien à réécrire pour chaque nouveau bloc couvert.

Sous-pièges rencontrés, aucun deviné à l'avance — tous trouvés en générant
du VRAI code depuis de vrais blocs puis en comparant, jamais en lisant le
générateur seul :

- **Un champ dropdown n'est pas forcément une chaîne.** `servo_angle`,
  `kitrobot_definir_ultrason`... ont un champ "broche" dont les valeurs
  d'option (`"pin0"`, `"pin1"`...) sont séparées SANS guillemets dans le
  générateur (`'_servo_angle(' + block.getFieldValue('BROCHE') + ...`) —
  une fois importé, `pin0` est donc un identifiant Python nu (noeud `Name`),
  pas une chaîne littérale (`Constant`). Un premier jet, écrit en lisant
  seulement le générateur, extrayait `valeurConstante()` et échouait
  silencieusement (`undefined`) à chaque appel réel — repéré en générant le
  code pour de vrai plutôt qu'en supposant depuis la lecture du générateur.
- **Toutes les valeurs de champ ne suivent pas la même convention, même
  dans le même bloc.** `grove_ruban_couleur` a son COULEUR en CHAMP (menu
  hexadécimal `"0xFF0000"`), pas en entrée de valeur comme la plupart des
  autres blocs Grove — un litéral hexadécimal Python se parse en `Constant`
  avec la valeur DÉCIMALE (`ast` ne garde pas la notation d'origine), d'où
  une table de correspondance vers l'option d'origine plutôt qu'une
  reconversion en base 16 à la main (qui ne retrouverait pas forcément la
  même casse/notation que l'option Blockly attendue).
- **`col_offset`/`lineno` de Brython mentent parfois.** Utilisés pour
  extraire le texte Python EXACT d'un fragment non reconnu (`ast.
  get_source_segment`, sa propre implémentation Brython tronquant déjà au
  premier mot pour `Import`/`ImportFrom` — bug de cette fonction précise,
  contourné par un découpage manuel). Plus grave : pour un noeud composite
  (`BinOp`, `Assign`...), Brython pose parfois la position sur son seul
  TOKEN OPÉRATEUR plutôt que tout l'empan — `1 + 2` donnait un `BinOp` dont
  la position ne couvrait que le `+` (confirmé en comparant aux positions,
  correctes elles, de ses propres enfants `Constant`). Corrigé en calculant
  l'empan par le BAS : union de la position propre du noeud avec celles de
  TOUS ses descendants, remontée à chaque niveau de la récursion — une
  position propre trop étroite se retrouve noyée dans celle, correcte, des
  enfants, sans distinguer les noeuds fiables des autres au cas par cas. Un
  noeud `Import` simple n'a par contre AUCUN descendant positionné pour
  s'appuyer dessus (l'`alias` interne n'a pas de position du tout) : repli
  par reconstruction sémantique (`'import ' + noms.join(', ')`) plutôt que
  par le texte, pour ce cas précis.
- **Un litéral `b""` n'est pas sérialisable en JSON.** Trouvé dans le code
  d'un pilote auto-injecté (valeur par défaut d'un paramètre), a fait
  planter `json.dumps` côté Brython avant même d'atteindre le JS — corrigé
  en convertissant `bytes` en simple liste d'entiers (aucun bloc ne
  reconstruit une valeur bytes de toute façon, seule l'absence de plantage
  compte ici) et en élargissant la capture d'exception de
  `analyser_code_python()` à TOUTE exception, pas seulement `SyntaxError` —
  un noeud AST inattendu doit toujours échouer proprement (repli édition
  manuelle), jamais planter.
- **Le code auto-injecté doit être retiré AVANT l'analyse, pas ignoré après.**
  Les pilotes (`# >>> pilote X ... # <<< pilote X`, un motif déjà utilisé
  ailleurs dans ce fichier pour les replier à l'affichage — voir
  `afficherTranscription()`) contiennent des dizaines à des centaines de
  lignes de définitions internes, jamais posées par l'utilisateur comme des
  blocs. Un premier jet les laissait passer telles quelles à `ast.parse()` :
  chaque ligne de définition, non reconnue par aucun matcher, devenait son
  propre bloc `code_brut` — jusqu'à 80 sur un programme de test pourtant
  simple (deux blocs, une poignée d'instructions), noyant le résultat utile
  sous du bruit. Corrigé en réutilisant le même motif `# >>> pilote X ...
  # <<< pilote X` pour les retirer du texte avant analyse, pas après.
- **Un bloc chaîné après « Au démarrage » et le même bloc niché DEDANS
  produisent un texte Python rigoureusement identique.** `au_demarrage`
  aplatit son contenu au premier niveau sans aucune marque ; un bloc
  simplement accroché en dessous (chaîné via `next`, pas niché dans son
  DO) génère donc exactement la même suite d'instructions, sans ligne vide
  ni commentaire pour les distinguer — vérifié en générant les deux
  variantes séparément et en comparant le texte produit, strictement égal.
  Limite structurelle non corrigible : la reconstruction ne peut reproduire
  qu'un agencement fonctionnellement équivalent (même ordre d'exécution),
  jamais deviner le regroupement visuel d'origine quand celui-ci n'affecte
  pas le code généré.
- **Le passe-partout mérite d'être omis, pas affiché.** Les imports
  (`from microbit import *`, `import neopixel`...) sont réinjectés tout
  seuls par les générateurs dès qu'un bloc en a besoin (`importerMicrobit()`,
  `importerModule()`...) — jamais quelque chose que l'utilisateur pose
  lui-même. Un premier jet les affichait comme des blocs "code" en tête de
  programme reconstruit (signalé par l'utilisateur, capture d'écran à
  l'appui) ; corrigé en les faisant sauter silencieusement plutôt que de
  leur donner un bloc (`bloc: null` dans le résultat d'un matcher, géré par
  l'appelant qui omet simplement de le pousser dans la chaîne).

**PIÈGE nº 53 — corriger le simulateur pour un bloc qui génère du code faux
ne corrige que le simulateur ; il faut corriger le générateur.** Bug
signalé par l'utilisateur : « nombre de clics du bouton B = 10 » ne se
déclenchait jamais. Cause immédiate : `ButtonMock.get_presses()` renvoyait
`0` sans condition (jamais implémenté).

Premier correctif (INSUFFISANT, gardé ici pour la leçon) : sur la vraie
carte, `button_x.get_presses()` est une lecture CONSOMMATRICE (renvoie le
total depuis la dernière lecture PUIS se remet à zéro) — mais le bloc
générait `button_b.get_presses()` TEL QUEL dans le code exporté. Comme ce
simulateur n'exécute jamais le programme en continu (il enchaîne des
passages de 5 tours à chaque déclenchement, voir PIÈGE nº 49, et repart de
zéro entre deux si le précédent est déjà terminé), une version
consommatrice dans `ButtonMock` remettait le compteur à zéro AU SEIN du
même passage qui venait de le faire avancer — jamais assez pour atteindre
10. Un premier correctif a donc rendu `ButtonMock.get_presses()` NON
consommateur côté simulateur (un simple total, remis à zéro seulement par
« Réinitialiser la simulation »). Ça faisait marcher le SIMULATEUR — mais le
code EXPORTÉ vers la vraie carte appelait toujours `get_presses()`
directement, sans accumulation : sur la vraie carte (exécution continue,
`get_presses()` réellement consommateur), `== 10` ne se déclenchait quasiment
jamais. Signalé par l'utilisateur dans la foulée : « le mode simulation
fonctionne bien, par contre ça ne fonctionne pas en réel » — la faute
exacte que corriger UNIQUEMENT le simulateur risque de produire : un
comportement qui a l'air bon dans l'appli mais ment sur ce qui tourne
réellement sur la carte.

Correctif définitif : déplacer la solution dans le GÉNÉRATEUR du bloc
(`P.forBlock['nombre_clics_bouton']`), qui pose un compteur Python global
cumulatif plutôt que d'appeler `get_presses()` nu :

```js
P.definitions_['clics_' + bouton] =
    '_clics_' + bouton + ' = 0\n' +
    'def _lire_clics_' + bouton + '():\n' +
    P.INDENT + 'global _clics_' + bouton + '\n' +
    P.INDENT + '_clics_' + bouton + ' += button_' + bouton + '.get_presses()\n' +
    P.INDENT + 'return _clics_' + bouton;
```

Cette fois le MÊME code Python tourne sur la vraie carte et dans le
simulateur : `ButtonMock.get_presses()` peut redevenir fidèle au matériel
réel (consommateur), l'accumulation ne dépend plus de lui. Vérifié : code
généré correct pour une exécution continue (`_clics_b = 0` au niveau module,
incrémenté à chaque appel).

Limite restante, découverte en re-testant DANS LE NAVIGATEUR après ce
correctif (pas devinée) : le simulateur ré-`exec()` le programme ENTIER à
chaque passage déclenché par un clic sur bouton inactif — y compris les
définitions de niveau module, donc `_clics_b = 0` se réinitialise à CHAQUE
passage séparé. Des clics espacés de plus de quelques dizaines de ms (le
temps qu'un passage sans `sleep()` se termine) ne s'accumulaient donc plus
dans le simulateur, même si le même programme fonctionnait correctement sur
la vraie carte (exécution continue, jamais de ré-exec).

Corrigé dans une passe suivante, après confirmation explicite de
l'utilisateur ("oui") : séparation de l'exécution du code de premier niveau
(une seule fois) et de la répétition des tours, dans `index.html`.
`lancer_simulation(code)` est devenu un mince wrapper qui appelle
`_demarrer_session(code)` — la logique d'origine (nettoyage, construction de
`env`, découpe `avant`/`corps`/`après`, `exec(avant, env)`) — SANS rien
changer d'autre, garantissant qu'appuyer sur le bouton « Lancer » redémarre
TOUJOURS tout à zéro, comme son nom l'indique. Deux nouvelles fonctions
utilisent cette même session : `continuer_ou_lancer_simulation()`, appelée
par les capteurs virtuels (boutons, broches, logo, secousse, radio, geste
Grove — `un.js`, en remplacement de leurs `btnLancer.click()`) à la place de
`lancer_simulation()`, qui reprend la session existante (mêmes `env`, mêmes
variables globales Python) si le code n'a pas changé depuis, au lieu de tout
réexécuter depuis « Au démarrage » ; et `invalider_session_simulation()`,
appelée par `simu_reinitialiser()` (`un.js`), pour qu'un « Réinitialiser »
ne laisse pas une session périmée derrière lui. Vérifié dans le navigateur
avec le scénario exact signalé par l'utilisateur (10 clics espacés de 150 ms
sur le bouton B virtuel, en deux salves de 5 avec un vrai délai entre les
deux) : le cœur s'affiche désormais correctement, alors qu'un « Lancer la
simulation » explicite entre-temps repart bien de zéro.

Retenir : pour un projet qui produit du code exécuté sur DEUX cibles
(simulateur ET vraie carte) à partir du MÊME générateur, un bug de
comportement doit d'abord se demander « le code généré est-il correct pour
une exécution continue sur la vraie carte ? » avant de corriger le
simulateur — sinon le correctif peut faire disparaître le symptôme dans
l'appli tout en laissant, voire en aggravant, le vrai problème sur le
matériel que le projet est censé cibler.

**PIÈGE nº 54 — un bloc dont le code généré est correct sur la vraie carte
peut quand même geler le SIMULATEUR, à cause de `sleep()` non bloquant.**
Bug signalé par l'utilisateur, juste après le correctif de session
persistante ci-dessus (PIÈGE nº 53) : poser « attendre jusqu'à » (bloc
`attendre_jusqua`) dans « Répéter indéfiniment » « semble faire planter
l'app ». Code généré (correct sur la vraie carte) :

```python
while True:
    while not (button_a.is_pressed()):
        sleep(10)
```

Sur la vraie carte, `sleep(10)` met vraiment en pause 10 ms, le temps que
l'état du bouton — lu en continu par le matériel — puisse changer. Dans ce
simulateur, `sleep()` (fonction Python `sleep()`, `index.html`) ne fait que
pousser une action dans une file JS (`window.simu_sleep`, `un.js`) et rend la
main IMMÉDIATEMENT — `exec()` tournant de façon synchrone, rien ne peut faire
varier `button_a.is_pressed()` pendant que cette boucle `while` tourne : elle
boucle indéfiniment en JS synchrone, gèle l'onglet (page qui ne répond plus),
jusqu'à devoir la fermer. Un problème de simulateur, pas du générateur (donc
sans rapport avec le principe du PIÈGE nº 53 : ici c'est bien le simulateur
qu'il fallait corriger, pas le bloc).

Correctif : un compteur global `_sleep_compteur`, remis à 0 avant CHAQUE
`exec()` de premier niveau (`exec(avant, env)`, chaque tour dans
`_tour_suivant()`, et le repli `exec(code_repli, env)` — trois points
d'entrée distincts, facile d'en oublier un), incrémenté à chaque appel à
`sleep()` ; au-delà de 3000 appels dans le même `exec()`, `sleep()` lève une
`RuntimeError` avec un message explicatif plutôt que de laisser la boucle
segment tourner indéfiniment. Remonte à l'utilisateur via le mécanisme
d'erreur existant (`_rapporter_erreur` → `window.simu_erreur` →
`afficherEtat`), sans rien changer au code généré ni au comportement réel de
la carte. Vérifié dans le navigateur : le programme exact de la capture
d'écran de l'utilisateur affiche désormais un message d'erreur lisible
(« Simulateur : « attendre jusqu'à » n'aboutit jamais dans ce tour de
simulation... ») au lieu de geler l'onglet, l'appel JS revenant
immédiatement au lieu de rester bloqué ; un « attendre jusqu'à » dont la
condition est déjà vraie au moment du déclenchement, et un « attendre » (bloc
`attendre_temps`) normal, continuent de fonctionner sans déclencher l'erreur.

Retenir : un bug qui « plante l'app » dans un simulateur reconstruit avec des
mocks n'est pas toujours dans le code généré — ici la divergence venait d'un
mock (`sleep()` non bloquant) qui rend impossible, PAR CONSTRUCTION, un motif
d'attente active pourtant légitime sur le matériel réel. Il faut alors
protéger le simulateur lui-même (ici, une limite sur le nombre d'itérations)
plutôt que de chercher un défaut dans le générateur du bloc.

**Suite du PIÈGE nº 54 — le premier correctif (RuntimeError) déplaçait le
bug plutôt que de le résoudre.** Découvert en re-testant DANS LE NAVIGATEUR
avec le programme réel de l'utilisateur (pas devinée) : « attendre jusqu'à
bouton B appuyé » → « afficher cœur » → « attendre 1 s » → « afficher
heureux » → « attendre 1 s », dans « Répéter indéfiniment ». Ce motif est
cense se redéclencher à CHAQUE tour de la boucle infinie — sur la vraie
carte comme dans ce simulateur (un tour = un passage dans le corps de
« Répéter indéfiniment »). Capture d'écran à l'appui : le premier tour
réussissait (bouton tenu, cœur puis sourire bien affichés), mais un bandeau
d'erreur ROUGE PERSISTANT restait affiché quand même — un faux positif :
dès qu'un tour suivant retrouvait le bouton relâché (relâché entre deux
tours, ce qui est le cas normal), `_tour_suivant()` levait la même
`RuntimeError`, affichée comme une vraie erreur de programme alors que
« continuer à attendre le prochain appui » est exactement le comportement
correct — ni un bug, ni distinguable d'un cas réellement cassé avec une
simple `RuntimeError` générique.

Corrigé en deux temps :
1. `RuntimeError` remplacée par une exception dédiée `_AttenteSimulateur`,
   interceptée SÉPARÉMENT dans `_tour_suivant()` (pas dans `exec(avant,
   env)` ni le repli, plus rares et plus ambigus, laissés en erreur
   classique) : elle ne déclenche plus `_rapporter_erreur` — le tour
   renvoie simplement `True` (« rien à afficher cette fois »), sans bandeau
   rouge, et les tours suivants continuent (un déclenchement ultérieur peut
   encore satisfaire la condition).
2. Nouveau bug découvert en MESURANT le temps réel écoulé (pas supposé) :
   avant d'abandonner, `sleep()` empile quand même jusqu'à 3000 fausses
   actions `sleep(10)` dans la file JS (`window.simuQueue`) — les rejouer
   coûtait jusqu'à 3000 × 10 ms ≈ 30 secondes de VRAIE attente par tour
   manqué, jusqu'à 2 minutes sur les 5 tours d'un passage. Invisible à la
   lecture du code, seule une mesure de durée (`performance.now()` avant/
   après un passage complet) l'a révélé. Corrigé par
   `window.simu_tronquerFile(longueur)` (`un.js`) : `_tour_suivant()`
   note la longueur de la file avant `exec(corps, env)`, et la retronque à
   cette longueur en cas de `_AttenteSimulateur`, avant que
   `simu_playQueue()` (appelé par le code JS appelant) n'ait la moindre
   chance de rejouer les actions abandonnées.

Vérifié dans le navigateur avec le programme exact de l'utilisateur, en
mesurant la durée réelle de bout en bout (pas seulement en lisant le
bandeau d'état) : bouton jamais pressé pendant tout le passage (pire cas)
→ ~120 ms, aucune erreur affichée, aucune LED allumée (fidèle à la vraie
carte : rien ne s'affiche tant que le bouton n'est pas pressé) ; bouton
tenu pendant tout le passage → ~10 s (5 tours × les 2 secondes réelles de
« attendre 1 s » × 2 dans le programme lui-même, PAS de délai parasite),
DEL finales correctes (motif HAPPY) ; bouton pressé puis relâché → aucun
bandeau d'erreur persistant, contrairement au premier correctif.

Retenir (complète le précédent) : corriger un plantage en interceptant
l'exception ne suffit pas — il faut aussi se demander (1) si le cas
intercepté est réellement une ERREUR de programme ou un état normal juste
mal reconnu (ici : « en attente », pas « cassé »), et (2) MESURER le coût
réel restant (ici : le temps d'horloge, pas juste l'absence de plantage)
avant de considérer un correctif de simulateur comme terminé.

**PIÈGE nº 55 — un mock renvoyant une constante « raisonnable » (0) peut
rendre un bloc entier inutilisable en simulation, silencieusement.**
Signalé par l'utilisateur en testant lui-même l'exemple du chronomètre
proposé plus haut (§ blocs `reset_chrono`/`valeur_chrono`) : « l'affichage
reste toujours à 0 ». Cause : `running_time()` (mock `index.html`) était
un stub `def running_time(): return 0` — utilisé aussi bien par
`reset_chrono`/`valeur_chrono` (§ ci-dessus) que par le bloc
`temps_execution` (catégorie Capteurs). Comme les deux blocs chronomètre
calculent une DIFFÉRENCE de deux appels à `running_time()`, et que les deux
appels renvoyaient toujours 0, le résultat était TOUJOURS 0 — le bloc
semblait fonctionner (aucune erreur, code correct) mais n'affichait jamais
qu'une valeur figée, indétectable à la simple lecture du code généré.

Corrigé en adossant `running_time()` au temps d'horloge réel plutôt qu'à
une constante : `window.simu_tempsEcoule()` (`un.js`), basé sur
`performance.now()` relatif à `window.simu_tempsDepart` (capturé au
chargement, remis à zéro dans `simu_reinitialiser()` — comme un vrai reset
matériel remettrait `running_time()` à 0). Cohérent avec le reste du
simulateur, qui impose déjà de vrais délais d'horloge (`sleep`,
`attendre`) : le chronomètre avance donc au même rythme que ces délais.
Vérifié dans le navigateur, en mesurant des lectures successives sur
plusieurs tours réels : la valeur progresse bien avec le temps
(`0.002` puis `2.029` après ~2 s réelles), et repart de `0.0` après
« Réinitialiser la simulation » même après plusieurs secondes écoulées.

Retenir : dans un simulateur à base de mocks, une fonction qui renvoie une
constante plausible (0, ici) ne provoque ni erreur ni plantage — elle rend
juste un bloc silencieusement inerte. Ce genre de bug n'est repérable qu'en
utilisant RÉELLEMENT le bloc concerné (ici, en le regardant dans un
programme qui tourne), pas en relisant le code du mock isolément.

**PIÈGE nº 56 — un passage figé à 5 tours (§14) masque, plutôt que résout,
un « Répéter indéfiniment » sans bloc « attendre ».** Question directe de
l'utilisateur après avoir vu deux exemples (chronomètre sur l'écran micro:bit,
puis sur un écran LCD Grove) sembler « ne pas fonctionner » : pourquoi
seulement 5 tours ? Depuis la conception d'origine du simulateur (§7, §14),
chaque déclenchement (« Lancer », ou un capteur virtuel via
`continuer_ou_lancer_simulation`) exécute EXACTEMENT 5 tours de la première
boucle infinie puis s'arrête — aucune justification documentée pour ce
chiffre précis, seulement la contrainte technique de départ : `exec()`
(Brython) est synchrone, un `while True` littéral gèlerait l'onglet pour
toujours, donc il fallait UNE limite finie quelconque. Conséquence
silencieuse pour un programme sans bloc « attendre » dans sa boucle : les 5
tours s'enchaînent en quelques millisecondes (rien ne les espace), puis plus
rien ne se passe tout seul — exactement les deux cas rapportés par
l'utilisateur.

Corrigé en remplaçant la limite fixe par un enchaînement sans fin : dans
`simu_lancerTours` (`un.js`), au lieu de s'arrêter à `nRestants <= 0`, un
nouveau passage de 5 tours est reprogrammé (`setTimeout(..., 0)`, pour
casser la chaîne d'appels synchrones — sans lui, un programme sans aucun
délai enchaînerait les passages en récursion synchrone pure et finirait par
dépasser la pile d'appels), sauf si `jetonSimulation` a changé entretemps
(nouveau déclenchement ou « Réinitialiser », qui l'incrémentent déjà tous les
deux) — dans ce cas, quelque chose de plus récent gère déjà l'état, rien à
faire. `window.simuEnCours` ne repasse donc plus à `false` à chaque frontière
de 5 tours (seulement sur erreur ou réinitialisation explicite) : un
programme tourne désormais VRAIMENT en continu, comme sur la vraie carte,
jusqu'à interruption explicite.

Bug annexe trouvé en réfléchissant à ce changement (pas en le testant après
coup) : `_demarrer_session()` (`index.html`) ne remettait `simuEnCours` à
`False` qu'à la fin d'un passage de tours reçus avec succès — si un NOUVEAU
« Lancer » échouait dès la configuration (`exec(avant, env)`, avant même le
premier tour) PENDANT qu'un ancien passage laissait `simuEnCours` à `True`,
plus rien ne le repassait jamais à `False` : les capteurs virtuels restaient
bloqués indéfiniment (leur garde vérifie `!window.simuEnCours`). Rare avant
ce changement (un passage de 5 tours se terminait vite de toute façon, se
remettant lui-même à `False` sous peu) mais réellement bloquant maintenant
qu'un passage peut durer indéfiniment. Corrigé en remettant `simuEnCours` à
`False` au tout début de `_demarrer_session()`, avant de savoir si la
configuration va réussir — la valeur définitive est de toute façon décidée
moments plus tard par le premier tour réel, le cas échéant.

Vérifié dans le navigateur avec l'exemple LCD exact de l'utilisateur : passage
observé en continu sur plus de 28 secondes réelles (`simuEnCours` toujours
`True`, très au-delà des ~5 secondes de l'ancienne limite), valeur affichée
cohérente avec le temps réellement écoulé (`24.261` après ~28 s) ; « Réinitialiser »
arrête net la chaîne (`simuEnCours` reste `False` 3 s plus tard, rien ne la
relance en douce) ; un second clic sur « Lancer » en PLEIN MILIEU d'un passage
redémarre proprement de zéro, une seule chaîne active (pas de doublon, pas de
valeurs mélangées).

Retenir : une limite technique posée tôt pour une bonne raison (ici, éviter
un gel) peut, une fois le vrai problème résolu par ailleurs (l'exécution tour
par tour du §14, puis les gardes anti-gel du PIÈGE nº 54), devenir elle-même
la source du symptôme suivant. Remettre en question une constante ancienne
vaut mieux que d'empiler un énième correctif ad hoc autour d'elle.

**PIÈGE nº 57 — « simulation fonctionne mais pas le réel » n'est pas
toujours un bug de code : parfois c'est une vraie différence physique que le
simulateur ne peut pas modéliser.** Signalé par l'utilisateur avec « lorsque
la broche P0 est activée » : fonctionne au clic dans le simulateur, rien ne
se passe sur la vraie carte. Code généré, a priori correct :
```python
def on_pin_pin0_touched():
    display.show(Image.HAPPY)
    ...
while True:
    if pin0.is_touched(): on_pin_pin0_touched()
```
Ni le générateur ni le simulateur n'étaient en cause cette fois — vérifié
via une recherche documentaire (`WebFetch`/`WebSearch`, docs officielles
micro:bit MicroPython) plutôt que suppose de memoire : par défaut,
`pinX.is_touched()` (X = 0, 1, 2 — PAS le logo, qui a son propre capteur
capacitif dédié) utilise une détection **RÉSISTIVE**, qui mesure une
résistance entre la broche et GND. Sur la vraie carte, il faut donc
**toucher la broche ET une broche GND simultanément** (une main sur GND, un
doigt sur P0) pour que ça se déclenche — toucher P0 seul, comme le permet
un simple clic dans le simulateur (qui ne modélise aucun circuit GND), ne
suffit pas. La carte V2 propose un mode **capacitif** optionnel
(`pinX.set_touch_mode(pinX.CAPACITIVE)`), qui ne nécessite qu'un seul
doigt — mais rien ne l'activait, ni dans les blocs ni dans le simulateur.

Corrigé en activant ce mode automatiquement, plutôt que d'exiger de
l'utilisateur qu'il comprenne le circuit GND : `activerToucheCapacitive(broche)`
(nouvelle fonction, `un.js`) injecte `pinX.set_touch_mode(pinX.CAPACITIVE)`
dans `P.definitions_` (dédupliqué par broche, même motif que
`P.INDENT`/`importerMicrobit()` ailleurs dans le fichier), appelée depuis
les DEUX générateurs qui lisent une broche tactile (`lorsque_broche`,
`broche_est_pressee`) — sans quoi seul l'un des deux blocs aurait le
correctif. Trois points annexes, chacun oubliable :
1. `PinMock` (`index.html`) n'avait pas de méthode `set_touch_mode` :
   l'appeler aurait fait planter EXEC dans le simulateur (`AttributeError`),
   cassant tout programme utilisant ces blocs — corrigé par un stub inerte
   (`def set_touch_mode(self, mode): pass`), le simulateur ne modélisant de
   toute façon aucun circuit GND, peu importe le mode choisi.
2. Le moteur de reconstruction (§ reconstruction, plus haut) aurait affiché
   cette ligne comme un bloc « code personnalisé » parasite au ré-import
   d'un `.py` exporté — corrigé en l'ajoutant à `reconstruireInstructionUnique`
   avec `bloc: null`, même traitement que les imports.
3. Vérifié que l'appel est bien DÉDUPLIQUÉ (une seule ligne même si P0 est
   utilisé par deux blocs « lorsque la broche… », un « touched » et un
   « released ») plutôt que répété une fois par bloc.

Vérifié dans le navigateur : code généré contient bien
`pin0.set_touch_mode(pin0.CAPACITIVE)` une seule fois même avec deux blocs
sur P0 (plus un troisième sur P1, avec sa propre ligne) ; simulation
toujours fonctionnelle (aucune erreur, DEL HAPPY correctement affichées) ;
ré-import du code généré ne produit aucun bloc parasite pour cette ligne.

Retenir : avant de chercher un bug de CODE à un écart simulateur/carte
réelle, vérifier s'il existe une différence PHYSIQUE documentée (circuit,
mode de capteur...) que le simulateur ne peut structurellement pas
reproduire — une recherche dans la documentation officielle du matériel
vaut mieux qu'une supposition, surtout quand rien dans le code lui-même ne
semble fautif à la lecture.

**PIÈGE nº 58 — le filet silencieux du PIÈGE nº 54 ne couvrait que le corps
de la boucle : « attendre jusqu'à » dans « Au démarrage » affichait encore le
bandeau rouge.** Signalé par l'utilisateur (capture du bandeau « n'aboutit
pas dans ce tour de simulation »). `_AttenteSimulateur` n'était interceptée
que dans `_tour_suivant()` ; `exec(avant, env)` et le repli sans boucle
passaient par le `except Exception` générique. Or « attendre le bouton A
puis démarrer » est précisément le motif naturel d'un « Au démarrage ».
Hypothèse retenue (la capture ne montrait pas les blocs) : l'attente est
dans « Au démarrage » ; à reconfirmer si le bandeau réapparaît.

Corrigé en rendant l'attente RÉELLE plutôt qu'en la taisant : `exec()` ne
peut pas se suspendre, mais le générateur produit toujours le même motif
exact (`while not (COND):` puis `  sleep(10)`). `_decouper_attentes()`
(`index.html`) coupe le code à chaque occurrence de premier niveau, et
`_executer_morceaux()` exécute le morceau d'avant, rejoue son affichage
(`_simuApresVidageFile` + `simu_playQueue`), surveille ensuite la condition
toutes les 25 ms (la page reste réactive, un appui virtuel peut la rendre
vraie), puis exécute la suite et enchaîne sur les tours. Détails à ne pas
oublier : `window.simuEnCours = True` pendant l'attente (sinon un appui sur
un capteur virtuel relancerait toute la simulation) ; `_session_active =
False` jusqu'à la fin de « Au démarrage » (sinon un capteur « reprendrait »
une session à mi-chemin) ; `window.simu_jeton()` (nouveau, `un.js`) pour
abandonner sans bruit si « Réinitialiser » ou un nouveau « Lancer » survient
pendant l'attente. Les attentes imbriquées (dans un `if`, une boucle...)
gardent l'ancien comportement (erreur lisible) : seules celles de premier
niveau sont découpées. Même mécanisme appliqué au repli sans boucle unique.

Vérifié dans le navigateur : « afficher Triste » → « attendre jusqu'à A » →
« afficher Cœur » : le visage triste reste affiché pendant l'attente, sans
bandeau ; un appui de 150 ms sur A affiche le cœur et la boucle démarre ;
« Réinitialiser » pendant l'attente l'abandonne (un appui ultérieur ne
déclenche rien).

## 12. Panneau administrateur

Extension du principe du §5 (`updateToolbox` à chaud) en un vrai panneau à
onglets, réservé à l'enseignant.

### Activation — sans vraie sécurité, et le dire

L'application est 100 % cliente, sans compte ni serveur : aucune
authentification réelle n'est possible. Un raccourci clavier discret
(Ctrl+Alt+Maj+A) bascule un booléen en mémoire et affiche/masque le seul
bouton d'entrée (`display: none` par défaut). Ce n'est qu'une dissuasion
contre un clic accidentel d'élève, pas une protection — le documenter
clairement évite qu'on s'y fie à tort.

### Modèle de données — un seul objet, une seule clé localStorage

```js
function configAdminParDefaut() {
    return { categories: { order: [], hidden: [], labels: {}, colors: {} },
             groupes: {}, sousMenus: [], libellesBlocs: {} };
}
```

- `categories` : ordre/masquage/renommage/**couleur** des catégories de
  premier niveau. On repart toujours d'une table d'origine
  (`TOOLBOX_ORIGINAL`, clonée en profondeur **une fois**, avant toute
  modification), jamais du tiroir courant, et une catégorie absente de
  l'ordre enregistré se replace à la fin plutôt que de disparaître — c'est ce
  qui permet d'ajouter une catégorie à l'application sans la faire disparaître
  chez qui a déjà réordonné.
- `groupes` : même quadruplet (order/hidden/labels/colors), mais par
  catégorie parente, pour ses **sous-catégories natives** (Communication,
  Grove). Une config sauvegardée par une version antérieure à l'ajout des
  couleurs n'a pas cette clé : la compléter au chargement
  (`config.groupes[parent].colors ||= {}`) plutôt que de laisser une
  écriture ultérieure planter sur `undefined`.
- `sousMenus` : liste de groupes **créés par l'admin**, chacun
  `{id, parent, nom, couleur, blocs: [types...]}` — n'existe que pour les
  catégories qui n'ont pas déjà de sous-catégories natives (pas de nesting à
  trois niveaux : un sous-menu ne peut pas en contenir un autre).
- `libellesBlocs` : `{ "type#index": "texte" }` — voir plus bas.

Comme pour un simple ordre : encadrer **lecture et écriture** de
`localStorage` (navigation privée, stockage refusé), avec une config par
défaut qui rend l'application utilisable même si le stockage échoue.

### Reconstruction de la toolbox — une fonction pure, jamais de mutation

`construireToolbox()` part de `TOOLBOX_ORIGINAL` (jamais modifié) et produit un
nouveau tableau à chaque appel, catégorie par catégorie :

- catégorie dynamique (`custom: "VARIABLE"/"PROCEDURE"`, pas de `contents`) :
  seul le nom affiché peut changer, Blockly remplit le reste lui-même.
- catégorie déjà organisée en sous-catégories natives : on les réordonne,
  masque, renomme, sans permettre d'en créer de nouvelles à ce niveau.
- catégorie à plat : les blocs repris dans un `sousMenus` personnalisé en
  sortent (`contents.filter(...)`), le reste garde sa position d'origine ; les
  sous-menus personnalisés sont ajoutés après.

**PIÈGE nº 26 — un nouveau tiroir doit pouvoir être caché par défaut sans
passer par la config sauvegardée.** Un module encore expérimental (le
DHT11/DHT22 du §9) doit rester masqué pour un enseignant qui n'a jamais ouvert
le panneau, donc *avant* toute lecture de `localStorage`. Une config par
défaut vide ne suffit pas : il faut une table séparée de secours,
`SOUS_MENUS_MASQUES_PAR_DEFAUT = { 'Grove': [...] }`, consultée uniquement
quand `configAdmin.groupes[nomParent]` n'existe pas encore. Dès que l'admin
touche un seul réglage de ce parent — même sans rapport avec le module masqué
— une entrée `groupes[nomParent]` est créée et sauvegardée : il faut donc
**copier la table de secours dedans au moment de cette première création**,
pas se contenter de la consulter à chaque rendu, sinon rouvrir l'onglet une
deuxième fois suffit à annuler le masquage.

### Les quatre onglets

- **Catégories** : liste réordonnable (`draggable`), une icône œil masque, un
  crayon renomme (remplace le texte par un `<input>`, valide sur `blur` ou
  Entrée, annule sur Échap), une pastille `<input type="color">` recolore.
  La couleur d'origine d'une catégorie est une **teinte Blockly** (0-360,
  ex. `"230"`), pas un hex : pour pré-remplir le sélecteur natif avec la
  couleur réellement affichée, la convertir avec la même saturation/valeur
  que la palette par défaut de Blockly (`S=0.45`, `V=0.65`), sinon la
  pastille montre une couleur différente de celle du tiroir tant qu'elle n'a
  pas été touchée. La surcharge, elle, est stockée directement en hex — un
  `colour` Blockly accepte les deux formats, aucune conversion n'est
  nécessaire pour l'appliquer.
- **Sous-menus** : un `<select>` des catégories qui ont un `contents` (donc
  pas Variables/Fonctions). Si la catégorie a déjà des sous-catégories
  natives, même liste réordonnable (et recolorable) que l'onglet Catégories.
  Sinon, formulaire de création : cases à cocher sur les blocs encore à plat,
  un nom, un bouton qui pousse dans `sousMenus` — sa couleur hérite de celle
  de la catégorie parente à la création, puis se change directement sur
  l'entrée (`sousMenu.couleur`), sans table de surcharge séparée : elle n'a
  qu'un seul possesseur, contrairement à une catégorie ou une sous-catégorie
  native qui existent indépendamment de toute personnalisation.
- **Libellés** : chaque `appendField("texte")` sans nom crée un `FieldLabel`
  anonyme. On le repère par sa **position parmi les seuls `FieldLabel` du
  bloc** (ordre des `appendField` dans `init`) : une clé `type#index` stable
  tant que le bloc n'est pas réécrit, sans avoir à nommer à la main des
  centaines de champs. Pour connaître le texte *par défaut* de chaque champ
  (nécessaire au bouton « réinitialiser » et pour peupler la recherche),
  instancier une fois chaque type de bloc dans un `new Blockly.Workspace()`
  **invisible, jamais injecté dans la page** — un bloc non rendu construit
  quand même ses champs, `getValue()` fonctionne sans SVG.

  Appliquer un libellé enregistré ne suffit pas de l'écrire une seule fois :
  chaque type de bloc doit être **patché à sa définition**, avant toute
  création d'instance (y compris les deux blocs de départ posés au premier
  chargement), pour que le tiroir *et* le canevas en bénéficient :

  ```js
  for (const type in Blockly.Blocks) {
      const definition = Blockly.Blocks[type];
      if (!definition || typeof definition.init !== 'function') continue;
      const initOrigine = definition.init;
      definition.init = function() {
          initOrigine.call(this);
          appliquerLibellesBloc(this);   // relit configAdmin.libellesBlocs
      };
  }
  ```

  Ce patch doit courir **avant** `Blockly.inject(...)`, sinon les blocs créés
  pendant l'injection (l'espace de départ) échappent au premier rendu.
- **Aide** : le contenu de `readme.txt`, chargé par `fetch()` au premier clic
  (fichier statique servi par `app.py` à côté d'`index.html` — donc à ajouter
  aussi aux `datas` de `app.spec` si le projet est empaqueté, sans quoi
  l'onglet fonctionne en développement et se casse silencieusement une fois
  packagé).

### Exposer un point d'entrée pour la vérification

Un glisser-déposer, un raccourci clavier ou la saisie dans un `<input>` ne se
simulent pas facilement depuis la console. Exposer les actions du panneau sous
un objet global (`window.adminTest`) permet de piloter les mêmes chemins de
code que l'UI — dans l'esprit du §21 (vérifier en pilotant l'application,
jamais en se fiant à l'absence d'erreur).

## 13. Édition manuelle du code

Bouton « ✎ Éditer » au-dessus de la transcription : bascule un `<textarea>` à
la place de l'affichage en lecture seule.

### Le renoncement assumé : pas de synchronisation dans les deux sens

Blockly sait transformer des blocs en Python ; l'inverse — reconnaître dans du
texte arbitraire les blocs qui l'auraient produit — n'existe pas de façon
fiable pour un jeu de blocs personnalisé. Ne pas essayer de le construire :
le mode retenu est **exclusif**, pas bidirectionnel.

- Entrer en édition **gèle le canevas Blockly** : un voile `position: absolute;
  inset: 0` par-dessus `#blocklyDiv` (dans un conteneur commun mis en
  `position: relative`, sans toucher au `<div>` que Blockly gère lui-même)
  capte aussi les clics, puisqu'un élément superposé intercepte les
  événements de pointeur sans qu'il soit nécessaire de désactiver l'espace de
  travail par son API. Le focus part sur le `<textarea>`, pour que les
  raccourcis clavier n'atteignent plus un bloc resté sélectionné.
- Ce qui est tapé remplace **en direct** une seule variable globale
  (`window.currentPythonCode`) déjà lue par le simulateur et les boutons de
  téléchargement/envoi (voir §3 et §7) : brancher l'édition manuelle sur cette
  variable unique évite de toucher à leur code.
- « ↩ Revenir aux blocs » abandonne la saisie et régénère le code à partir de
  l'état **actuel** des blocs — pas de celui d'avant l'entrée en édition, s'ils
  ont continué d'exister en arrière-plan.

Rien n'est persisté d'une session à l'autre : recharger la page perd la
saisie manuelle, comme elle perd déjà l'espace de travail Blockly lui-même.

### Ne pas dupliquer le calcul du code

La fonction qui génère le code depuis les blocs (scrutation des événements du
§6 comprise) doit être **isolée** de celle qui l'applique à la variable
globale et à l'affichage : le retour aux blocs et l'écouteur de changements de
l'espace de travail appellent la même fonction de génération, sinon les deux
chemins divergent au premier correctif apporté à l'un des deux :

```js
function genererCodeDepuisBlocs() { /* … scrutation comprise … */ return codePython; }
function definirCodeActuel(codePython) { window.currentPythonCode = codePython; /* … */ }

function updatePythonCode() {
    const codePython = genererCodeDepuisBlocs();
    if (editionManuelleActive) return;   // filet : le voile devrait déjà l'empêcher
    definirCodeActuel(codePython);
    afficherTranscription(codePython);
}
```

**PIÈGE nº 27 — une variable d'état lue avant sa déclaration, plus bas dans le
même fichier.** `updatePythonCode()` est appelée immédiatement après sa
définition (`updatePythonCode();`) et lit un booléen d'état
(`editionManuelleActive`) : le déclarer avec `let` seulement dans la section
qui construit l'UI d'édition, plus bas dans le fichier, lève `Cannot access
'editionManuelleActive' before initialization`. Le fichier entier est une
seule portée de fonction, mais `let`/`const` restent en zone morte tant que
leur ligne de déclaration n'a pas été exécutée. Déclarer ces booléens d'état
**avant** la première fonction qui les lit, jamais dans la section qui les
manipule le plus (l'endroit le plus naturel à lire n'est pas forcément le bon
endroit où déclarer).

## 14. Exécution tour par tour — sleep() ne met jamais en pause

Sans quoi un vrai suivi de ligne (§15) est impossible : `sleep()` ne fait
qu'empiler une action, et le programme entier (les 5 tours de la boucle
`while True`) s'exécute d'un seul bloc synchrone. Les délais visuels (texte,
son) sont rejoués *après coup*, avec de vrais délais — mais un capteur lu au
tour 3 voit encore la position du tour 0, puisque rien n'a encore bougé au
moment où le code Python s'exécute. Pour un ruban LED ça n'a aucune
importance (rien ne dépend de son état) ; pour un capteur qui doit refléter
un déplacement réel entre deux tours, ça rend le retour d'information faux
en silence — le programme tourne sans erreur, il regarde juste toujours la
même photo.

**PIÈGE nº 28 — restructurer l'exécution sans pouvoir suspendre Python.**
Faire vraiment pauser `sleep()` en plein milieu d'une fonction imbriquée
demanderait des générateurs Python et un `yield from` à *chaque* site
d'appel touchant potentiellement du code bloquant — y compris dans les
fonctions que les blocs "Fonctions" laissent l'utilisateur créer. Aucun
générateur de blocs ne produit ce genre de code, et le retrofit reviendrait à
réécrire tout le générateur Python. Solution retenue à la place : ne pas
suspendre *dans* une itération, mais entre deux itérations — la seule
frontière que le générateur contrôle déjà (`while True:` → `for _ in
range(5):`). Isoler le corps de la boucle et l'exécuter un tour à la fois,
en vidant sa file avec de vrais délais avant de lancer le tour suivant :

```js
// un.js — orchestration cote JS (déjà réagencé pour l'édition manuelle du §13)
window.simu_lancerTours = function(nRestants) {
    if (nRestants <= 0) { window.simu_finDesTours(); return; }
    if (window.simu_tourSuivant() === false) return;   // erreur déjà affichée
    const jeton = jetonSimulation;
    window._simuApresVidageFile = () => {
        if (jeton === jetonSimulation) window.simu_lancerTours(nRestants - 1);
    };
    window.simu_playQueue();
};
```

```python
# index.html — cote Brython : isoler le corps, l'exécuter une fois par tour
def _tour_suivant():
    try:
        exec(corps, env)          # `env` est le MEME dict a chaque tour : les
        return True                # variables du programme y survivent.
    except Exception as e:
        _rapporter_erreur(e)
        return False

window.simu_tourSuivant = _tour_suivant
window.simu_finDesTours = _fin_des_tours
window.simu_lancerTours(5)
```

Le crochet côté `simu_playQueue()` : quand la file se vide, appeler un
rappel en attente plutôt que de simplement s'arrêter :

```js
if (window.simuQueue.length === 0) {
    const suite = window._simuApresVidageFile;
    window._simuApresVidageFile = null;
    if (suite) suite();
    return;
}
```

Ce changement est **invisible pour tout ce qui existait déjà** : l'ordre et
le minutage des actions rejouées à l'écran sont identiques à l'ancien
comportement (tout précalculé d'un coup) pour toute fonctionnalité qui ne
relit pas un état modifié par le simulateur lui-même — ce qui est le cas de
tout, sauf des capteurs Maqueen. Vérifié en rejouant le test documenté au
§7 (`was_gesture` déclenche 1 fois sur 5 tours, `is_gesture` 5 fois) après le
changement : résultat identique.

**PIÈGE nº 29 — ne jamais supposer une largeur d'indentation fixe pour
séparer le corps de la boucle.** Le code généré par les blocs utilise
toujours 2 espaces (`Blockly.Python.INDENT`), mais du code tapé à la main
(§13, édition manuelle) peut très bien en utiliser 4, ou des tabulations.
Retirer un nombre fixe de caractères sur chaque ligne laisse un reliquat
d'indentation sur du code à 4 espaces, et `exec()` échoue sur
`IndentationError: unexpected indent` — silencieux à la lecture du code
(il a l'air correct), visible seulement à l'exécution. Utiliser
`textwrap.dedent()` sur le corps isolé : il retire la plus longue
indentation commune à toutes les lignes, quelle que soit sa largeur.

Cas de repli, volontairement laissés au comportement d'origine (programme
entier d'un coup, 5 tours précalculés) : aucune boucle infinie de premier
niveau trouvée, ou plusieurs (rare — un élève peut empiler deux blocs
« répéter indéfiniment »). Un vrai découpage tour par tour pour plusieurs
boucles concurrentes demanderait de les entrelacer, hors de portée ici.

## 15. Maqueen Plus — un robot qui se déplace vraiment sur une piste

Inspiré d'un simulateur avec piste et châssis Maqueen Plus vu ailleurs (type
Mind+/DFRobot). Nouvelle catégorie de blocs, plus une piste dessinée dans le
panneau simulateur où le robot avance réellement, dont les capteurs de ligne
lisent la piste sous lui — rendu possible par le §14 ci-dessus.

### Protocole I²C — repris d'un pilote MicroPython vérifié, pas deviné

Adresse `0x10`. Moteurs sur les registres `0x00` (gauche) / `0x02` (droit),
écriture de 3 octets `[registre, sens, vitesse]` (sens 0 = avant, 1 =
arrière, vitesse 0-255). État des cinq capteurs de ligne sur un seul octet
(`0x1D`, un bit par capteur : L2=`0x10`, L1=`0x08`, M=`0x04`, R1=`0x02`,
R2=`0x01`), leur valeur brute (16 bits) sur les registres `0x1E` à `0x26`.
Phares sur `0x0B`/`0x0C`. Les DEL RGB et l'ultrason ne passent **pas** par le
registre I²C : DEL en NeoPixel direct sur P15, ultrason sur P13 (trig) / P14
(echo) via `machine.time_pulse_us`, exactement le même principe que le
module Grove Ultrason déjà présent — ne pas réinventer un second pilote
ultrason, copier celui qui est déjà vérifié. Source du protocole :
`GBSL-Informatik/maqueen-plus-v2-mpy` (MicroPython, basé sur le paquet
MakeCode officiel DFRobot) — comme pour le DHT11/DHT22, ne jamais deviner un
protocole I²C à partir de captures d'écran ou de mémoire, toujours le
retrouver dans une source vérifiable.

### La piste : un `<canvas>` servant à la fois d'affichage et de capteur

Dessinée **une seule fois** avec `ctx.roundRect(...)` puis un `stroke()`
blanc épais — inutile de calculer un tracé plus élaboré, un rectangle
arrondi suffit à faire une boucle fermée franchissable. Le capteur de ligne
ne lit PAS un tracé paramétrique : il relit directement le pixel du canevas
à la position calculée du capteur (`getImageData(x, y, 1, 1)`), blanc = sur
la ligne. Ça marche pour n'importe quel dessin de piste, procédural ou non —
aucune structure de données séparée à maintenir en double.

Le robot, lui, est un `<div>` positionné par-dessus en **pourcentage** des
coordonnées internes du canevas (`left: X/largeur*100%`), pas en pixels
absolus : il suit alors tout seul la mise à l'échelle CSS du canevas
(`width: 100%` sur un `aspect-ratio` fixe) sans recalcul JS au
redimensionnement, contrairement à la mise à l'échelle par `transform:
scale()` déjà utilisée pour la carte micro:bit (§7) qui suppose un calcul
explicite de facteur.

### Cinématique différentielle — et son piège de signe

```js
const v = (vGauche + vDroite) / 2;                    // vitesse lineaire
const omega = (vGauche - vDroite) / EMPATTEMENT;       // vitesse angulaire, rad/s
x += v * dt * Math.cos(cap);
y += v * dt * Math.sin(cap);
cap += omega * dt;
```

Intégration d'Euler simple, un seul pas par appel de `sleep()` : suffisant
tant que les pas restent petits (le `sleep(50)` à `sleep(200)` typique d'une
boucle de contrôle), sans prétendre à une trajectoire d'arc exacte sur un
grand pas.

**PIÈGE nº 30 — le sens de rotation dépend de la convention d'axes, et se
trompe silencieusement.** Sur un canevas, l'axe Y pointe vers le **bas** :
un angle qui augmente fait donc tourner visuellement dans le sens des
aiguilles d'une montre, pas l'inverse comme en mathématiques classiques (Y
vers le haut). La formule manuel de la cinématique différentielle
(`omega = (vDroite - vGauche) / L`) suppose la convention mathématique
standard ; copiée telle quelle sur un canevas, elle fait tourner le robot du
**mauvais côté** — roue droite plus rapide tournait vers la droite au lieu
de la gauche, silencieusement, sans qu'aucune erreur ne le signale : le
robot bouge, juste pas dans le sens attendu. Une IndentationError se
remarque tout de suite ; un signe de rotation inversé ne se voit qu'en
mesurant. Vérifié par calcul : avec `vGauche=100, vDroite=200`, le cap doit
décroître (le nez part vers la gauche, où sont montés les capteurs L1/L2),
pas croître — la formule doit donc être `(vGauche - vDroite) / L`, pas
`(vDroite - vGauche) / L`.

### Capteurs de ligne : décalage de montage, pas une broche

Les cinq capteurs (L2, L1, M, R1, R2) ne sont pas des broches physiques
distinctes dans la simulation, seulement des décalages latéraux fixes par
rapport au centre du robot (`{L2: -16, L1: -8, M: 0, R1: 8, R2: 16}`), même
esprit que les décalages des capteurs de ligne sur le vrai châssis. Leur
position réelle se recalcule à chaque lecture à partir du cap courant :

```js
const avantX = Math.cos(cap), avantY = Math.sin(cap);
const droiteX = -avantY, droiteY = avantX;   // perpendiculaire vers la DROITE du robot
const x = robot.x + avantX * AVANT_CAPTEURS + droiteX * decalage;
const y = robot.y + avantY * AVANT_CAPTEURS + droiteY * decalage;
```

Un décalage positif va donc vers la droite (R1/R2), négatif vers la gauche
(L1/L2) — cohérent avec le signe de `omega` ci-dessus : les deux doivent
s'accorder, sinon un programme qui « tourne vers le capteur qui a quitté la
ligne » tournerait en fait à l'opposé.

### Étendre l'exécution tour par tour, pas la dupliquer

Le déplacement du robot doit s'appliquer au même endroit que le §14 fait déjà
avancer le temps simulé — dans le traitement de l'action `'sleep'` de la
file, juste avant `suiteApres()` :

```js
else if (action.type === 'sleep') {
    avancerMaqueen(action.value);   // avant la vraie pause : la position doit
    suiteApres(action.value);       // deja etre a jour quand suiteApres reprend
}
```

Écrire vitesse/phares/DEL passe par la file comme un servo ou un moteur
DRV8830 déjà présents (`window.simuQueue.push({...})`) — **jamais** en
écriture directe et instantanée sur l'état : la variable de vitesse doit
changer au même rythme que le reste de la file, sinon un programme qui
alterne plusieurs vitesses moteur dans la même boucle verrait toutes ses
écritures appliquées d'un coup avant le premier `sleep()`, invalidant tout
l'intérêt du §14. Les lectures (ligne, distance), à l'inverse, sont
synchrones — comme la distance Grove déjà en place — puisqu'un capteur se
lit à l'instant où le programme le demande, sans délai visuel à respecter.

### Un bug préexistant corrigé au passage : DHT11/DHT22 sans substitut simulateur

En construisant les substituts Maqueen, l'absence de `_CapteurDHT11Mock` /
`_CapteurDHT22Mock` dans `env` saute aux yeux par comparaison avec les
autres modules Grove. Sans eux, un programme utilisant DHT11/DHT22 plantait
sur `NameError` dès qu'on cliquait « Lancer la simulation » — jamais détecté
faute d'avoir testé ce chemin précis à l'origine (voir §21 : la génération
de code seule ne suffit pas, il faut aussi *exécuter*). Prévoir un
`_CapteurXMock` pour **chaque** classe qu'un pilote Grove peut instancier
est donc à vérifier systématiquement à la création d'un nouveau module, pas
seulement pour ceux qui ont l'air d'avoir besoin d'un rendu visuel.

### Placer le robot à la souris, et une conséquence à en tirer sur le point de départ

Glisser-déposer avec `pointerdown`/`pointermove`/`pointerup` (les Pointer
Events unifient souris et tactile, `touch-action: none` en CSS empêche le
geste de faire défiler la page à la place) : convertir la position du
pointeur en coordonnées internes de la piste (`(clientX - rect.left) /
rect.width * LARGEUR`), pas en pixels d'écran — le robot est déjà positionné
en pourcentage (voir plus haut), donc cohérent avec le redimensionnement CSS
sans code supplémentaire.

Une fois déposé, la nouvelle position devient le **point de départ**
(`MQ_DEPART`, muable et non plus une constante), pas seulement la position
courante : sans ça, « Réinitialiser la simulation » effacerait le placement
choisi à chaque clic, ce qui viderait la fonctionnalité de son intérêt — le
but est justement de pouvoir tester un programme depuis un endroit précis de
la piste de façon répétable.

### Animer le déplacement — et le piège qu'une transition CSS révèle sur l'angle

Une position mise à jour d'un coup (téléporter puis figer jusqu'au prochain
tour) se voit comme saccadée, même quand le calcul de cinématique est
correct : rien n'interpole visuellement entre l'ancienne et la nouvelle
position. Remède simple, une transition CSS calée sur la **durée réelle**
du `sleep()` qui a déclenché le déplacement :

```js
robotEl.style.transition =
    'left ' + ms + 'ms linear, top ' + ms + 'ms linear, transform ' + ms + 'ms linear';
// … puis on change left/top/transform : le navigateur anime la difference.
```

Écrire `transition = 'none'` avant tout déplacement qui doit être instantané
(glisser-déposer, réinitialisation, positionnement de test) — sinon ces
changements-là s'animent aussi, ce qui donne un robot qui « rattrape »
mollement le pointeur au lieu de le suivre.

**PIÈGE nº 31 — replier un angle dans [0, 360[ casse l'animation CSS à la
frontière.** Une transition CSS sur `transform: rotate()` interpole
**numériquement** entre l'ancienne et la nouvelle valeur, sans savoir qu'un
angle est périodique. Si le cap est ramené dans [0, 360[ après chaque pas
(`cap = ((cap + delta) % 360 + 360) % 360`), un virage qui franchit la
frontière — 350° qui devient 10° après un delta de +20° — s'affiche comme
une rotation de -340° (le tour complet dans l'autre sens) plutôt que les +20°
réels : le robot semble faire un tour sur lui-même à chaque passage par
zéro. Solution : ne **jamais** replier l'angle pendant la conduite, le
laisser croître ou décroître sans limite (`cap += delta`, un nombre réel
quelconque) — `Math.cos`/`Math.sin` et `rotate()` en CSS sont tous les deux
périodiques et s'en accommodent très bien. Ne remettre à une valeur connue
(0° ou autre) qu'à la réinitialisation explicite, où aucune animation n'est
souhaitée de toute façon (`transition: none`).

### Plusieurs tracés — un registre, pas des variantes du code de dessin

Trois pistes (`PISTES_MAQUEEN = { ovale, rectangulaire, huit }`), chacune un
objet `{ nom, depart: {x, y, cap}, dessiner(ctx) }` plutôt que trois copies
de `dessinerPisteMaqueen()` avec un `if` sur le tracé choisi — changer de
piste devient alors `dessinerPisteMaqueen()` (fond + réglages de trait
communs) suivi de `PISTES_MAQUEEN[cle].dessiner(ctx)` (juste le tracé), et
ajouter une quatrième piste n'est qu'une nouvelle entrée dans le registre.

Le point de départ appartient à la piste, **pas** au robot : un point qui
tombe sur le tracé d'une boucle ovale ne tombe pas forcément sur celui d'un
circuit en huit. Changer de piste doit donc remplacer `MQ_DEPART` par celui
de la nouvelle piste et repositionner le robot dessus tout de suite
(`reinitialiserMaqueen()`), pas garder l'ancien point et laisser l'élève
découvrir que son robot est planté en dehors de la piste.

Le circuit en huit ne calcule aucune intersection : deux tracés en boucle
(`ctx.roundRect` + `stroke`) dont les rectangles de base se chevauchent sur
une quarantaine de pixels suffisent, le croisement du trait blanc apparaît
tout seul dans la zone commune. Plus simple et plus sûr que de calculer une
courbe en forme de huit à la main.

### Éditeur de piste à points de passage

Une piste personnalisée n'est qu'une liste `[{x, y}, …]` reliée par des
segments droits, refermée du dernier point au premier
(`ctx.closePath()` dès qu'il y en a au moins 3) — même style de trait que les
pistes fixes (26 px, blanc), donc les capteurs de ligne n'ont besoin d'aucun
cas particulier pour une piste dessinée à la main. Le point de départ est le
premier point posé, orienté vers le deuxième (`atan2`) : le robot démarre
face à la piste plutôt que dans une direction arbitraire.

Les poignées (un `<div>` par point, positionné en pourcentage comme le
robot) sont des éléments DOM distincts du canevas, **jamais dessinées sur
ses pixels** : le canevas ne doit contenir que la piste elle-même, puisque
c'est aussi lui qu'on relit pour savoir si un capteur est sur la ligne — y
mélanger des poignées de couleur fausserait cette lecture pendant l'édition.

Identifier *quelle* poignée on déplace ou supprime avec un `dataset.index`
relu **au moment de l'événement**, pas capturé une fois pour toutes à la
création : les poignées sont recyclées (on ajoute/retire des `<div>` plutôt
que de tout reconstruire à chaque point posé), et supprimer le point *n*
décale les index de tous les points suivants. Un index figé dans la
fermeture au moment de `addEventListener` pointerait sur le mauvais point
dès la première suppression.

**PIÈGE nº 32 — `setPointerCapture` peut lever une exception, sur un geste
par ailleurs valide.** Rencontré en testant le glisser d'une poignée avec de
vrais `PointerEvent` synthétiques, mais le message d'erreur
(`NotFoundError: No active pointer with the given id`) n'a rien de
spécifique aux tests : un pointeur relâché entre le `pointerdown` et l'appel
à `setPointerCapture`, ou un identifiant que le navigateur ne reconnaît plus,
donne la même exception en usage réel. Comme elle n'est pas rattrapée, une
exception ici **interrompt le reste du gestionnaire** — y compris
`preventDefault()`/`stopPropagation()` placés juste après, qui ne
s'exécutent alors jamais. Encadrer l'appel d'un `try/catch` qui ne fait rien
d'autre que laisser continuer : la capture est un confort (suivre le
pointeur même s'il sort de l'élément), pas une condition pour que le reste
du glisser fonctionne, puisque les écouteurs restent actifs sur l'élément
lui-même.

### Indicateurs de capteurs de ligne — n'afficher que ce que le programme lit vraiment

Même logique que les sections du panneau Grove (§9) : un point par capteur
(L2/L1/M/R1/R2), masqué par défaut, montré seulement si un bloc `capteur de
ligne` ou `valeur brute du capteur de ligne` **posé sur l'espace de
travail** référence ce capteur précis — pas les cinq d'un coup, l'élève ne
doit voir que ce qui compte pour son programme :

```js
function capteursLigneUtilisesMaqueen() {
    const utilises = new Set();
    for (const bloc of window.workspace.getAllBlocks(false)) {
        if (bloc.type === 'maqueen_ligne_etat' || bloc.type === 'maqueen_ligne_valeur') {
            utilises.add(bloc.getFieldValue('CAPTEUR'));
        }
    }
    return utilises;
}
```

Appelée depuis `rafraichirPanneauMaqueen()` (donc à chaque changement de
bloc, comme le reste du panneau) pour la **visibilité** des points, mais leur
**état** (vert/gris) doit rester à jour bien plus souvent que ça — à chaque
déplacement du robot, simulé ou glissé à la souris. Plutôt qu'un second
mécanisme de rafraîchissement, brancher la mise à jour des indicateurs
directement dans `dessinerRobotMaqueen()` : c'est déjà le point de passage
unique pour tout changement de position, qu'il vienne d'`avancerMaqueen()`
(§15), du glisser-déposer ou d'une réinitialisation.

Conséquence : relire jusqu'à cinq pixels du canevas (un `getImageData` par
capteur visible) à *chaque* appel de `dessinerRobotMaqueen()`, largement
assez fréquent pour que le navigateur suggère `willReadFrequently: true` à
la création du contexte 2D — un avertissement console à prendre au sérieux
ici (des lectures répétées sur un petit canevas, pas un cas isolé), pas à
ignorer par réflexe.

## 16. Kitrobot v2 — un second robot, sans supposer le câblage

Second kit, distinct du Maqueen Plus (autre châssis, deux servos + une
piste dédiée départ/arrivée plutôt qu'un circuit fermé), demandé à partir de
captures d'écran (piste avec drapeaux, palette de blocs Détection /
Déplacement / Contrôle / LED RGB). Module **séparé** de Maqueen — pas une
extension — avec sa propre catégorie, sa propre piste, son propre panneau.

### Pas de protocole vérifié cette fois : les broches se choisissent, elles ne se devinent pas

Pour le Maqueen Plus (§15) et le DHT11/DHT22 (§9), un pilote MicroPython
tiers vérifiable a pu être retrouvé et cité. Pour le Kitrobot v2, aucune
source de ce niveau n'a été trouvée. Plutôt que fabriquer un faux protocole
I²C à partir d'une capture d'écran — ce que ce projet s'interdit
systématiquement — le robot est reconstruit comme une **composition de
briques déjà vérifiées séparément** :

- deux servomoteurs à rotation continue (`_servo_continu`, déjà vérifié au
  §8) pour les roues, montés en miroir (signe inversé côté droit) ;
- l'ultrason Grove (`_grove_distance_cm`, §9) pour la distance ;
- le ruban NeoPixel Grove (`neopixel.NeoPixel`, `_grove_teinte`, `_grove_lum`,
  §9) pour les LED RGB ;
- un buzzer sur simple broche numérique, technique standard (`set_analog_
  period_us` + `write_analog(512)` pour un carré PWM à la fréquence voulue) ;
- deux capteurs de ligne Grove Line Finder lus en tout-ou-rien
  (`read_digital()`).

Toutes les broches ont une valeur par défaut plausible (P1/P2 les servos, P0
l'ultrason, P8 le buzzer, P13/P14 les capteurs de ligne, P15 le ruban), mais
**modifiable** par des blocs « définir » facultatifs — exactement le choix
déjà fait pour le Maqueen Plus concernant l'ultrason/le ruban, généralisé ici
à tout le robot puisque rien n'est vérifié. Un tooltip le dit sur chaque bloc
« définir ». Ne pas présenter ces valeurs comme un câblage réel : elles ne le
sont pas.

### La piste : droite, départ/arrivée, noir sur blanc — pas le circuit fermé de Maqueen

Piste dédiée, demandée explicitement pour ne pas réutiliser le système de
piste fermée de Maqueen (§15, boucle refermée sur elle-même). Un simple
segment horizontal épais dessiné une fois au `<canvas>`
(`ctx.moveTo`/`lineTo`/`stroke()`), deux drapeaux « Départ »/« Arrivée » en
`<div>` décoratifs par-dessus — même principe que le robot lui-même :
jamais dessinés sur le canevas, seulement en CSS, puisque le canevas sert
aussi de capteur (`getImageData`) et que tout ce qui s'y dessine en plus
fausserait la lecture des capteurs de ligne.

Couleurs **inversées** par rapport à Maqueen (ligne noire sur fond blanc, au
lieu de blanche sur fond vert) : un choix délibéré pour qu'on distingue les
deux panneaux d'un coup d'œil, pas seulement par leur titre. Conséquence
directe sur la détection : Maqueen teste un pixel *clair* (`pix[0] > 200`
typiquement), Kitrobot teste un pixel *sombre* (`pix[0] < 100 && pix[1] <
100 && pix[2] < 100`). Confondre les deux revient à un capteur qui ne
détecte jamais rien — un piège silencieux (pas d'erreur, juste un capteur
qui renvoie toujours `false`), à vérifier en plaçant le robot manuellement
sur la ligne (`window.kitrobotTest.definirPosition(x, y, cap)`) et en lisant
`surLaLigne('gauche')`.

Cinématique et positionnement du robot : identiques à Maqueen au signe près
déjà corrigé (§15 — `omega = (vGauche - vDroite) / empattement`), aucune
raison de le redécouvrir une seconde fois. Vitesse en pourcentage (-100 à
100, comme les blocs Kitrobot l'exposent) plutôt qu'en -255..255 comme
Maqueen : seule la constante de conversion change.

### Chaque fonction du pilote retiré a besoin de son substitut — pas seulement les feuilles

Point déjà découvert avec DHT11/DHT22 (§9, bug corrigé au §15) et reconfirmé
ici en le construisant dès le départ plutôt qu'en le découvrant après coup :
**tout** ce qui est déclaré à l'intérieur du bloc `# >>> pilote kitrobot …
# <<< pilote kitrobot` disparaît avant l'exécution dans le simulateur — pas
seulement les fonctions qui touchent une broche, mais aussi celles qui ne
font qu'en appeler d'autres. `_kb_case(sens)`, par exemple, ne fait
qu'enchaîner `_kb_avancer()`, `sleep()` et `_kb_arreter()` — mais comme sa
propre définition est *elle-même* à l'intérieur du marqueur, ne fournir un
substitut que pour `_kb_avancer`/`_kb_arreter` et pas pour `_kb_case` produit
un `NameError` tout aussi sûrement. Les 16 fonctions `_kb_*` du pilote ont
donc chacune leur mock côté navigateur, y compris les fonctions de
composition (`_kb_case`, `_kb_virage`, `_kb_arreter`) et les fonctions
purement calculatoires (`_kb_hsv`) — écrites en réutilisant `sleep()` et les
mocks déjà mockés plus haut (`_grove_obj`, `_NeoPixelMock`, `_grove_teinte`)
plutôt qu'en réinventant un nouveau mécanisme de file d'attente : `_kb_case`
appelle `_kb_avancer()` puis `sleep(600)` puis `_kb_arreter()`, exactement
comme le vrai pilote, et ça suffit — `sleep()` est déjà une fonction mockée
qui empile une action dans la file du simulateur (§14), donc l'ordre et le
délai sont respectés sans rien coder de plus.

## 17. Maqueen Plus V3, télécommande infrarouge et LiDAR

Demandé à partir de captures d'écran d'une palette de blocs MakeCode/Mind+
montrant des variantes « v1/v2/v3 » du Maqueen Plus, une télécommande
infrarouge et un module LiDAR matriciel. Contrairement au Kitrobot v2
(§16), ici une source vérifiable existe et a été retrouvée avant d'écrire
la moindre ligne : `DFRobot/pxt-DFRobot_MaqueenPlus_v20` (fichier
`maqueenPlusV2.ts`) et `DFRobot/pxt-DFRobot_matrixLidarDistanceSensor`
(fichier `matrixLidarDistance.ts`), tous deux sur GitHub.

### Démêler « v1/v2/v3 » avant de coder quoi que ce soit

DFRobot n'a **pas de nommage cohérent** entre ses propres dépôts : le
dépôt le plus proche d'un hypothétique « V1 » (`pxt-DFRobot-Maqueenplus`,
6 capteurs de ligne, servos pilotés en I2C) pointe lui-même vers une page
produit étiquetée « V2 » chez DFRobot. En revanche, une confirmation
externe a été trouvée : « V3 et V2 utilisent la même bibliothèque, toutes
les fonctions V3 sont intégrées à la bibliothèque V2 » — exactement ce que
montre `maqueenPlusV2.ts`, où les fonctions V3 (suiveur de ligne, PID) sont
marquées `group="V3"` mais vivent dans le **même namespace**, avec le
**même registre I2C 0x10** que les fonctions déjà implémentées dans ce
projet (moteurs, 5 capteurs de ligne, phares, ruban NeoPixel — qui
correspondent déjà exactement au protocole V2, vérifié en comparant les
adresses registre par registre). Plutôt que de deviner un « V1 » incertain,
la question a été posée : la réponse retenue est que le jeu de blocs déjà
présent (motorisation, ligne, phares, ruban) *est* la base commune, et que
seules les fonctions **V3 additionnelles** (suiveur de ligne autopilote,
PID, luminosité, vitesse réelle, DEL de carrosserie) sont de nouveaux
blocs — sans sélecteur de version qui changerait le code généré, puisque
rien dans les sources trouvées n'exige de branchement par version une fois
« V1 » écarté.

### Suiveur de ligne et PID (V3) — mêmes fonctions `_mq_ecrire`/`_mq_lire`

```python
def _mq_v3_pid_avancer(sens, distance_cm, attendre):
    distance_cm = int(distance_cm)
    if distance_cm >= 6000:
        distance_cm = 60000     # tel quel dans la source DFRobot (voir plus bas)
    _mq_ecrire(64, 1 if sens == "avant" else 2)
    _mq_ecrire(85, 2)           # vitesse PID interne, fixe (pas un parametre MakeCode)
    _mq_ecrire(65, (distance_cm >> 8) & 0xFF)
    _mq_ecrire(66, distance_cm & 0xFF)
    _mq_ecrire(60, 0x04 | 0x02)
    if attendre:
        while _mq_lire(87, 1)[0] == 1:
            sleep(10)
```

**PIÈGE nº 35 — reproduire une source fidèlement, même une coquille
apparente, plutôt que la « corriger » sans certitude.** La fonction
d'origine (`pidControlDistance`) contient `if (distance >= 6000) distance
= 60000` — un plafond qui semble être une erreur de copier-coller (6000
attendu, 60000 écrit), mais rien ne prouve que ce n'est pas une valeur
volontaire tenant compte d'une unité interne différente. Corriger cette
ligne serait deviner un comportement jamais vérifié sur une vraie carte.
La reproduire telle quelle, en le signalant en commentaire et dans
`ETAT_DU_PROJET.md`, laisse la décision à quelqu'un qui pourra un jour la
vérifier sur le matériel réel — la règle « ne jamais deviner un protocole »
(§9, §15) s'applique aussi à ne pas deviner une correction.

Le sens gauche/droite du bloc « tourner (PID) » est logé dans la même
incertitude : la source ne code que le **signe** de l'angle (`angle >= 0`
→ direction 1, sinon direction 2, source déjà donc muette sur ce que ça
donne physiquement) — traduit en un choix gauche/droite pour coller à
l'interface par blocs, mais non confirmé sur un vrai chassis.

### Le suiveur de ligne autopilote n'a pas d'équivalent dans le simulateur

Contrairement aux blocs moteur ordinaires (qui pilotent directement les
deux roues, modélisées par la cinématique différentielle du §15), le
suiveur de ligne V3 et le codeur de roue sont des fonctionnalités
**embarquées dans le firmware du chassis lui-même** : le micro:bit ne fait
qu'envoyer une commande, toute la boucle de correction se passe sur la
puce du Maqueen. Le modèle cinématique de ce simulateur n'a pas de
représentation de ce firmware distinct — seuls les mouvements PID
(distance/angle) sont donc mimés en pilotant directement les moteurs
simulés déjà existants (`window.simu_maqueenMoteur`), avec un `sleep()`
proportionnel à la distance/l'angle demandé (approximation minutée, sans
odométrie réelle, même limite déjà acceptée pour le Kitrobot v2 au §16).
Les autres blocs V3 (mode aux intersections, vitesse du suiveur, capteurs
de luminosité, vitesse réelle des roues) se contentent d'enregistrer un
état sans effet visuel — les documenter comme tel plutôt que fabriquer une
fausse simulation aurait été trompeur.

### Télécommande infrarouge — protocole public, pilote DFRobot non portable

Le pilote réel de DFRobot pour l'infrarouge (`maqueenIR`/`maqueenIRV2`
dans `pxt-DFRobot-Maqueenplus`) est entièrement **natif** : les fichiers
`.ts` ne déclarent que des signatures vides (`declare namespace maqueenIR
{ function onPressEvent(...): void; }`), l'implémentation réelle vit dans
des fichiers `.cpp` compilés dans le firmware MakeCode — impossible à
réutiliser en MicroPython, exactement comme pour le premier pilote
DHT11/DHT22 (§9). Contrairement au DHT11/22, la solution n'est pas un
firmware assembleur repris d'ailleurs : le protocole NEC lui-même est une
**norme publique** (pas un secret DFRobot), documentée indépendamment de
DFRobot — le décoder n'est donc pas « deviner un protocole », c'est
implémenter une spécification ouverte.

```python
def _ir_lire_trame():
    broche = _ir_broche[0]
    if broche.read_digital() == 1:      # recepteur actif bas : repos = 1
        return None
    temps = []
    niveau = 0
    for _ in range(68):                  # 1 marque + 1 espace d'entete + 32*2 bits + 1 stop
        duree = machine.time_pulse_us(broche, niveau, 15000)
        if duree < 0:
            break
        temps.append(duree)
        niveau = 1 - niveau
    if len(temps) < 68 or not (8000 <= temps[0] <= 10000) or not (4000 <= temps[1] <= 5000):
        return None
    valeur = 0
    for i in range(2, 66, 2):
        valeur >>= 1
        if temps[i + 1] > 1120:          # espace long = bit 1, court = bit 0
            valeur |= 0x80000000
    commande = (valeur >> 16) & 0xFF
    if commande != ((valeur >> 24) & 0xFF) ^ 0xFF:   # verification du complement
        return None
    return commande
```

Même technique que le capteur ultrason (§9) : `machine.time_pulse_us`
mesure une impulsion avec la précision native du firmware, pas un
bit-bang Python microseconde par microseconde (qui, lui, aurait exigé de
l'assembleur — le DHT11/22 l'a appris à ses dépens). Les impulsions NEC
(562,5 µs minimum) sont assez larges pour que la surcharge d'un appel de
fonction MicroPython entre deux mesures reste négligeable — contrairement
au DHT11/22 dont les impulsions de ~50-70 µs ne laissent aucune marge.
Pas de gestion des trames de répétition (bouton maintenu) : simplification
assumée, chaque appui ne déclenche l'évènement qu'une fois.

Deux télécommandes reconnues, deux tables de correspondance code→bouton :
la « noire » (enum `RemoteButton` du dépôt DFRobot, adresse NEC non
documentée donc non vérifiée) et la « grise Car mp3 SE-020401 » (très
répandue, table de 21 boutons relevée sur une source indépendante :
<https://gist.github.com/danyboy666/f342c1cca26e88e0e637ee071698ac56>).

### PIÈGE nº 36 — `globals()` dans un mock ne renvoie PAS l'espace de noms du programme élève

Repose sur le même mécanisme que les blocs « lorsque … » (§6) : un bloc
« lorsque la commande X est reçue » génère `def on_ir_noire_touche1():
...`, et un dispatcher doit retrouver cette fonction par son nom pour
l'appeler. Sur la vraie carte, tout — pilote et programme élève — vit dans
un seul espace de noms, donc `globals()` fonctionne. Mais dans le
simulateur, le programme élève s'exécute via `exec(code, env)` où `env`
est un **dictionnaire séparé** de l'espace de noms du script Brython du
simulateur : une fonction mock définie avec `def _ir_traiter(): ...` au
niveau du module a son `__globals__` figé sur le module où elle est
**définie**, pas sur `env`. Résultat : `"on_ir_noire_touche1" in
globals()` est toujours faux, silencieusement — aucune erreur, l'appel
ne se produit juste jamais.

Ce piège était déjà connu et documenté pour `_radio_traiter` (commentaire
en clair dans `index.html` : « doit chercher les gestionnaires dans env,
là où exec les crée ») — mais pas réappliqué du premier coup en écrivant
`_ir_traiter` par analogie avec le pilote réel plutôt qu'avec le mock déjà
existant. Repéré uniquement en **exécutant** un programme avec un vrai
gestionnaire posé (le mock, testé isolément avec des arguments neutres,
ne révèle rien) : la fonction se déclarait « sans erreur » mais
n'appelait jamais le gestionnaire. Corrigé en déplaçant `_ir_traiter` à
l'intérieur de `lancer_simulation()`, fermeture sur `env`, exactement
comme `_radio_traiter` :

```python
def _ir_traiter():
    if not window.simu_irEnAttente():
        return
    telecommande = str(window.simu_irTelecommande())
    touche = str(window.simu_irToucheAttente())
    _ir_dernier[0] = int(window.simu_irCodeAttente())
    window.simu_irConsommer()
    nom = "on_ir_" + telecommande + "_" + touche
    if nom in env:          # env, jamais globals()
        env[nom]()
```

Règle générale : **tout mock destiné à appeler une fonction définie par
les blocs (pas seulement lire/écrire un état) doit être défini à
l'intérieur de `lancer_simulation()` et fermer sur `env`** — jamais au
niveau module, même si ça semble fonctionner en l'appelant isolément.

### Simuler une télécommande sans vrai signal infrarouge

Le panneau Maqueen Plus expose deux menus déroulants (télécommande,
touche — remplis depuis les mêmes tables `MENU_TOUCHE_NOIRE`/
`MENU_TOUCHE_GRISE` que le générateur, pas dupliqués côté HTML) et un
bouton « Simuler l'appui ». Le pont JS→Python passe par des **fonctions**
qui renvoient un type simple (`window.simu_irEnAttente()` → bool,
`window.simu_irTelecommande()` → str, `window.simu_irCodeAttente()` →
int) plutôt qu'un objet JS lu directement (`window.simu_irCommande.code`)
— ce dernier a été essayé en premier et abandonné : la lecture d'une
propriété d'objet JS imbriquée depuis Brython n'est pas un chemin aussi
éprouvé dans ce projet que l'appel de fonction renvoyant un scalaire,
déjà utilisé par tous les autres mocks (`_mq_distance`, `_grove_teinte`,
etc.) — repris par cohérence avec l'existant plutôt que re-découvert à
la dure une seconde fois.

### LiDAR matriciel (SEN0628) — capteur indépendant, protocole par paquets

Nouvelle catégorie de blocs, pas rattachée au Maqueen (utilisable seule).
Protocole entièrement différent de l'I2C « écrire un registre, lire un
registre » des autres modules : un paquet d'entête fixe, une commande, une
réponse à interroger jusqu'à un octet de statut :

```python
def _lidar_paquet(adresse, commande, donnees=b""):
    longueur = len(donnees) + 1
    entete = bytes([0x55, (longueur >> 8) & 0xFF, longueur & 0xFF, commande])
    i2c.write(adresse, entete + donnees)
    sleep(10)

def _lidar_reponse(adresse, commande):
    debut = running_time()
    while running_time() - debut < 200:
        statut = i2c.read(adresse, 1)[0]
        if statut in (0x53, 0x63):          # succes / echec
            echo = i2c.read(adresse, 1)[0]
            longueur = i2c.read(adresse, 2)
            longueur = longueur[1] << 8 | longueur[0]
            if echo != commande or longueur == 0:
                return b""
            return i2c.read(adresse, longueur)
    return b""
```

Deux modes distincts, à ne pas mélanger : « Matrice 8x8 » (lecture point
par point, x/y de 0 à 7) et « Évitement 4x4 » (une seule acquisition
renvoie direction conseillée, signal d'urgence, distances gauche/avant/
droite déjà calculées par le capteur). Un détail de la source à respecter
sans le « simplifier » : `obstacleSuggestion()` (direction conseillée) et
`getObstacleDistance()` (distance par côté) **n'utilisent pas le même
codage** pour gauche/avant/droite — la première documente 1=gauche/
2=droite/3=avant en commentaire, la seconde utilise un enum `Left=1,
Front=2, Right=3` — une incohérence de la source elle-même, reproduite
avec deux tables séparées plutôt qu'unifiée en une seule qui aurait
introduit une inversion.

Panneau simulateur minimal (trois curseurs gauche/avant/droite, pas de
vraie matrice de distances) : aucune piste ni robot associé à un capteur
générique, contrairement à Maqueen/Kitrobot.

## 18. Maqueen Lite — un second chassis Maqueen, un protocole différent

Demandé simplement comme « la catégorie "maqueen lite" avec les blocs
correspondants » — pas de piste ni de robot animé cette fois, juste des
blocs. Source vérifiée avant d'écrire quoi que ce soit :
`DFRobot/pxt-maqueen` (fichier `maqueen.ts`), confirmé par une recherche
indépendante être le dépôt que charge réellement le produit vendu sous le
nom « Maqueen Lite » (SKU ROB0148) — le nom du dépôt lui-même (« Maqueen »,
sans « Lite ») ne le montrait pas à lui seul, DFRobot ayant renommé sa
gamme sans renommer le dépôt GitHub (même désordre de nommage déjà
rencontré au §17 pour « V1 »).

### Même adresse I2C, protocole différent — pas le même pilote que Maqueen Plus

Le dépôt utilise la même adresse `0x10` et les mêmes registres moteur
(`0x00`/`0x02`) que le Maqueen Plus (§15) — une coïncidence de conception
DFRobot, pas une compatibilité : le reste du protocole diverge complètement
et les deux chassis ne coexistent de toute façon jamais sur la même carte.
Différences qui comptent pour l'implémentation :

- **2 capteurs de ligne, pas 5** : lecture directe de `P13`/`P14`
  (`pins.digitalReadPin`), aucun registre I2C dédié — contrairement aux 5
  capteurs du Maqueen Plus lus via le registre `0x1D`.
- **2 DEL simples marche/arrêt** (`P8`/`P12`, écriture numérique directe),
  pas de ruban NeoPixel RGB.
- **Ultrason à broches fixes** (`P1`/`P2`), aucun choix de broche possible
  contrairement au Maqueen Plus.
- **Événement natif sur les capteurs de ligne** (`ltEvent`, interne à
  `maqueen.ts`) : la source scrute les deux broches en rotation toutes les
  50 ms via un `basic.forever` et déclenche une fonction quand l'état
  correspond — un mécanisme équivalent à la scrutation déjà bâtie pour les
  boutons/broches de ce projet (§6), dont le même principe (une condition
  vérifiée à chaque tour) est repris ici plutôt que réinventé.

```python
def _ml_moteur(cote, vitesse):
    vitesse = max(-255, min(255, int(vitesse)))
    sens = 0 if vitesse >= 0 else 1
    v = abs(vitesse)
    if cote != "droit":
        _ml_ecrire(0x00, sens, v)
    if cote != "gauche":
        _ml_ecrire(0x02, sens, v)
```

### L'événement « lorsque le capteur de ligne… » — pas besoin d'un dispatcher dynamique

Contrairement à la radio ou à l'infrarouge (§17, PIÈGE nº 36 — un
dispatcher qui doit chercher les gestionnaires dans `env`, pas dans
`globals()`), la condition d'un changement de capteur de ligne se calcule
directement à chaque tour (`_ml_ligne('gauche') == 1`), sans file
d'attente ni correspondance dynamique de nom de fonction. Elle rentre donc
dans le mécanisme `GESTIONNAIRES` déjà existant pour les boutons et les
broches (§6) — quatre nouvelles entrées statiques, pas un nouveau
mécanisme :

```js
['def on_ml_ligne_gauche_haut(', "if _ml_ligne('gauche') == 1: on_ml_ligne_gauche_haut()"],
['def on_ml_ligne_gauche_bas(',  "if _ml_ligne('gauche') == 0: on_ml_ligne_gauche_bas()"],
['def on_ml_ligne_droit_haut(',  "if _ml_ligne('droit') == 1: on_ml_ligne_droit_haut()"],
['def on_ml_ligne_droit_bas(',   "if _ml_ligne('droit') == 0: on_ml_ligne_droit_bas()"],
```

**Piège de test rencontré en le vérifiant, déjà noté parmi les faux
négatifs du §21** : `Blockly.Python.workspaceToCode(ws)` appelé
directement, en dehors du pipeline normal, ne produit **pas** l'injection
de scrutation — celle-ci vit dans `genererCodeDepuisBlocs()` (§6), une
enveloppe autour de `workspaceToCode` non exposée sur `window`. Un test qui
appelle `workspaceToCode` à la main pour vérifier la scrutation conclut
donc à tort qu'elle manque ; lire `window.currentPythonCode` (mis à jour
par le vrai pipeline événementiel) donne la bonne réponse.

### Pas de piste ni de robot animé — demande explicite

Contrairement au Maqueen Plus et au Kitrobot v2, l'utilisateur n'a demandé
qu'« une catégorie avec les blocs correspondants », pas un second robot
visible sur une piste. Construire quand même une piste/un sprite aurait été
une extension non demandée (à éviter, comme rappelé dans ce projet à
plusieurs reprises) — d'autant qu'un second robot animé aurait fait
doublon avec celui du Maqueen Plus sans que rien ne distingue lequel des
deux est « actif ». À la place : un petit panneau (un curseur de distance,
deux cases à cocher pour les deux capteurs de ligne) juste assez pour que
les blocs de *lecture* soient testables ; les blocs moteur/DEL/servo ont
des mocks qui ne font rien de visible — mais existent, pour que « Lancer la
simulation » ne plante jamais (même discipline qu'ailleurs dans ce projet :
chaque fonction référencée par un bloc doit avoir un substitut, y compris
quand ce substitut ne fait rien).

## 19. Piste partagée entre les robots — fusionner trois systèmes en un

Demandé explicitement après coup : « je veux que la partie simulation piste
soit la même et disponible pour tous les robots ». Jusque-là, trois
systèmes distincts coexistaient : la piste à tracés multiples du Maqueen
Plus (§15, canevas 300×220), la piste droite dédiée du Kitrobot v2 (§16,
canevas 320×140, choisie **explicitement** pour ne pas réutiliser celle de
Maqueen), et le Maqueen Lite (§18) sans piste du tout. Fusionner ça en
« un seul panneau piste partagé » (option choisie explicitement, plutôt que
« panneaux séparés mais mêmes contrôles ») demande de répondre à trois
questions avant de toucher au code :

### Un seul canevas, quelle taille ?

Garder les 300×220 de Maqueen Plus (le système le plus riche : trois tracés
prédéfinis + éditeur personnalisé) plutôt que les 320×140 de Kitrobot, et
adapter la piste droite de Kitrobot à ce format plutôt que l'inverse — un
4ᵉ tracé dans `PISTES_MAQUEEN`, au même titre que `ovale`/`rectangulaire`/
`huit` :

```js
depart_arrivee: {
    nom: 'Ligne droite (départ/arrivée)',
    depart: { x: 40, y: MQ_HAUTEUR / 2, cap: 0 },
    dessiner(ctx) {
        ctx.beginPath();
        ctx.moveTo(30, MQ_HAUTEUR / 2);
        ctx.lineTo(MQ_LARGEUR - 30, MQ_HAUTEUR / 2);
        ctx.stroke();
    }
}
```

### Un seul robot affiché, lequel ?

Une fonction de détection, appelée partout où « quel robot est actif ? »
se posait auparavant trois fois séparément :

```js
function robotActifDetecte() {
    const blocs = window.workspace.getAllBlocks(false);
    if (blocs.some(b => b.type.startsWith('maqueen_') || b.type === 'lorsque_ir_noire' || b.type === 'lorsque_ir_grise')) return 'maqueen';
    if (blocs.some(b => b.type.startsWith('kitrobot_'))) return 'kitrobot';
    if (blocs.some(b => b.type.startsWith('maqueenlite_') || b.type === 'lorsque_maqueenlite_ligne')) return 'maqueenlite';
    return null;
}
```

Les trois sprites (`#maqueen-robot`, `#kitrobot-robot`, `#maqueenlite-robot`)
vivent tous dans le même conteneur `#maqueen-piste`, superposés ; un seul
`.replie` à la fois selon le retour de cette fonction. `MQ.actif`/`KB.actif`/
`ML.actif` (utilisés par `avancerX()` pour savoir s'il faut bouger) en
découlent directement, plutôt que d'être calculés séparément comme avant —
un seul robot peut être actif à la fois, par construction.

### Une piste, deux conventions de couleur — la couleur suit le ROBOT, pas le tracé

Kitrobot lit un pixel **sombre** comme « sur la ligne » (§16), Maqueen Plus
et Maqueen Lite lisent un pixel **clair** — une convention delibérément
inversée à l'origine pour distinguer les deux panneaux d'un coup d'œil.
Fusionner les canevas sans fusionner les couleurs aurait cassé les
capteurs de l'un des deux robots dès qu'il utiliserait un tracé pensé pour
l'autre. La couleur de la piste devient donc une propriété du **robot
actif**, pas du tracé choisi :

```js
function couleursPisteRobotActif() {
    return robotActifDetecte() === 'kitrobot'
        ? { fond: '#ffffff', trait: '#111111' }
        : { fond: '#3aa66b', trait: '#ffffff' };
}
```

Appelée à chaque redessin (`dessinerPisteMaqueen()`, et l'aperçu de
l'éditeur) : le MÊME tracé « Boucle ovale » se dessine donc en vert/blanc
sous Maqueen Plus et en blanc/noir sous Kitrobot, sans dupliquer la moindre
fonction de dessin. Les seuils de détection eux-mêmes (`pix[0] > 150` pour
Maqueen, `pix[0] < 100` pour Kitrobot) n'ont pas changé — ils restent
corrects du moment que le canevas est dessiné dans les bonnes couleurs
avant qu'un capteur ne le relise, ce que garantit `rafraichirPisteEtRobots()`
(voir plus bas) en appelant systématiquement `dessinerPisteMaqueen()`.

### Maqueen Lite gagne une vraie position, pas seulement des blocs

Le Maqueen Lite (§18) n'avait ni objet d'état, ni fonction de déplacement,
ni sprite : ses deux capteurs de ligne étaient simulés par deux cases à
cocher, sa vitesse moteur ignorée par un mock `pass`. Le rejoindre à la
piste partagée a demandé de lui construire l'équivalent de ce que Maqueen
Plus et Kitrobot avaient déjà : un objet `ML` (x/y/cap/vGauche/vDroite),
`avancerMaqueenLite(ms)` (même cinématique différentielle que les deux
autres), `positionCapteurMaqueenLite`/`dessinerRobotMaqueenLite`, un sprite
CSS simple (gris-violet, pour ne pas le confondre avec les deux autres —
remplacé depuis par un SVG tracé, voir plus bas), et une action de file
`'mlMoteur'` — calquée sur `'kitrobotMoteur'` — pour que `_ml_moteur`
(jusque-là un mock ne faisant rien) pousse vraiment une vitesse dans la
file de simulation. Les deux cases à cocher ont disparu : `_ml_ligne`
relit désormais un pixel du canevas partagé, comme les deux autres robots.

### Le sprite Maqueen Lite, du placeholder CSS au SVG tracé d'après photos réelles

Une fois le sprite CSS gris-violet en place (paragraphe précédent), l'utilisateur
a fourni le lien produit officiel DFRobot du Maqueen Lite (ROB0148-EN) pour
appliquer la même technique déjà validée sur Maqueen Plus (§15/§19 : « essayons
l'option 2 » — SVG tracé plutôt que photo intégrée, pour rester fidèle à la
convention « tout est dessiné, jamais une image externe »). Deux photos haute
résolution du produit (`ROB0148-EN_Main_01.jpg`, vue 3/4 du châssis assemblé,
et `ROB0148-EN_Dim_02.jpg`, vue de dessus de la carte « shield » micro:bit)
ont servi de référence pour dessiner : une coque bleue en pointe vers l'avant,
deux capteurs ultrasons chromés sur une petite sous-carte à la pointe, un
compartiment à piles noir avec contacts métal visibles à l'arrière, et de
grandes roues blanches/argentées à pneu noir — bien plus visibles sur le
vrai robot que sur Maqueen Plus ou Kitrobot. Même découpe que pour Maqueen
Plus : la carrosserie **statique** (coque, roues, pile, sous-carte ultrasons,
vis) devient un `<svg>` inline avec dégradés (`<linearGradient>`/
`<radialGradient>`), tandis que les éléments **dynamiques** pilotés par
`simu_mlDel`/`mettreAJourIndicateursLigneMaqueenLite` (`.mlite-del-g`/`-d`,
`.mlite-avant`) restent des `<div>` frères du `<svg>`, sortis de l'ancien
conteneur `.mlite-corps` (supprimé) sans toucher au JS qui les référence par
`id` — donc aucune modification de `un.js` n'était nécessaire, seulement de
`index.html`.

### `rafraichirPisteEtRobots()` — un seul point d'entrée, pas trois qui se chevauchent

Les trois anciennes fonctions `rafraichirPanneauMaqueen/Kitrobot/MaqueenLite`
faisaient chacune, indépendamment : détecter si LEUR robot a un bloc posé,
(dés)activer LEUR état, (dés)afficher LEURS indicateurs, redessiner LEUR
piste. Une fois la piste partagée, ces trois logiques se recouvrent
forcément (dessiner la piste trois fois de suite avec des couleurs
différentes selon l'ordre d'appel n'a pas de sens). Une seule fonction
regroupe tout, appelée par les trois anciennes (conservées comme de simples
délégations, pour ne pas casser les nombreux points d'appel existants) :

```js
function rafraichirPanneauMaqueen() { rafraichirPisteEtRobots(); }
function rafraichirPanneauKitrobot() { rafraichirPisteEtRobots(); }
function rafraichirPanneauMaqueenLite() { rafraichirPisteEtRobots(); }
```

**PIÈGE nº 38 — un réglage partagé doit redessiner les TROIS robots, pas
celui qu'on avait sous les yeux en l'écrivant.** Le curseur « Échelle du
robot » existait déjà pour Maqueen Plus avant la fusion ; son gestionnaire
`input` n'appelait que `deplacerRobotMaqueenInstantanement()`. Une fois la
piste partagée, glisser ce curseur pendant que Kitrobot ou Maqueen Lite est
affiché ne changeait visiblement rien — trouvé en testant explicitement ce
cas après la fusion (voir §21 : la génération de code seule ne suffit pas,
il faut exécuter les trois chemins). Corrigé en appelant les trois fonctions
de redessin à chaque changement du curseur, comme le fait déjà le 'sleep'
de la file d'attente pour `avancerMaqueen`/`avancerKitrobot`/
`avancerMaqueenLite` — un réglage visuel partagé doit suivre la même règle
qu'un réglage de simulation partagé : toucher les trois, laisser chacun se
protéger via son propre `.actif` ou son propre élément DOM absent.

**PIÈGE nº 39 — une interaction utilisateur (pas seulement un réglage) doit
elle aussi être portée aux trois robots lors d'une fusion, pas seulement
recopiée pour celui qu'on regarde.** Le glisser-déposer du robot sur la
piste (`pointerdown`/`pointermove`/`pointerup`) n'avait jamais été écrit
que pour Maqueen Plus, y compris après la fusion des pistes (§19) : Kitrobot
v2 et Maqueen Lite n'avaient tout simplement aucun écouteur posé sur leur
élément, donc aucun `cursor: grab` ni glissement possible — pas un bug de
logique (rien ne plantait), juste une fonctionnalité jamais dupliquée.
Signalé par l'utilisateur (« je ne peux pas positionner les robots maqueen
lite et kitrobot v2 où je veux sur la piste »), pas trouvé par un test
automatisé, parce que rien dans le code ne suggérait son absence — il n'y a
pas d'erreur à chercher quand un écouteur n'existe simplement pas. Corrigé
en extrayant `positionPisteDepuisEvenement()` (déjà partagée : un seul
canevas, un seul repère de coordonnées) et une fonction générique
`activerGlisserDeposerRobot(el, etat, deplacerInstantanement)` appelée une
fois par robot avec son propre objet d'état (`MQ`/`KB`/`ML`) et sa propre
fonction de redessin instantané — même schéma que PIÈGE nº 38, mais pour un
écouteur d'événement plutôt qu'un simple appel de fonction. Vérifié par
`PointerEvent` synthétiques sur les trois robots (position mise à jour
pendant `pointermove`, conservée après `pointerup`), et non-régression
confirmée sur Maqueen Plus.

**PIÈGE nº 40 — même schéma que nº 38/39, une troisième fois : une
fonctionnalité ajoutée pour Maqueen Plus doit être explicitement reportée
aux deux autres, elle ne l'est jamais automatiquement.** Les indicateurs de
capteurs de ligne directement sur le robot (points verts/gris sur le bord
avant) n'existaient que pour Maqueen Plus (5 capteurs) ; Kitrobot v2 et
Maqueen Lite (2 capteurs chacun) n'avaient que la ligne « Ligne : G/D » sous
la piste. Signalé par l'utilisateur (« l'état des capteurs sur la
simulation ne fonctionne pas pour le maqueen lite ») de façon ambiguë :
avant de coder quoi que ce soit, vérifier par des tests automatisés que
rien n'était réellement cassé (génération de code, déclenchement de
l'événement `lorsque le capteur de ligne...`, DEL qui s'allume, indicateur
sous la piste qui suit la position du robot pendant une vraie exécution
via le bouton « Lancer ») — tout fonctionnait. Une question à choix
multiples (« pas de point sur le robot » / « l'indicateur sous la piste ne
bouge pas » / « l'événement ne se déclenche jamais ») a confirmé la vraie
cause avant d'écrire du code : ne jamais supposer qu'un rapport utilisateur
vague décrit un bug plutôt qu'une fonctionnalité absente, surtout après
avoir soi-même vérifié que le mécanisme sous-jacent marche. Corrigé en
ajoutant deux `<div class="mlite-capteur-sprite">` (gauche en haut, droit
en bas, même schéma de coordonnées `ML_DECALAGE_CAPTEUR` que le calcul de
lecture) et en étendant `mettreAJourIndicateursLigneMaqueenLite()` /
`rafraichirPisteEtRobots()` pour les piloter, au lieu de dupliquer un
mécanisme séparé — exactement le même registre de visibilité
(`capteursLigneUtilisesMaqueenLite`) que la ligne sous la piste.

## 20. Lanceur et empaquetage

`lancer_projet.bat` :

```bat
@echo off
cd /d "%~dp0"
```

**PIÈGE nº 33** — sans `cd /d "%~dp0"`, lancé depuis un raccourci ou une invite
positionnée ailleurs, le serveur sert le mauvais dossier et le navigateur
affiche des 404 sur `un.js`, `deux.js`, `trois.js`. Ouvrir le navigateur
**après** le démarrage du serveur, et ne pas masquer la fenêtre : si le port est
occupé, l'erreur doit rester lisible.

Pour un exécutable PyInstaller : `os.chdir(sys._MEIPASS)` en mode figé,
`os.chdir(os.path.dirname(os.path.abspath(__file__)))` sinon,
`allow_reuse_address = True` sur le `TCPServer`, et message clair si le port
est pris.

**PIÈGE nº 34 — `socketserver.TCPServer` tout court ne suffit pas : il lui
faut `ThreadingMixIn`.** Un navigateur ouvre plusieurs connexions en
parallèle pour charger `trois.js`, `deux.js` et `un.js` en même temps qu'il
sert `index.html`. Un `TCPServer` nu ne traite qu'une connexion à la fois
(gardée ouverte en HTTP/1.1 keep-alive) : la première requête aboutit,
`index.html` s'affiche avec toute sa mise en page statique, mais le serveur
reste bloqué dessus et ne répond jamais aux autres — l'espace de travail
Blockly reste vide indéfiniment, sans la moindre erreur console, puisque
`un.js` n'est simplement jamais exécuté. Pas un cas rare : ça peut arriver
au tout premier chargement, dans n'importe quel navigateur. Corrigé par
`class Serveur(socketserver.ThreadingMixIn, socketserver.TCPServer)` (plus
`daemon_threads = True`, pour que les threads ne bloquent pas l'arrêt du
serveur). Le mono-thread avait été gardé un temps par crainte d'un accès
concurrent au lecteur de carte dans `deux.js` — mais ce lecteur est piloté
côté navigateur (File System Access API), sans aucun rapport avec le
serveur Python, qui ne fait que servir des fichiers statiques en lecture
seule sans état partagé entre requêtes. Rien à protéger, donc rien qui
justifiait de s'en priver.

## 21. Comment vérifier

Aucun test automatisé : la vérification se fait dans le navigateur, en pilotant
l'application depuis la console.

1. **Chaque bloc isolé** : le générer seul et contrôler que le code contient bien
   `from microbit import *` dès qu'il touche à l'API de la carte.
2. **Indentation** : relever les indentations ligne par ligne d'un programme
   mêlant un bloc « lorsque … » et une boucle infinie ; elles doivent être
   cohérentes (0, 0, 2, 0, 2, 2 et non 0, 2, 0, 4, 2).
3. **Chaîne `.hex` complète** : générer, puis **relire** le fichier produit avec
   une instance `MicropythonFsHex` indépendante — `importFilesFromHex` puis `ls()`
   et `read('main.py')` — et vérifier que le contenu est identique au code source.
   Se contenter de l'absence d'erreur ne prouve rien.
4. **Largeur des tiroirs** : mesurer `getToolbox().getFlyout().getWidth()` pour
   chaque catégorie. Viser moins de 400 px.
5. **Simulateur** : compter les LED allumées, lire le texte de l'écran, compter
   les oscillateurs Web Audio créés. Pour le son, un rendu hors ligne
   (`OfflineAudioContext`) permet de mesurer la durée, l'énergie et même la
   hauteur des notes par comptage de passages par zéro. Pour l'écran LCD, relire
   les 32 cellules et les recomposer en deux chaînes de 16 caractères.
6. **Retrait des pilotes** : vérifier qu'après le `re.sub` il ne reste aucun
   `# >>> pilote`, et que le code exécuté ne contient plus la classe du pilote.
7. **Géométrie du texte** : voir le PIÈGE nº 16 — mesurer l'encre réelle par
   `canvas.measureText`, jamais la boîte de ligne.
8. **Panneau administrateur** : piloter par `window.adminTest` plutôt que
   simuler un glisser-déposer ou le raccourci clavier — un clic sur l'icône
   œil, lui, se simule (`element.click()`), mais l'objet de test couvre aussi
   ce qu'un clic ne peut pas déclencher facilement (drag-and-drop, `Ctrl+Alt+
   Maj+A`). Vérifier que `window.workspace.options.languageTree.contents`
   reflète bien chaque changement, pas seulement l'absence d'erreur.
9. **Édition manuelle du code** : un objet de test équivalent
   (`window.editionCodeTest`) pour entrer/sortir du mode et saisir du texte
   sans simuler la frappe clavier. Vérifier que `window.currentPythonCode`
   change en direct, et que les boutons `.hex`/`.py`/« Envoyer sur la carte »
   lisent bien cette même variable au moment du clic (relire leur code, pas
   seulement cliquer et constater l'absence d'erreur).
10. **Décodage d'un capteur sans le capteur en main** (DHT22 par exemple) :
    vérifier la formule par calcul contre un exemple documenté et connu du
    protocole (le datasheet en donne un), pas seulement en relisant le code —
    une erreur de décalage de bits se lit rarement à l'œil dans du code
    correct en apparence.
11. **Un mock qui doit appeler une fonction définie par les blocs** (un
    dispatcher d'évènement, voir PIÈGE nº 36 §17) : ne jamais se contenter
    de vérifier qu'il s'exécute sans erreur avec des arguments neutres —
    poser un vrai gestionnaire (`def on_xxx(): ...`) et vérifier qu'il est
    réellement *appelé*, sans quoi une recherche dans le mauvais espace de
    noms (`globals()` au lieu de `env`) passe inaperçue indéfiniment.
12. **Substituts d'un pilote retiré côté simulateur** (Kitrobot v2, §16) :
    lister toutes les fonctions déclarées à l'intérieur du bloc
    `# >>> pilote … # <<< pilote`, pas seulement celles que les blocs
    appellent directement — une fonction de composition (`_kb_case` par
    exemple) est tout aussi absente du code exécuté que celles qui touchent
    une broche. Exécuter un programme qui appelle chacune au moins une fois
    et vérifier l'absence de `NameError`, pas seulement les quelques-unes
    posées à la main pendant le développement.

### Les faux négatifs, à connaître avant de conclure

Ces sept-là ont fait conclure à tort qu'un correctif ne marchait pas :

- **Mesurer une section masquée.** Les styles calculés d'un élément en
  `display: none` ne veulent rien dire. Rendre la section visible d'abord.
- **Attendre une transition ou une animation** dans un aperçu qui ne compose pas
  d'images : `requestAnimationFrame` et `ResizeObserver` n'y avancent pas.
  Vérifier l'état final, pas l'animation.
- **Vider l'espace de travail avant de mesurer** ce qu'il contenait.
- **Lire la première pastille venue** alors que l'état persiste d'une exécution
  à l'autre : viser l'élément par son nom, pas par son rang.
- **`elementFromPoint` sur un élément en `pointer-events: none`** : il est
  invisible au test de survol par construction. L'ordre de peinture se vérifie
  par la structure, pas par le pointeur.
- **Un espace de travail Blockly qui reste vide, sans erreur.** Si `app.py`
  utilise encore `socketserver.TCPServer` sans `ThreadingMixIn` (voir PIÈGE
  nº 34, §20), les connexions parallèles qu'un navigateur ouvre pour charger
  `trois.js`/`deux.js`/`un.js` se bloquent les unes les autres : `index.html`
  s'affiche, mais `un.js` n'est jamais exécuté, donc rien ne ressemble à une
  erreur — juste un espace de travail qui ne se remplit jamais. Ça ressemble
  à une régression du dernier correctif alors que c'est le serveur qui est
  engorgé. Vérifier `class Serveur` avant de chercher plus loin.
- **Appeler `Blockly.Python.workspaceToCode()` directement pour vérifier la
  scrutation d'un évènement.** Elle n'y est pas : l'injection vit dans
  `genererCodeDepuisBlocs()` (§6), une enveloppe autour de `workspaceToCode`
  non exposée sur `window`. Un test qui contourne le pipeline normal conclut
  à tort qu'un bloc « lorsque… » n'a pas de scrutation alors qu'elle
  fonctionne — lire `window.currentPythonCode` (mis à jour par le vrai
  pipeline événementiel) plutôt que rappeler le générateur à la main.

Règle générale : l'absence d'erreur ne prouve rien. Relire ce qui a été produit
avec un outil indépendant de celui qui l'a produit.

## 22. Bandeau supérieur, console unique, sélecteur de carte (`bandeau.js`)

Principe : **ne modifier aucune fonction existante** quand un module de « colle » suffit. `bandeau.js` est un module ES chargé en dernier
(après `tuto.js`) ; il s'appuie sur les `id` et les classes déjà présents.

Barre `#toolbar` (anthracite → orange de la charte, voir §24) : logo (optionnel), menu Affichage (thème/contraste), menu Fichier,
nom du programme `#nom-fichier`, Défaire/Refaire, Capture, quatre boutons de bascule `#btn-vue-console`, `#btn-vue-simu`,
`#btn-vue-code`, `#btn-vue-ia`, groupe carte (`#port-group`, `#port-select`, `#port-refresh`), `#btn-envoyer` (Téléverser),
`#tb-lancer` (Lancer / Arrêter la simulation), `#copyright-toolbar` (version seule), menu Aide.

**PIÈGE nº 59 — l'état « ouvert / fermé » d'un panneau est la classe `.inactif` du bouton, posée par le code existant.** Les libellés
« Afficher / Masquer … » ne doivent donc pas être codés en dur : un `MutationObserver` sur l'attribut `class` du bouton (`suivreBascule`)
réécrit le libellé. Même source pour le **liseré blanc** sous un bouton activé :
`#btn-vue-console:not(.inactif), … { box-shadow: inset 0 -3px 0 #fff; border-radius: 4px 4px 0 0; }`.

**PIÈGE nº 60 — un message d'état dans la barre la fait passer sur deux rangées.** `#etat` est une bulle `position: absolute; top: 100%`
sous la barre, `pointer-events: none`. Vérifier la barre à 1280, 1366 et 1920 px : une rangée de 44 px à 1920, deux rangées sans bouton
coupé à 1366 (réduire paddings et police à 12 px, champ du nom étroit).

**Console = moniteur série.** Un seul panneau, trois sources de lignes (simulateur, carte, messages d'info). Le bouton Console affiche ou
masque le panneau ; un voyant indique la connexion (`.voyant` : anneau vide = déconnectée, disque vert avec anneau = connectée,
`#btn-console-carte.connecte`) — la **forme** change en plus de la couleur. « Moniteur » n'est qu'un raccourci vers « Connecter ». Après un
téléversement la carte se redémarre : mémoriser le souhait de connexion (`connexionVoulue`) et reconnecter.

**Sélecteur de carte** (`demarrerCartes(serial)`) : lister `navigator.serial.getPorts()`, envelopper `serial.requestPort()` pour mémoriser
le port choisi, filtrer sur le fabricant micro:bit `0x0D28`, ouvrir à 115 200 bauds. Désactivé sans Web Serial (Firefox, Safari).
**PIÈGE nº 61 (test) — un faux port série dont `readable` ne repasse jamais à `null` après `close()` fait tourner la boucle de lecture sans
fin et gèle l'onglet de test.** Le faux port doit annuler `readable` à la fermeture, et la page doit être rechargée avant chaque test.

## 23. Catégories : ordre, regroupements, palette, puces, recherche

Tout passe par `reordonnerToolbox()` (`un.js`), appelée en **premier** par `appliquerPaletteToolbox()` : renomme « Communication » en
**Radio** (sous-menus Groupe, Envoi, Réception, Plus), ajoute **Listes** (`CATEGORIE_LISTES`, blocs de liste natifs), regroupe Maqueen Plus,
Maqueen Lite, Kitrobot v2 et LiDAR sous **Robots** (`NOMS_ROBOTS`), puis trie de façon **stable** selon `ORDRE_CATEGORIES` :
Boucles, Temps, Affichage, Entrées/Sorties, Capteurs, Actionneurs (Audio), Servos, Radio, IA, Grove, Logique, Variables, Maths, Texte,
Fonctions, Listes, Robots. Aucune définition de bloc n'est touchée.

**Palette.** Une table `PALETTE_CATEGORIES` (une couleur hexadécimale par catégorie) fournit la couleur des blocs (enveloppe de `init` qui
appelle `setColour`) ; `BLOCS_PALETTE_SUPPLEMENTAIRES` couvre les blocs absents de la boîte. Exigence de l'utilisateur : **aucune couleur
identique entre deux catégories**. Méthode : échantillonnage du point le plus éloigné dans l'espace CIE-Lab (écart ΔE mini 26,7 sur 17
couleurs), restreint aux teintes assez sombres pour du texte blanc (luminance relative ≤ 0,22), puis attribution dans l'ordre de la colonne
pour que deux catégories voisines soient très différentes. Les sous-catégories héritent de leur parent.

**Pastilles rondes** : `.blocklyToolboxCategory .blocklyTreeRow { border-left-width: 0 !important; padding-left: 33px !important }` (47 px pour
une sous-catégorie) et `::before` rond de 18 px. Blockly pose la couleur de la catégorie en bordure gauche de la ligne ; `colorerPuces()` la
recopie dans `--puce` (aujourd'hui lue dans la table `PASTILLES`, §24) et un `MutationObserver` (`childList`, pas `attributes`, pour ne pas
boucler) recolore quand la boîte est reconstruite.

**Recherche de blocs.** Champ `#recherche-blocs` (`position: sticky; top: 0`) au-dessus de « Boucles ». Index construit au premier usage
sur toute la boîte d'origine (`construireIndex`, parcours récursif des catégories), plus les catégories dynamiques Variables et Fonctions
relues à chaque recherche (`blocsDynamiques`). **PIÈGE nº 62** : le libellé d'un bouton dynamique est une clé de message
(`%{BKY_NEW_VARIABLE}`) — la remplacer par `Blockly.Msg[clé]` avec une expression régulière, sans appeler `Blockly.utils.replaceMessageReferences`.
Des synonymes (`SYNONYMES_DYNAMIQUES`) couvrent les mots qu'on tape mais qui ne figurent pas dans le libellé (« définir », « incrémenter »).
Les résultats s'affichent dans le tiroir (`toolbox.getFlyout().show(...)`) ; gérer `autoClose` pour qu'il reste ouvert après un dépôt.

## 24. Polices et couleurs alignées sur la version Arduino R4 (quatre modes)

Mécanisme de thèmes de cette application : **sombre = défaut (aucun attribut)**, clair = `:root[data-theme="light"]`, contraste élevé =
`:root[data-contrast="high"]`, clair + élevé = les deux. Si un prompt externe parle de `html[data-theme="sombre"]` ou `html.contraste-eleve`,
**traduire les sélecteurs**, ne pas changer le mécanisme.

**PIÈGE nº 63 — la police des blocs se règle dans le thème Blockly, jamais en CSS.** `fontStyle: { family, weight, size }` dans chacun des
quatre thèmes (`sombreMicrobitV2`, `sombreEleveMicrobitV2`, `clairEleveMicrobitV2`, `clairMicrobitV2`, ce dernier dérivé de `Classic` pour
pouvoir y fixer la police) ; Blockly mesure le texte avec cette police pour dimensionner les blocs. Jamais de gras (il déborde des blocs).
Police finale des blocs : `sans-serif`, 11 pt ; interface : `'Segoe UI', Arial, sans-serif` via `--font`, et
`button, input, select, textarea { font-family: inherit }`.

**Fonds par mode** (variables `--ec-*` posées sur `:root`, une règle par mode ; les règles de style ne contiennent plus de couleur) :

| Zone | Clair | Sombre | Élevé clair | Élevé sombre |
| --- | --- | --- | --- | --- |
| Page | #e8e8e8 | #1b1c1f | #e8e8e8 | #000 |
| Colonne de catégories | #2e2e2e | #141517 | #fff + bord droit 3 px #000 | #000 + bord #fff |
| Survol / choisie | #444 / #555 | #2a2c30 / #34363b | #e6e6e6 / #000 | #333 / #fff |
| Zone de programmation | #fff | #1e1f23 | #fff | #000 |
| Grille (20 / 3) | #e8e8e8 | #34373d | #bbb | #444 |
| Tiroir de blocs | #d9d9d9 | #2a2c31 | #fff + contour 3 px #000 | #000 + contour #fff |
| Simulation | #f7f7f7, bord #aaa | #1e1f23, bord #3c3f45 | #fff, bord 3 px #000 | #000, bord #fff |

Fonds de la zone de programmation, de la colonne et du tiroir : **dans `componentStyles` du thème** (`workspaceBackgroundColour`,
`toolboxBackgroundColour`, `toolboxForegroundColour`, `flyoutBackgroundColour`, `scrollbarColour`…) — la valeur `workspaceBackgroundColour` est
aussi relue par la capture PNG (`theme.getComponentStyle`), donc elle doit être juste. Le reste en CSS : grille `pattern line { stroke: … !important }`
(la couleur d'`inject` est un attribut, le CSS l'emporte), `.blocklyFlyoutBackground { fill … !important }`, `.blocklyFlyoutLabelText` en italique.
`Blockly.inject` : `grid: { spacing: 20, length: 3, colour: '#e8e8e8', snap: true }` (l'aimantation est un changement de comportement,
pas seulement d'apparence), `zoom: { controls: true, wheel: true, startScale: 1, minScale: 0.3, maxScale: 3, scaleSpeed: 1.2 }`.

**PIÈGE nº 64 — la ligne de catégorie sélectionnée porte un `background-color` en style inline** (couleur de la catégorie, posé par Blockly) :
le surcharger avec `!important` sur `.blocklyToolboxCategory > .blocklyTreeRow.blocklyTreeSelected`, et le filet gauche de 3 px par
`box-shadow: inset 3px 0 0 var(--ec-cat-lisere)` (la bordure gauche est déjà utilisée pour récupérer la couleur de la pastille).

**PIÈGE nº 65 — la flèche de dépliage d'une catégorie est un sprite noir** (`blocklyTreeIcon` + `sprites.png`) : invisible sur fond noir
(contraste élevé sombre). Remplacer par `background-image: none !important` et `::before { content: '▸' }` / `'▾'` (états
`blocklyTreeIconClosed` / `blocklyTreeIconOpen`), colorés avec le texte. Écrire ces caractères directement, pas en échappement octal.

**Blocs en contraste élevé** : clair = `fill #fff`, `stroke #000`, 3 px, texte noir, champs (`.blocklyFieldRect`) blancs à bord noir,
`.blocklyPathDark/.blocklyPathLight` effacés, flèches des menus en `grayscale` (filtre, pas `fill`) ; sombre = l'inverse. Les rectangles des
menus déroulants ont `fill-opacity: .6` : forcer `fill-opacity: 1 !important`. Boutons du tiroir (« Créer une variable… ») : fond du tiroir,
bord et texte de la couleur des libellés. Les règles du mode clair + élevé doivent être **plus spécifiques** que celles du mode sombre + élevé
(`:root[data-theme="light"][data-contrast="high"] …`).

**Pastilles** : couleurs exactes dans `PASTILLES` (`bandeau.js`), une sous-catégorie prend toujours la couleur de sa catégorie principale
(trouvée par l'ancêtre `.blocklyToolboxCategory` du parent) — Boucles #FD7E14, Temps #15AABF, Affichage #F03E3E, Entrées/Sorties #343A40,
Radio #1864AB, IA #9C6644, Grove #2B8A3E, Logique #FCC419, Variables #E64980, Maths #82C91E, Texte #7048E8, Fonctions #CC5DE8, Listes #A61E4D ;
sans équivalent Arduino (proposées) : Capteurs #D2CC79, Actionneurs (Audio) #622D86, Servos #25F478, Robots #25F4CA. Liseré :
`0 0 0 1.5px rgba(255,255,255,.55)` en normal, 2 px noir (élevé clair) ou blanc (élevé sombre). **Les couleurs des blocs ne changent pas.**

**Bandeau orange** : `--bandeau: #ff5501` (clair), `--bandeau-sombre: #d94700`, noir en contraste élevé, filet bas `--accent-fonce: #b33a00`.

## 25. Exercices pas à pas et mode évaluation (`exercices.js` + `exercices.json`)

Module ES chargé après `bandeau.js`. Il ne modifie ni blocs, ni générateurs, ni simulateur : il **lit** `window.workspace` et ne la modifie que pour
poser l'espace de départ (`au_demarrage` → `boucle_infinie`) ou la solution d'un exercice (`Blockly.serialization.workspaces.load`). Il injecte
son propre CSS (variables du thème : `--fond-code`, `--texte-code`, `--bordure-chrome`, accent orange). Entrées : boutons `#ex-menu-btn`
(« Exercices pas à pas ») et `#ex-eval-menu-btn` (« Mode évaluation ») du menu Aide.

**Les exercices sont des données** (`exercices.json`, chargé par `fetch`, `cache: 'no-store'`) : `titre`, `niveaux[]` (`id`, `titre`,
`notion`, `exercices[]`), chaque exercice = `id` (unique, **ne plus le changer** : la progression s'y rattache), `titre`, `consigne`,
`indices[3]`, `regle`, `solution` facultative (`{ variables?, blocks[] }` au format de sérialisation Blockly), `points` (1 par défaut).

**Règle de validation** (langage déclaratif, évalué sur `workspace.getAllBlocks(false)`) : un *motif* décrit un bloc — `bloc` (type ou liste),
`champ {NOM: valeur}`, `dans [types du bloc racine]`, `ancetre` (type d'un parent), `contient` (motif ou liste, tous requis, cherchés dans
`getDescendants(false)` donc **ombres comprises**), `entrees {ENTREE: nombre}` (lit `NUM` du bloc branché), `leds_min`, `texte_sauf`, `min`.
Combinaisons `tous: [...]` / `ou: [...]`. Exemple : « cœur qui clignote » = icône + `effacer_ecran` dans `boucle_infinie` et au moins deux
`attendre_temps` dans la même boucle.

**PIÈGE nº 66 — `dans` regarde le bloc RACINE, pas le parent.** « Au démarrage » est chaîné à « Répéter indéfiniment » par `next`, donc tout
ce qui est dans la boucle a pour racine `au_demarrage` ; pour exiger « dans la boucle » utiliser `ancetre: "boucle_infinie"`.

**PIÈGE nº 67 — le texte par défaut d'un bloc de la boîte (« Bonjour ! ») est déjà valide.** Un exercice qui demande de le changer
utilise `texte_sauf`. De même, les entrées numériques de la boîte sont des **ombres** `math_number` : lire via `getInputTargetBlock`.

**PIÈGE nº 68 — écrire les solutions JSON à la main produit des accolades déséquilibrées** (une solution sur 16 l'était). Les générer
avec `json.dumps` ou les valider (`json.load`) après chaque modification, puis **tester les 16** : espace vide → règle fausse, solution chargée
→ règle vraie.

**Entraînement** : panneau `#ex-panneau` (déplaçable par l'en-tête, réductible), validation automatique 400 ms après un changement non
visuel (`addChangeListener`, `ev.isUiEvent` ignoré), étoiles : 3 sans indice, 2 avec un ou deux indices, 1 avec le troisième ou la solution
(on garde le meilleur résultat) ; exercice suivant verrouillé tant que le précédent n'est ni fait ni « passé » (case « Accès libre »).
Remplacer le programme en cours demande une confirmation (sauf espace vierge ou session déjà ouverte). **Évaluation** : aucune aide, bouton
Valider, 3 essais (part des points 100 % / 75 % / 50 %), durée maximale facultative, `beforeunload` actif, note sur 20, rapport
(`#ex-voile` plein écran, `@media print` masque le reste de la page), export CSV (séparateur `;`, BOM) et JSON, résultat enregistré.
**PIÈGE nº 69 (test)** — `confirm()` renvoie `false` dans un navigateur piloté : une évaluation lancée par script sur un espace non vierge
ne démarre pas, et la validation qui suit plante sans garde ; vider l'espace d'abord (`reinitialiserEspace`) et garder `validerEval` contre
`session` nul.
Progression : `localStorage['exercices_progression_v1']` = `{ profil, libre, profils: { nom: { faits: { id: { etoiles, indices, solution,
secondes, date, passe? } } } }, evaluations: [...] }`. Un profil par nom d'élève ; export/import JSON (on garde le meilleur résultat par
exercice, les évaluations ne sont ajoutées que si `nom` + `date` sont nouveaux), tableau de classe imprimable et CSV.
Ajouter `exercices.js` **et** `exercices.json` à `app.spec` et au dossier `site_web`.

## 26. Hébergement, exécutables, antivirus

**Site statique** (`site_web`) : aucun serveur Python nécessaire. Fichiers : `index.html`, les sept `.js` (`un`, `deux`, `trois`, `ia`, `tuto`,
`bandeau`, `exercices`), `exercices.json`, `firmware.hex`, `readme.txt`, `lib/` **en entier** (`blockly` + `media`, `brython`, `microbit`, `tm` :
36 fichiers, 15 Mo), `.nojekyll`. Pas : `app.py`, `app.spec`, `version_info.txt`, `lancer_projet.bat`, `dist/`, `build/`, PDF, `.xlsx`, `.md`.
**HTTPS obligatoire** (Web Serial, accès aux fichiers, caméra et micro de l'IA) ; Chrome, Edge ou Opera pour envoyer sur la carte.
**PIÈGE nº 70 — `lib/` oublié** : la page s'affiche sans colonne de catégories ni espace de blocs, console : `404` sur
`lib/blockly/blockly_compressed.js`… et `brython is not defined`. Le glisser-déposer du site GitHub s'arrête à 100 fichiers par envoi :
envoyer `lib/` par lots ou utiliser GitHub Desktop. L'appel `/_vie` (cœur de l'exe qui ferme le serveur quand la dernière page est fermée)
renvoie 404 sur un site statique : sans conséquence. Respecter la casse des noms de fichiers.

**Exécutable** : `python -m PyInstaller app.spec --noconfirm`. `datas` : `index.html`, `un.js`, `deux.js`, `trois.js`, `ia.js`, `tuto.js`,
`ia-son-immediat.js`, `ia-immediat.js`, `bandeau.js`, `exercices.js`, `seances.js`, `exercices.json`, `firmware.hex`, `logo.png`, `readme.txt`, `lib` — **tout nouveau fichier utilisé par la page doit y être
ajouté**. Le numéro de version est à tenir identique à **quatre** endroits : `VERSION` (`app.py`), `version_info.txt` (nombres + chaînes),
`name=` (`app.spec`) et `#copyright-toolbar` (`index.html`). Vérifier l'archive sans lancer l'exe :
`from PyInstaller.archive.readers import CArchiveReader; CArchiveReader(chemin).toc`. Port 8000 : si un autre serveur l'occupe, l'exe risque de ne pas démarrer
ou de servir l'autre application — ne pas le tuer sans l'accord de l'utilisateur.
**Antivirus** : les exes PyInstaller « un seul fichier » sont souvent signalés à tort. Leviers par ordre de coût : `upx=False` dans `app.spec`
(UPX est une cause fréquente), livrer en dossier (`onedir`) zippé, soumettre l'exe comme faux positif à l'éditeur de l'antivirus, enfin
**signer** avec un certificat de signature de code (OV ou EV, ou Azure Trusted Signing ; un certificat auto-signé n'aide que s'il est déployé
sur les postes) avec `signtool`. Les propriétés de l'exe (`CompanyName` dans `version_info.txt`) contiennent encore « RAJ Editions » : à changer
séparément du site.

## 27. IA : apprentissage immédiat, gestes, positions, QR codes (`ia-immediat.js`)

Reprise des points forts de l'IA d'EasyBloc TS (Arduino R4), **réécrits** : seules les bibliothèques libres sont copiées
(`lib/mediapipe` = `@mediapipe/tasks-vision` 0.10.14 + `hand_landmarker.task`, `pose_landmarker_lite.task`,
`mobilenet_v3_small.tflite` ; `lib/zxing/zxing-0.21.3.min.js` ; Apache 2.0). Aucune requête hors de l'application.

- **Noyau partagé** : `ia.js` expose `window.iaNoyau` (`traiterResultat(genre, probas, colonne)`, `liberer`, `envoyer`,
  `ouvrirCamera`/`fermerCamera` avec une *raison*, `dernierEnvoi`, `moteurs`). `ia-immediat.js` envoie en genre `vision`
  (mêmes blocs) et `qr`. Un seul moteur vision à la fois : démarrer l'un arrête l'autre.
- **Empreintes** : images = `ImageEmbedder` (1024 nombres, `l2Normalize`) comparés par produit scalaire ; main = 21 points
  ramenés au poignet, x multiplié par largeur/hauteur, main gauche retournée, divisés par la plus grande distance au poignet
  (63 nombres) ; bras = points 11 à 16 ramenés au milieu des épaules et divisés par leur largeur (12 nombres, sans
  retournement). Squelettes comparés par distance euclidienne. **k plus proches voisins**, K = 5, votes moyennés sur 3 images.
- **Une seule façon de créer des classes d'images** : la colonne Vision ne garde que le chargement d'un modèle Teachable
  Machine ; « Créer un modèle (entraînement) » n'existe plus que pour le son (code vision retiré de `ia.js`). La visite
  guidée IA (`tuto.js`, `ETAPES_IA`) passe par l'apprentissage immédiat (`colImm`) et présente la colonne QR (`colQR`).
- **Renvoi périodique** : le dernier résultat de chaque genre est renvoyé toutes les 500 ms ; le pilote MicroPython note
  `_ia_vu[genre] = running_time()` et remet la classe à vide après 1,5 s sans ligne.
- **Blocs** : `ChampClasseIA` (sous-classe de `FieldDropdown`) propose `window.iaClassesConnues(genre)` + « ✎ autre nom… ».
  QR : `ia_qr_lorsque_lu` (`on_ia_qr_lu`), `ia_qr_visible`, `ia_qr_texte` (`_ia_qr_texte`).
- **Sauvegarde** : JSON `{format: 'apprentissage-ia-microbit', version: 1, type, classes: [{nom, exemples: [base64]}]}` ;
  images quantifiées en octets signés (×127) puis renormalisées, squelettes en Float32. Ajouté à la fin du `.py` en lignes
  `# ` de 100 caractères entre `# >>> apprentissage-ia` et `# <<< apprentissage-ia`, retiré avant la reconstruction en blocs.

- **Sons sans entraînement** (`ia-son-immediat.js`) : micro ramené à 16 kHz, fenêtres de 25 ms tous les 10 ms, 12 MFCC
  (26 filtres de Mel de 64 à 7 600 Hz, coefficient 0 écarté : indépendant du volume) ; un son commence à 14 dB au-dessus
  du bruit de fond (3 fenêtres), finit après 250 ms sous 8 dB ; 50 ms à 1,5 s ; empreinte de 30 instants × 12 ; distance
  DTW (bande de 10). Un son reconnu le reste 1 s (genre `son`). L'entraînement du son (colonne Son) et `lib/tm/base` sont
  retirés : **une seule façon de créer des classes**, l'apprentissage immédiat.
- **Vignettes** : `ex = [{ v, vignette }]` ; photo JPEG 48×36 (objets, en mémoire seulement), squelette redessiné depuis
  l'empreinte (gestes, positions), dessin du timbre (sons). Un clic sur une vignette supprime l'exemple.
- **Reconstruction** : `reconstruireGestionnaire` reconnaît `on_ia_<genre>_<slug>` et `on_ia_qr_lu` (nom de classe
  retrouvé par `iaClassesConnues`) ; `reconstruireExpressionIA` reconnaît `_ia_dernier[…]`, `_ia_proba[…]`,
  `_ia_qr_texte`, `… == "classe"` et `_ia_dernier["qr"] != ""`.

**PIÈGE nº 71 — `.mjs` servi en `text/plain`** : Python 3.8 sous Windows ne connaît pas `.mjs` ; le navigateur refuse alors
d'importer MediaPipe comme module. `app.py` fixe `extensions_map` (`.mjs` → `text/javascript`, `.wasm` → `application/wasm`) ;
`ia-immediat.js` retombe sur `fetch` + `Blob` + `import()` pour un autre serveur.

**PIÈGE nº 72 — menu dynamique et valeur hors menu** : `FieldDropdown.doClassValidation_` refuse toute valeur absente du menu
(un programme ouvert avant le modèle perdrait ses classes) et `doValueUpdate_` cherche le libellé dans le menu **en cache**.
Surcharger les deux : accepter tout texte non vide, et régénérer le menu (`getOptions(false)`) pour le libellé.

**PIÈGE nº 73 — renvoi et oubli** : le gestionnaire `on_ia_…` se déclenche sur un **changement** de classe, donc les renvois ne
le redéclenchent pas. Tester l'oubli (1,5 s) **après** avoir lu les lignes en attente : un programme qui dort plus de 1,5 s
oublierait sinon à tort une classe toujours reconnue.

**PIÈGE nº 74 — annexe du `.py`** : ne jamais la mettre dans le `.hex` (place du système de fichiers comptée). Écrire les espaces
du JSON en `\u0020` : un éditeur qui retire les espaces de fin de ligne abîmerait un nom de classe coupé à cet endroit.

**PIÈGE nº 75 — micro par `ScriptProcessorNode`** : Chrome n'appelle `onaudioprocess` que si le nœud est relié à
`contexte.destination` ; `new AudioContext({ sampleRate: 16000 })` peut être refusé : retomber sur le contexte par défaut
et rééchantillonner soi-même. Le volume ne doit pas changer l'empreinte : écarter le coefficient cepstral 0, ne pas
soustraire la moyenne des autres (un son court et stable perdrait tout son timbre).

**PIÈGE nº 76 — reconstruction des blocs IA** : le texte `_source` d'un `Subscript` sort tronqué (`_ia_dernier["son"`
sans `]`) : reconnaître les expressions IA sur l'arbre, jamais sur ce texte. Sauter `pass` (corps vide) et les appels de
scrutation, sinon ils deviennent des blocs « code ». Lire l'annexe d'apprentissage **avant** la reconstruction, pour
retrouver le vrai nom des classes (accents, majuscules) derrière leur identifiant.

## 28. Grove : potentiomètre et premier lot (bouton, lumière, PIR, buzzer, relais, OLED)

Chaque module passe par une fonction de pilote à son nom (`_grove_potentiometre`, `_grove_bouton`, `_grove_bouton_front`,
`_grove_lumiere`, `_grove_pir`, `_grove_buzzer`, `_grove_buzzer_bip`, `_grove_relais`, `_EcranOLED` / `_grove_oled`) plutôt
que par `read_digital()` / `write_digital()` directs : le simulateur retire les pilotes et injecte ses substituts (index.html)
sans confondre ces modules avec une LED ou un joystick sur la même broche. Entrées : `simu_groveEntree(nom)` lit le panneau ;
sorties : `simu_groveSortie(nom, broche, valeur)` et `simu_oled(...)` passent par la file (rythme du programme).
« lorsque le bouton poussoir est appuyé » : entrées de `GESTIONNAIRES` générées pour chaque broche de `BROCHES_GROVE`.

Deuxième lot : `_BarreLED` / `_grove_barre(donnee, horloge)` (MY9221 : l'horloge **change d'état** à chaque bit,
verrouillage par 4 impulsions sur la donnée), `_CapteurBMP280` (compensation Bosch en flottant), `_CapteurSGP30`
(0x2003 puis 0x2008, réponse après 12 ms), `_HorlogeRTC` (BCD, bit 7 des secondes à 0 sur le DS1307), `_PiloteServos`
(PCA9685, prédiviseur 121 pour 50 Hz, 4096 pas sur 20 ms). Les objets I²C passent par le registre `_grove_obj` ; la
reconstruction reconnaît `_fabrique().methode(...)` (`appelMethodeGrove`).

**PIÈGE nº 77 — guillemet dans un nom de catégorie** : `"Écran OLED 0,96""` casse tout `un.js` (la page reste vide). Utiliser
le signe pouce ″ (U+2033). Vérifier la syntaxe d'un module avec `node --check` sur une copie en `.mjs`.

**PIÈGE nº 78 — MicroPython de la V1** : pas d'affectation par tranche dans un `bytearray`, et `str(pin0)` donne le même texte
pour toutes les broches : écrire octet par octet, et indexer l'état des boutons par `id(broche)`.

## 29. Séances pour groupes d'élèves (`seances.js` + mode séance d'`exercices.js`)

Distribution et ramassage par **fichiers** (ENT, Moodle, dossier partagé) : ni serveur ni compte. `seance-microbit`
(id, titre, classe, mode tp/eval, minutes, groupes [{nom, eleves}], exercices au format d'`exercices.json` plus `depart`)
et `rendu-microbit` (séance, groupe, élèves, exercices avec statut, étoiles, points, `blocs` = `workspaces.save`, `python`,
évaluation). `exercices.js` : `window.exercicesSeance` (`activer`, `quitter`, `active`, `enEvaluation`, `ouvrir`, `evaluer`,
`rendu`) ; en séance, clé de stockage propre (`exercices_progression_v1:seance:<id>`), tous les exercices ouverts,
programme mémorisé 1 s après chaque modification et à chaque changement d'exercice (`espaceDe` le reprend), exercices
**sans règle** : « J'ai terminé » en entraînement, « remis, à corriger » en évaluation (0 point provisoire). Contrôle
automatique d'un exercice créé par l'enseignant : `{ tous: [{ bloc, min }] }` compté sur sa solution, hors blocs neutres.
Ramassage : dédoublonnage par (séance, groupe, élèves) en gardant la date la plus récente ; CSV une ligne par élève.

**PIÈGE nº 79 — séance active et rechargement** : la séance ouverte est rangée dans `seance_active_v1` et réactivée au
chargement, sinon l'élève qui actualise la page perd le fil (son travail, lui, est sous la clé propre à la séance).

## 30. Mode classe (`classe.py`, dossier `blockly_ts_mode_classe`)

Le serveur d'`app.py` écoute déjà sur toutes les interfaces (`("", port)`) : `classe.py` ajoute `/_classe/*` (aiguillage
`classe.traiter(handler, méthode)` dans `do_GET` / `do_POST`). Élèves : `info` (jamais le code), `rejoindre` {code} → séance,
`envoyer` {code, rendu, final, exercice}. Enseignant, **refusé hors de 127.0.0.1 / ::1** : `demarrer` {séance} → code
(5 caractères sans O/0/I/1/L), adresses IPv4 (route par défaut via un `connect` UDP sans envoi), dossier ; `arreter`, `etat`,
`rendu?cle=`, `dossier` (`os.startfile`). Travaux : `Documents\MicrobitBlockly\travaux\<date>_<classe>_<titre>\<groupe>_<élèves>.rendu.json`,
réécrit à chaque envoi. `surveiller` ne coupe pas l'exe tant que `classe.actif()`. Navigateur (`seances.js`) : `SUR_CE_PC`
(hôte localhost, sauf `?eleve`) décide entre l'onglet « Mode classe » et « Rejoindre » ; envoi automatique toutes les 20 s,
`seanceRendre` envoie `final: true` et retombe sur le téléchargement si le réseau échoue ; la séance active garde le code
(`seance_active_v1.classe`) pour reprendre après un rechargement.

**PIÈGE nº 80 — file d'attente du serveur** : `socketserver` n'accepte que 5 connexions en attente (`request_queue_size`) ;
une salle qui charge la page en même temps déborde et Windows coupe des connexions (vu une fois au premier accès réseau :
`ERR_CONNECTION_RESET` sur Blockly et Brython). `request_queue_size = 128`.

**PIÈGE nº 81 — clone sous Windows** : un `git clone` avec `core.autocrlf` à vrai (configuration du système) ressort les
fichiers en CRLF ; avec `core.autocrlf false` ensuite, Git les voit tous modifiés. Régler `core.autocrlf false` puis
`git rm -r --cached . && git reset --hard`.

## 31. Plateforme en ligne (`plateforme/serveur.py`, `plateforme.js`, dossier `blockly_ts_plateforme`)

Serveur indépendant d'`app.py`, Python standard (`http.server` + `ThreadingMixIn`, `sqlite3`, `hashlib.scrypt`, `secrets`),
derrière un relais HTTPS. Tables `enseignants`, `classes`, `eleves` (identifiant généré `<classe>-<prénom>-NN`, prénom,
hash), `seances` (id de la séance, définition `seance-microbit`, ouverte), `travaux` (UNIQUE seance+élève, rendu
`rendu-microbit`, final, maj, rendu_le), `sessions` (jeton → rôle, uid, expiration). API JSON sous `/api/` : `info`, `moi`,
`connexion` (« @ » → enseignant, sinon élève), `deconnexion`, `inscription` (code d'établissement), `mot-de-passe` ; élève :
`mes-seances`, `mon-travail`, `envoyer` (séance ouverte de sa classe, `eleves` remplacé par le prénom du compte, `final` ne
redescend jamais) ; enseignant : `classes`, `eleves/creer|reinitialiser|supprimer`, `seances/publier|etat|supprimer`,
`suivi`, `travail`, `export`, `classes/supprimer`. Tout POST exige `X-Plateforme: 1`. Fichiers servis par liste blanche.
Navigateur : `plateforme.js` ne fait rien si `/api/info` ne répond pas `{plateforme: true}` ; il réutilise `window.seancesApi`
(fenêtres, `construireSeance`, `demarrerSeance(def, eleves, groupe, classe, reprise)`, `cellule`, `csvDepuis`) ;
`classeActive = { plateforme: true, seance, eleve }` fait passer l'envoi automatique par `window.plateforme.envoyer`.

**PIÈGE nº 82 — `X-Forwarded-For`** : le client peut envoyer son propre en-tête, que le relais complète **à la fin**. Lire
la **dernière** adresse (celle vue par le relais), jamais la première : sinon la limite des essais de mot de passe se
contourne en changeant d'adresse inventée à chaque essai.

**PIÈGE nº 83 — signe de vie de l'exe en ligne** : `index.html` appelle `/_vie` toutes les 5 s (arrêt automatique de
l'exe). Sur un serveur partagé par des centaines d'élèves, c'est une requête inutile toutes les 5 s par page : la
plateforme répond 410 et la page arrête ses signes de vie.

**PIÈGE nº 84 — poste partagé** : un cookie avec `Max-Age` survit à la fermeture du navigateur : l'élève suivant serait
connecté sous le nom du précédent. Cookie de session (sans `Max-Age`), expiration serveur de 4 h pour les élèves, et
déconnexion qui efface la séance et les programmes de ce poste (`oublierSeancesDuPoste`).

Fournis le code complet des fichiers du §1 (et les modules des §22 à §31), prêt à être posé dans un dossier.
