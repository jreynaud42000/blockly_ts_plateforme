# Prompt — partie IA de l'éditeur Blockly micro:bit V2

> À donner tel quel à un assistant de programmation, avec le dossier du projet, pour **recréer, maintenir ou faire
> évoluer** la partie intelligence artificielle. Il complète `PROMPT_RECREATION.md` (§27) et `readme.txt` (§32).
> État décrit : octobre 2026, version V2.0E de la copie `easybloc_ts_adacraft_vilain` (après l'ajout des sons
> immédiats, des vignettes et de la reconstruction des blocs IA).

---

## Ta mission

Tu travailles sur la partie IA d'un éditeur de blocs (Blockly 10.4.3) pour la carte **micro:bit V2**. Il est utilisé
en classe de technologie au collège, et tout le texte destiné aux élèves est en **français**. Le programme MicroPython est
généré à partir des blocs, puis il s'exécute soit dans un **simulateur** du navigateur (Brython), soit sur la **vraie
carte**, branchée en USB.

La carte n'a ni caméra ni micro utilisable pour l'IA. **Toute la reconnaissance se fait donc dans le navigateur du
PC.** Seul le résultat (un nom de classe, une confiance ou le texte d'un QR code) est envoyé au programme, sous forme
d'une ligne de texte. Le même programme fonctionne ainsi à l'identique dans le simulateur et sur la carte.

Contraintes à respecter :

1. **Rien ne quitte le PC.** Aucune image ni aucun son n'est envoyé à un serveur et aucune photo d'élève n'est
   enregistrée. Toutes les bibliothèques et tous les modèles sont dans `lib/`, si bien que l'application fonctionne
   **hors connexion**. Seule exception, signalée à l'utilisateur : « Charger » l'adresse d'un modèle Teachable Machine
   télécharge ce modèle depuis les serveurs de Google, sans jamais rien y envoyer.
2. **Ne pas réécrire ce qui marche.** On ajoute de préférence un fichier, en s'appuyant sur les identifiants et les
   fonctions existants (`window.iaNoyau`, `window.workspace`, `window.slugIA`…).
3. **Rien n'est considéré comme fonctionnel sans mesure.** On vérifie dans le navigateur en pilotant l'application
   depuis la console, on ne se contente pas d'une absence d'erreur. On teste avec des images fabriquées par
   programme, avec le simulateur, et on relit les lignes envoyées.
4. **Pour les élèves, une seule façon de faire chaque chose.** Le panneau ne doit pas proposer deux fois la même
   fonction (voir le doublon supprimé, §3).

---

## 1. Fichiers

| Fichier | Rôle |
| --- | --- |
| `ia.js` (~400 lignes, module) | **Noyau** : modèles Teachable Machine (vision et son : **chargement seulement**), seuil, envoi des lignes, renvoi périodique, caméra partagée. Expose `window.iaNoyau` et `window.iaClassesConnues`. |
| `ia-son-immediat.js` (~270 lignes, module, chargé **avant** `ia-immediat.js`) | Micro des **sons immédiats** : découpage en sons, empreinte MFCC, distance DTW, dessin du timbre. Expose `window.iaSonImmediat`. |
| `ia-immediat.js` (~930 lignes, module, chargé **après** `ia.js`) | **Apprentissage immédiat** (MediaPipe ou micro + k plus proches voisins), **vignettes** et **QR codes** (ZXing). Expose `window.iaImmediat`. |
| `un.js` | Pilote MicroPython `ia`, les 7 blocs IA et leurs générateurs, leur **reconstruction** à l'import d'un `.py` (`reconstruireGestionnaire`, `reconstruireExpressionIA`), le champ `ChampClasseIA`, la catégorie « IA » de la boîte à outils, l'aide des blocs (`AIDE_BLOCS`), l'aide du panneau (`TEXTE_AIDE_IA`) et l'annexe d'apprentissage du `.py` (téléchargement et import). |
| `index.html` | Panneau `#ia-panneau` (en bas, bouton « IA » du bandeau), ses 4 colonnes et leurs styles (`.ia-*`). |
| `tuto.js` | Visite guidée IA (`ETAPES_IA`, 15 étapes numérotées, menu Aide). |
| `app.py` | Serveur local : annonce `.mjs` en `text/javascript` et `.wasm` en `application/wasm`. |
| `app.spec` | Exe PyInstaller : `ia.js`, `ia-son-immediat.js`, `ia-immediat.js` et `lib` dans `datas`. |
| `lib/tm/` (1,2 Mo) | TensorFlow.js 1.3.1, `teachablemachine-image`, `speech-commands` (chargement des modèles Teachable Machine ; les réseaux de base `base/` ont été retirés avec l'entraînement). |
| `lib/mediapipe/` (27 Mo) | `@mediapipe/tasks-vision` 0.10.14 (`vision_bundle.mjs`, `wasm/`), `mobilenet_v3_small.tflite`, `hand_landmarker.task`, `pose_landmarker_lite.task`. Licence Apache 2.0. |
| `lib/zxing/` (0,3 Mo) | `zxing-0.21.3.min.js` (lecture et création de codes), licence Apache 2.0. |
| `site_web/` | Copie statique à héberger : **toute modification doit y être recopiée** (avec `lib/`). |

---

## 2. Le panneau IA (4 colonnes, dans cet ordre)

En-tête : **seuil de confiance** (`#ia-seuil`, de 30 à 99, 80 par défaut ; en dessous, aucune classe n'est
retenue), case **« Envoyer à la carte »** (`#ia-vers-carte`), bouton **?** (aide) et bouton **✕**.

1. **⚡ Apprentissage immédiat (caméra ou micro)** — `data-genre="immediat"`, `ia-immediat.js`
   - « Reconnaître : » objets et images / gestes de la main / positions des bras (caméra, genre `vision`) / **sons et
     mots** (micro, genre `son`).
   - « 📷 Caméra » (ou « 🎤 Micro », avec une jauge de volume), puis le bouton **« Maintenir »** de chaque classe : des
     exemples sont ajoutés en rafale (un toutes les 120 ms ; pour les sons, chaque son détecté pendant l'appui).
     **🖼** ajoute des exemples depuis des images (.png, .jpg, .webp ; pas pour les sons).
   - **Vignettes** sous chaque classe : photo (objets, en mémoire seulement), squelette (gestes, positions), dessin du
     timbre (sons). **Un clic sur une vignette supprime cet exemple seul.**
   - Au plus 8 classes et 150 exemples par classe. Renommer une classe met à jour les blocs qui l'utilisent.
   - « ▶ Démarrer » dès que 2 classes ont des exemples. Il n'y a **aucun entraînement** : chaque exemple compte
     aussitôt.
   - Aperçu de la caméra en miroir, avec le **squelette** dessiné pour les gestes et les positions.
   - « 💾 Exporter » et « 📂 Importer » un fichier `.json` ; l'apprentissage est aussi rangé dans le `.py` (§6).
2. **📷 Vision : modèle Teachable Machine (caméra)** — `data-genre="vision"`, `ia.js`
   - **Chargement seulement** : une adresse `https://teachablemachine.withgoogle.com/models/…/`, ou les 3 fichiers
     (`model.json`, `metadata.json`, `weights.bin`) choisis d'un coup, ce qui fonctionne sans Internet.
   - Une note renvoie vers « Apprentissage immédiat » pour créer ses propres classes.
3. **🎤 Son : modèle Teachable Machine (micro)** — `data-genre="son"`, `ia.js`
   - **Chargement seulement**, comme la vision. Une note renvoie vers « Apprentissage immédiat » (sons et mots).
4. **🔳 QR codes et codes-barres (caméra)** — `data-genre="qr"`, `ia-immediat.js`
   - « ▶ Lire les codes » reconnaît QR, EAN-13/8, UPC-A/E, Code 128/39 et Data Matrix.
   - « ✚ Créer un QR code à imprimer » produit une image, à télécharger en PNG.

**Un seul moteur par genre à la fois** : démarrer l'Apprentissage immédiat arrête la colonne Vision (ou Son, pour
les sons), et inversement. La caméra est **partagée** entre les usages grâce à des *raisons* (`reco`, `imm-capture`, `imm-reco`,
`imm-qr`) : elle ne s'éteint que lorsque plus aucune raison ne la demande. L'aperçu `#ia-video` de la colonne Vision
n'apparaît que pour la raison `reco` ; les colonnes Apprentissage immédiat et QR ont leur propre aperçu
(`.ia-imm-cadre`).

---

## 3. Historique des choix (à ne pas défaire sans raison)

- Les points forts de l'IA d'**EasyBloc TS** (version Arduino R4 d'un collègue) ont été **réécrits** ici. Aucun
  code d'EasyBloc n'a été copié ; seules les bibliothèques libres MediaPipe et ZXing ont été reprises.
- **Doublon supprimé** : la colonne Vision avait sa propre création par entraînement, qui faisait la même chose que
  l'Apprentissage immédiat. L'utilisateur a choisi **une seule création d'images**, l'immédiate, car elle est plus
  rapide, gère aussi les gestes et les positions, et s'enregistre dans le `.py`. Le code de capture et
  d'entraînement vision a été **retiré** d'`ia.js`.
- Puis les **sons immédiats** (MFCC + DTW) ont remplacé l'entraînement du son, retiré à son tour avec `lib/tm/base` :
  **toute création de classes passe par l'apprentissage immédiat**, les colonnes Vision et Son ne font que charger.
- Ordre des colonnes demandé par l'utilisateur : Immédiat, Vision, Son, QR.

---

## 4. Protocole navigateur → programme

Une ligne de texte par résultat :

```
IA:<genre>:<classe ou texte>:<confiance 0-100>\n
```

- `genre` vaut `vision`, `son` ou `qr`.
- Pour `vision` et `son`, la classe passe par `slugIA()` : minuscules, sans accents, `[a-z0-9_]` uniquement
  (« Chat noir ! » devient `chat_noir`). Une classe **vide** signifie « rien de reconnu » (confiance sous le seuil,
  ou arrêt).
- Pour `qr`, le texte est envoyé **tel quel**, après passage par `texteCarte()` : sans accents, ASCII imprimable,
  60 caractères au plus. Il peut contenir des « : », que le pilote recolle.
- **Destinations** : le simulateur reçoit toujours la ligne (`window.simu_uartPousser`) ; la vraie carte la reçoit
  si « Envoyer à la carte » est coché (`window.ecrireSerie`, port série de la console, 115 200 bauds).
- **Envoi** : une ligne à chaque **changement** de classe ; une ligne si la confiance varie d'au moins 10 points, au
  plus une fois toutes les 500 ms ; puis **renvoi du dernier résultat toutes les 500 ms**, même inchangé
  (`RAPPEL_MS`). Le renvoi s'arrête avec `liberer(genre)`, qui envoie `IA:<genre>::0`.
- QR : `IA:qr:<texte>:100` tant que le code est vu ; un code qui n'a plus été vu depuis 700 ms donne `IA:qr::0`.

### Pilote MicroPython (`piloteIA()` dans `un.js`, encadré par `# >>> pilote ia` et `# <<< pilote ia`)

- État : `_ia_dernier = {"vision": "", "son": "", "qr": ""}`, ainsi que `_ia_proba`, `_ia_vu` (valeur de
  `running_time()` à la dernière ligne reçue) et `_ia_qr_texte`.
- `_ia_traiter()`, appelée à **chaque tour de boucle** (entrée `'def _ia_traiter('` de `GESTIONNAIRES`), lit `uart`,
  découpe les lignes et met l'état à jour.
- **Changement** de classe : appel de `on_ia_<genre>_<classe>()` si cette fonction existe. Pour `qr`, un nouveau
  texte non vide met `_ia_qr_texte` à jour et appelle `on_ia_qr_lu()`.
- **Oubli** : après avoir lu les lignes en attente, une classe non vide qui n'a pas été revue depuis plus de
  1 500 ms est remise à `""`. Cela couvre le navigateur fermé, le câble débranché ou une ligne perdue.
- Une ligne illisible est ignorée (`try/except`) : elle ne peut pas provoquer de faux déclenchement.

---

## 5. Blocs (catégorie « IA », couleur 330)

| Bloc | Code généré |
| --- | --- |
| `ia_lorsque_reconnu` « lorsque l'IA [vision\|son] reconnaît [classe] » | `def on_ia_<type>_<slug>():` (gestionnaire) |
| `ia_classe_est` « l'IA [type] reconnaît [classe] » (booléen) | `(_ia_dernier["type"] == "slug")` |
| `ia_derniere_classe` (texte) | `_ia_dernier["type"]` |
| `ia_confiance` (nombre, de 0 à 100) | `_ia_proba["type"]` |
| `ia_qr_lorsque_lu` « lorsqu'un code QR est lu » | `def on_ia_qr_lu():` |
| `ia_qr_visible` (booléen) | `(_ia_dernier["qr"] != "")` |
| `ia_qr_texte` (texte) | `_ia_qr_texte` |

**`ChampClasseIA`** est une sous-classe de `Blockly.FieldDropdown`. Son menu est formé de
`window.iaClassesConnues(genre)` (classes du modèle chargé et de l'apprentissage immédiat du même genre), de la
valeur actuelle si elle n'y figure pas, et de « ✎ autre nom… »
(saisie libre via `Blockly.dialog.prompt`). Chaque bloc a son entrée dans `AIDE_BLOCS` (clic droit → « Aide sur ce
bloc »).

**Reconstruction à l'import d'un `.py`** : `on_ia_<genre>_<slug>` redevient « lorsque l'IA reconnaît » (vrai nom de
classe retrouvé dans `iaClassesConnues`, l'annexe d'apprentissage étant relue **avant**), `on_ia_qr_lu` redevient
« lorsqu'un code QR est lu » ; `_ia_dernier[…]`, `_ia_proba[…]`, `_ia_qr_texte`, `… == "classe"` et
`_ia_dernier["qr"] != ""` redeviennent leurs blocs. Les appels de scrutation (`_ia_traiter()`…) et les `pass` sont sautés.

---

## 6. Apprentissage immédiat : la méthode

- **Empreinte** de chaque exemple :
  - **Objets et images** : `ImageEmbedder` (`mobilenet_v3_small.tflite`, `l2Normalize: true`), soit 1 024 nombres de
    longueur 1, comparés par **produit scalaire** (cosinus).
  - **Gestes de la main** : `HandLandmarker` (1 main), soit 21 points. On les ramène au poignet (point 0), on
    multiplie x et z par le rapport largeur / hauteur, on **retourne la main gauche** en droite (signe de x
    inversé), puis on divise par la plus grande distance au poignet : 63 nombres.
  - **Positions des bras** : `PoseLandmarker` (lite, 1 personne), points 11 à 16 (épaules, coudes, poignets). On les
    ramène au milieu des épaules et on divise par la largeur des épaules : 12 nombres, **sans retournement** (bras
    gauche et bras droit levé restent différents). L'image est refusée si l'une des épaules a une visibilité
    inférieure à 0,5.
  - Pour les squelettes, la comparaison se fait par la **distance euclidienne** (au carré).
  - **Sons et mots** (`ia-son-immediat.js`, aucun modèle) : micro ramené à 16 kHz ; toutes les 10 ms, une fenêtre de
    25 ms donne 12 coefficients de timbre (MFCC : 26 filtres de Mel de 64 à 7 600 Hz, coefficient 0 écarté, donc
    indépendant du volume). Un **son** commence quand le volume dépasse le bruit de fond de 14 dB pendant 3 fenêtres et
    finit après 250 ms sous 8 dB ; il dure de 50 ms à 1,5 s (un bruit continu plus long est ignoré). Empreinte :
    30 instants × 12 = 360 nombres, comparés par **alignement dans le temps (DTW**, bande de 10 instants).
- **Classement** : les **K = 5 plus proches voisins** votent, puis on fait la moyenne des votes des **3 dernières
  images** (`LISSAGE`), ce qui donne une confiance moins saccadée. Quand aucune main ou aucun corps n'est détecté,
  toutes les classes valent 0.
- Une image toutes les 150 ms. Le résultat passe par `iaNoyau.traiterResultat('vision', probas, colonne)`, comme
  celui de Teachable Machine. Sons : un vote à chaque son entendu (`traiterResultat('son', …)`), puis classe vide
  1 s plus tard (`DUREE_SON`).
- **Sauvegarde** au format
  `{format: 'apprentissage-ia-microbit', version: 1, type, classes: [{nom, exemples: [base64]}]}` :
  - images **quantifiées** en octets signés (× 127), puis renormalisées à la relecture (environ 1,4 Ko par exemple) ;
  - squelettes et sons en Float32 bruts ;
  - les **vignettes ne sont pas enregistrées** : squelettes et timbres se redessinent depuis les empreintes, les photos
    sont remplacées par ▣.
  - **Dans le `.py` téléchargé** (menu Fichier), on ajoute à la fin des lignes `# ` de 100 caractères entre
    `# >>> apprentissage-ia` et `# <<< apprentissage-ia`. MicroPython les ignore. À l'import du `.py`, elles sont
    relues puis **retirées** avant la reconstruction en blocs. Les espaces du JSON sont écrits `\u0020`.
  - **Jamais dans le `.hex`** : la place y est comptée et la carte n'en a pas besoin.

---

## 7. Interfaces JavaScript (à réutiliser plutôt que dupliquer)

- **`window.iaNoyau`** (`ia.js`) :
  - `traiterResultat(genre, probas, colonne?)` : applique le seuil, met à jour les barres et envoie si besoin ;
  - `liberer(genre)` : arrête le renvoi et envoie `IA:<genre>::0` ;
  - `envoyer(genre, classe, confiance)` ;
  - `ouvrirCamera(raison)` et `fermerCamera(raison)` ;
  - `camera`, `dernierEnvoi` (vision, son, qr), `moteurs`, `arreter(genre)`, `seuil()`.
- **`window.iaClassesConnues(genre)`** renvoie la liste des noms, sans doublon au sens de `slugIA`.
- **`window.iaImmediat`** (`ia-immediat.js`) :
  - `arreter(genre?)` (n'arrête que si l'apprentissage en cours pilote ce genre), `classes(genre?)`, `annexePy()`,
    `lireAnnexePy(texte)` ;
  - `test` (fonctions internes, pour la vérification depuis la console).
- **`window.iaSonImmediat`** (`ia-son-immediat.js`) : `allumer(raison, { surSon, surNiveau })`, `eteindre(raison)`,
  `allume(raison?)`, `distance(a, b)`, `vignette(v)`, et `test` (`recevoir(échantillons)` pour l'alimenter avec un
  signal fabriqué).
- `window.iaTest` (`ia.js`) : accès de vérification au noyau.

---

## 8. Pièges connus

- **nº 71 — `.mjs` servi en `text/plain`** : Python 3.8 sous Windows ne connaît pas ce type et le navigateur refuse
  alors d'importer MediaPipe. `app.py` fixe donc `extensions_map`, et `ia-immediat.js` retombe sur
  `fetch` + `Blob` + `import()` pour un autre serveur.
- **nº 72 — menu déroulant dynamique** : `FieldDropdown.doClassValidation_` refuse toute valeur absente du menu (un
  programme ouvert avant le chargement du modèle perdrait ses classes), et `doValueUpdate_` lit le menu **en
  cache**. Il faut surcharger les deux.
- **nº 73 — renvoi et oubli** : les gestionnaires se déclenchent sur un **changement**, donc les renvois ne les
  relancent pas. L'oubli se teste **après** la lecture des lignes en attente : sinon, un programme qui fait un
  `sleep` de plus de 1,5 s oublierait à tort.
- **nº 74 — annexe du `.py`** : jamais dans le `.hex`. Écrire les espaces en `\u0020`, car un éditeur qui retire les
  espaces en fin de ligne abîmerait un nom de classe coupé à cet endroit.
- **nº 75 — micro par `ScriptProcessorNode`** : Chrome n'appelle `onaudioprocess` que si le nœud est relié à
  `contexte.destination` ; `new AudioContext({ sampleRate: 16000 })` peut être refusé : retomber sur le contexte par
  défaut et rééchantillonner. Écarter le coefficient cepstral 0 (le volume) ; ne pas soustraire la moyenne des autres,
  sinon un son court et stable perd son timbre.
- **nº 76 — reconstruction des blocs IA** : le texte `_source` d'un `Subscript` sort tronqué : reconnaître les
  expressions sur l'arbre. Sauter `pass` et les appels de scrutation. Lire l'annexe **avant** de reconstruire.
- **TensorFlow.js 1.3.1** (Teachable Machine) et **MediaPipe** cohabitent sans conflit. Il ne faut pas « moderniser »
  TF.js : les modèles exportés par Teachable Machine en dépendent.
- **Cache du navigateur** : après une modification, recharger avec Ctrl+Maj+R (le serveur `app.py` envoie déjà des
  en-têtes « no-store »).
- **Caméra et micro** : ils exigent une page en `localhost` ou en HTTPS, ainsi que Chrome ou Edge pour la vraie carte
  (Web Serial).
- **Carte et longues attentes** : si le programme reste longtemps dans un `sleep` alors que plusieurs IA tournent, le
  petit tampon `uart` de la carte peut perdre des lignes. Il n'y a pas de faux déclenchement possible, puisqu'une
  ligne illisible est ignorée.

---

## 9. Comment vérifier (méthode attendue)

Lancer `python app.py` (ou la configuration `.claude/launch.json`), ouvrir <http://localhost:8000>, puis vérifier
depuis la console du navigateur :

1. **Chargement local** : aucune ressource hors de `location.origin` dans
   `performance.getEntriesByType('resource')`.
2. **Images** : fabriquer des images sur un `<canvas>` (par exemple des ronds rouges et des carrés bleus) et les
   ajouter avec `iaImmediat.test.ajouterImages`. Puis vérifier que `test.voter(test.empreinte(...))` classe
   correctement des images **jamais vues**.
3. **Squelettes** : la main en miroir déclarée « gauche » doit donner la même empreinte que la main droite (écart
   nul) ; les bras doivent être invariants à l'échelle et à la position.
4. **Simulateur** : poser « lorsque l'IA vision reconnaît … » avec un bloc « afficher dans la console », lancer la
   simulation, appeler `iaNoyau.traiterResultat(...)`, puis vérifier que le gestionnaire s'exécute **une seule fois**
   malgré les renvois. Couper les envois sans ligne `::0` (`dernierEnvoi.vision.classe = null`) et vérifier que la
   classe est oubliée après 1,5 s.
5. **Sons** : fabriquer des « mots » (sinusoïdes à fréquence montante, descendante…, avec harmoniques et silences)
   et les passer à `iaSonImmediat.test.recevoir()` après `test.reinitialiser()` et `test.micro.rapport = 1` : chaque
   son doit être détecté une fois, un bruit continu de 2 s ignoré, et des mots de volume et de durée différents
   reconnus (`distance`). Puis `iaImmediat.test.reconnaitreSon(v)` doit envoyer `IA:son:<classe>:…`, puis la classe
   vide après 1 s.
6. **Vignettes** : une vignette par exemple ; un clic supprime cet exemple seul (compteur et `etat.classes` à jour).
7. **Reconstruction** : un programme utilisant les 7 blocs IA, généré (`genererCodeTest`) puis reconstruit
   (`reconstructionTest.reconstruireDepuisCode`) : aucun bloc « code », code régénéré identique.
8. **QR** : créer un code avec la colonne QR, le relire avec `test.decoderToile`, et vérifier qu'un texte contenant
   « : » arrive intact dans le programme.
9. **Sauvegarde** : faire un aller-retour `annexePy()` → `lireAnnexePy()`, y compris avec des fins de ligne CRLF et
   des espaces de fin retirés.
10. **Visite guidée** : `tutoTest.aller(i)` pour chaque étape de `ETAPES_IA`, et vérifier que chaque cible existe et
   est visible.
11. Recopier dans `site_web/` et vérifier avec `cmp` que les copies sont identiques.

**Non vérifiable sans matériel**, à signaler comme tel : vraie caméra (gestes et positions réels), vrai micro (le
navigateur intégré de test le refuse), vraie carte
(renvoi, oubli, programme avec de longues attentes), exe reconstruit.

---

## 10. Pistes d'évolution possibles

- **Réglage des seuils du micro** en classe (marges de 14 et 8 dB, durée minimale) si la salle est bruyante, voire un
  curseur de sensibilité dans la colonne.
- **Plusieurs sons de suite** sans silence entre eux (aujourd'hui, il faut 250 ms de calme pour finir un son).
- **Vignettes photo conservées** à la demande de l'enseignant (aujourd'hui volontairement jamais enregistrées).
- Pour chaque évolution : mettre à jour `AIDE_BLOCS`, `TEXTE_AIDE_IA`, la visite guidée, `readme.txt` (§32),
  `PROMPT_RECREATION.md` (§27), `ETAT_DU_PROJET.md`, ce fichier, puis recopier dans `site_web/`.
