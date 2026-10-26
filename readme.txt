=========================================================
  PROJET : PROGRAMMATION MICRO:BIT V2 (INTERFACE BLOCKLY)
=========================================================

Application web locale : on assemble des blocs, on lit la transcription
MicroPython, on essaie le programme dans le simulateur, puis on telecharge
un fichier .hex a glisser sur le lecteur MICROBIT.

---------------------------------------------------------
1. STRUCTURE DU DOSSIER DU PROJET
---------------------------------------------------------
Tous ces fichiers doivent rester ensemble dans le meme dossier :

- index.html        (Interface, simulateur en Brython)
- un.js             (Blocs, generateurs MicroPython, boite a outils)
- deux.js           (Ecriture du programme dans le systeme de fichiers embarque)
- trois.js          (Emballage au format Universal Hex)
- ia.js             (Panneau IA : reconnaissance d'images et de sons, voir §19)
- tuto.js           (Visite guidee de l'application, menu Aide, voir §20)
- firmware.hex      (Image MicroPython officielle de la micro:bit)
- readme.txt        (Ce fichier : affiche dans l'onglet Aide du panneau administrateur, §13)
- lancer_projet.bat (Demarrage du serveur local)
- app.py / app.spec (Version empaquetee en .exe avec PyInstaller)

- lib/              (Bibliotheques embarquees : Blockly, Brython, microbit-fs,
                     microbit-universal-hex, TensorFlow.js et Teachable Machine
                     dans lib/tm ; voir §12 et §19)

Rien a installer et aucune connexion Internet necessaire : depuis la V1.2, toutes
les bibliotheques sont dans lib/ (avant, elles etaient chargees depuis des CDN).

---------------------------------------------------------
2. COMMENT LANCER LE SERVEUR WEB LOCAL
---------------------------------------------------------
Les navigateurs interdisent aux modules JavaScript de lire des fichiers locaux
par un simple double-clic sur index.html. Il faut passer par un serveur web.

Le plus simple : double-cliquer sur lancer_projet.bat. Il se place tout seul
dans le bon dossier, verifie les fichiers, demarre app.py et ouvre le navigateur.

A la main :
   1. Ouvrir un terminal.
   2. cd C:\chemin\vers\votre\dossier      <-- indispensable
   3. python app.py
   4. Laisser la fenetre ouverte, puis ouvrir http://localhost:8000

IMPORTANT : passer par app.py, et non par "python -m http.server". Ce dernier
n'envoie aucun en-tete de cache : le navigateur ressert alors un ancien
index.html ou un.js apres modification, et on regarde la version precedente sans
s'en apercevoir. app.py envoie Cache-Control: no-store, ce qui supprime le
probleme.

Si un.js / deux.js / trois.js apparaissent en erreur 404 dans la console du
navigateur, c'est que le serveur a ete lance depuis un autre dossier.

---------------------------------------------------------
3. UTILISATION
---------------------------------------------------------
- Panneau de gauche : les blocs. Le zoom se commande avec les trois boutons ronds de Blockly
  (recentrer, +, -) dessines dans le coin bas-droit de la zone de blocs, au-dessus de la corbeille
  (leurs icones, gris fonce, sont inversees en clair dans les themes sombres - regle CSS .blocklyZoom /
  .blocklyTrash dans index.html ; ils sont dessines dans le canevas, donc rognes si la fenetre est
  vraiment trop basse), et avec la molette. Le groupe "- 100 % + Ajuster" de la barre d'outils a ete
  retire a la demande de l'utilisateur (le code qui le pilotait reste, inoffensif : il ne trouve plus
  ses boutons ; l'ancienne fonction "Ajuster" = cadrer tous les blocs n'est donc plus accessible). La MOLETTE seule zoome (vers le haut = agrandir,
  vers le bas = reduire, autour du curseur ; Ctrl + molette aussi) ; on fait defiler en
  glissant le fond de l'espace ou avec les barres de defilement. Sur un pave tactile,
  le defilement a deux doigts zoome donc aussi. Le pincement fonctionne sur ecran tactile. Echelle de 0,3 a 3.
  "Ajuster" cadre les blocs presents, ou revient a 100 % si l'espace est vide.

  Les boutons "Code" et "Simulateur" de la barre du haut replient les deux
  panneaux de droite. C'est utile sur les categories aux blocs longs, comme
  Grove : le tiroir de la boite a outils est aussi large que son bloc le plus
  long, et peut ne laisser presque aucune place pour deposer les blocs. Replier
  un panneau rend cette largeur au canevas ; le zoom, lui, n'agit que sur les
  blocs deja poses, pas sur le tiroir.

  Bouton lune/soleil (a cote de "Simulateur") : bascule entre theme sombre
  (par defaut) et theme clair - barre d'outils, panneaux lateraux, panneau de
  code et panneau administrateur. Choix mémorisé d'une session a l'autre. Les
  couleurs "d'appareil" (sprites de robots, carte micro:bit, DEL) ne changent
  pas avec le theme : elles representent quelque chose de reel, comme les
  couleurs des boutons d'action.

  Bouton contraste (◐, juste a cote) : contraste normal ou eleve, independant
  du theme clair/sombre - les deux se combinent (sombre eleve = fond noir pur
  et texte blanc, clair eleve = fond blanc pur et texte noir, bordures plus
  epaisses). En contraste eleve, les blocs eux-memes passent aussi en noir a
  simple contour blanc, plutot que remplis de la couleur de leur categorie.
  Egalement memorise d'une session a l'autre.
- Panneau du milieu : le code MicroPython correspondant, mis a jour en direct.

  Les pilotes des modules Grove et des servomoteurs y sont REPLIES derriere une
  ligne du genre "pilote lcd1602 - 39 lignes", depliable d'un clic. Sur un
  programme LCD, cela ramene la transcription de 1470 a 144 caracteres : l'eleve
  voit son programme, pas la plomberie. Ce qui est deplie le reste quand on
  modifie les blocs.

  Le repli ne concerne QUE l'affichage : le .hex et le .py contiennent toujours
  les pilotes en entier. C'est la difference avec Vittascience, qui ecrit ses
  pilotes dans des modules separes sur la carte (from lcd_i2c import LCD1602) —
  leur transcription est courte parce que le pilote est ailleurs, pas parce
  qu'il est plus petit. Notre choix garde un main.py autonome, donc un .py
  telechargeable qui fonctionne seul.
- Panneau de droite : le simulateur. Les boutons A, B, le logo et les broches
  sont cliquables ; "Lancer la simulation" enchaine des passages de 5 tours de
  boucle en continu (comme la vraie carte, qui ne s'arrete jamais toute
  seule), jusqu'a "Reinitialiser la simulation" ou un nouveau "Lancer".
  La carte s'adapte a la largeur de la colonne : elle retrecit quand la fenetre
  est etroite, grandit quand elle est large, et reste dessinee a 75 % de la
  place disponible pour laisser respirer les sections placees au-dessous.
  Les proportions sont conservees et les zones cliquables suivent.

  A noter : replier le panneau du code n'agrandit PAS la carte. Les deux
  panneaux de droite ont chacun une largeur fixe de 24 % ; la place liberee va
  a la zone de blocs, ce qui est bien le but recherche. Seule la taille de la
  fenetre change l'echelle de la carte.
  "Secouer la carte" declenche le geste et lance la simulation dans la foulee.
  Comme sur la carte, was_gesture("shake") ne repond vrai qu'une seule fois par
  secousse, tandis que is_gesture("shake") reste vrai pendant l'execution.

  Le son est audible : les blocs [Music] et [Audio] sont joues par le navigateur
  en onde carree, timbre proche du buzzer de la carte, et [Speech] passe par la
  synthese vocale du systeme. Les melodies de music suivent le decoupage
  officiel (1 tic = 125 ms) ; les sons de audio sont des approximations, la
  vraie carte lisant des echantillons. Relancer la simulation coupe le son en
  cours. Si rien ne sort, verifier que l'onglet n'est pas muet : le navigateur
  n'autorise le son qu'apres un premier clic dans la page.

  "Reinitialiser la simulation" remet tout a zero : file d'attente videe, son et
  parole coupes, LED eteintes, ecran de texte efface, boutons, logo, broches et
  geste relaches. Rien de l'execution interrompue ne peut reprendre la main.
  Le bloc "[Micro:bit] reinitialiser la carte" produit reset(), qui declenche la
  meme remise a zero pendant l'execution : l'ecran s'eteint et la suite du
  programme n'est pas jouee, comme lors d'un redemarrage de la carte.
- Bouton engrenage : ordre des categories. On y fait glisser les categories pour
  les reordonner ; le tiroir se reconstruit aussitot. "Ordre par defaut" retablit
  l'ordre d'origine. L'ordre choisi est conserve d'une session a l'autre, dans le
  navigateur (localStorage) : il suit le poste, pas le projet. Une categorie
  ajoutee plus tard a l'application reprend sa place a la fin de la liste plutot
  que de disparaitre.
- Bouton .hex : le programme pret a copier sur la carte.
- Bouton .py  : le seul script Python, pour l'editeur officiel ou un cours.
- Bouton "Envoyer sur la carte" : ecrit directement le .hex sur le lecteur
  MICROBIT, ce qui revient exactement a un glisser-deposer.

  Au premier envoi, le navigateur demande de designer le lecteur : choisir le
  volume MICROBIT. L'application verifie qu'il porte bien DETAILS.TXT ou
  MICROBIT.HTM et refuse tout autre dossier. Le choix est ensuite conserve pour
  la session.

  Apres un transfert, la carte se reinitialise et son lecteur se demonte puis se
  remonte : le lecteur designe n'est alors plus valide. Le message invite a
  recliquer pour le redesigner. C'est normal, pas une panne.

  Cette fonction demande Chrome ou Edge. Firefox et Safari n'ont pas l'API
  d'acces aux fichiers : le bouton y est desactive, avec l'explication en
  infobulle. Le bouton .hex reste disponible partout.

  A noter : le lecteur MICROBIT n'accepte QUE des .hex. Y deposer un .py ne fait
  rien, c'est pourquoi ce bouton envoie le .hex et non le script.

En cas de probleme, le message exact s'affiche en haut a droite de la barre.
Le detail complet est dans la console du navigateur (touche F12).

---------------------------------------------------------
4. LE .HEX PRODUIT N'EST PAS IMPORTABLE DANS MAKECODE
---------------------------------------------------------
C'est normal, les deux formats n'ont rien de commun.

Un .hex MakeCode contient du code ARM compile depuis TypeScript, plus le projet
lui-meme compresse en LZMA derriere un en-tete JSON du genre :
  {"compression":"LZMA", ..., "pxtTarget":"microbit"}
C'est cet en-tete que MakeCode relit pour reconstruire les blocs.

Le .hex produit ici est une image MicroPython, avec le programme ecrit en clair
sous main.py dans le systeme de fichiers embarque. Il n'a pas d'en-tete PXT :
MakeCode ne le reconnait pas. L'inverse est vrai aussi, un .hex MakeCode n'a pas
de main.py.

Ce qui fonctionne :
- Menu "Fichier" > "Nouveau projet" : efface les blocs actuels et repart de
  "Au demarrage" + "Repeter indefiniment", apres confirmation (rien n'est
  jamais sauvegarde automatiquement, telechargez le programme actuel avant
  si besoin).
- Fermer l'onglet, recharger la page (F5) ou naviguer ailleurs declenche
  la confirmation de fermeture du navigateur, pour la meme raison (rien
  n'est sauvegarde automatiquement). Le texte exact de cette confirmation
  est impose par le navigateur, pas par l'appli.
- Sur la carte : glisser le .hex sur le lecteur MICROBIT. C'est l'essentiel.
- Pour rouvrir un programme : menu "Fichier" > "Importer un fichier .hex" (ou
  ".py"). Meme bibliotheque microbit-fs que pour l'ecriture, utilisee cette
  fois pour relire la zone systeme de fichiers du .hex et en ressortir
  main.py. https://python.microbit.org fait la meme chose (et fonctionne
  donc aussi), mais n'est plus necessaire.

  Depuis peu, un fichier .hex ou .py EXPORTE PAR CETTE APPLI (il porte une
  signature invisible en premiere ligne) est reconstruit en blocs plutot que
  de basculer directement en edition manuelle. Tout ce que l'appli sait
  reconnaitre redevient un vrai bloc ; ce qu'elle ne reconnait pas encore
  redevient un bloc gris "code" qui garde le texte Python d'origine tel
  quel (rien n'est jamais perdu, juste pas encore transforme en bloc) - sauf
  le pur passe-partout (les lignes "import ..." en tete de fichier), reinjecte
  tout seul par l'appli des qu'un bloc en a besoin et donc simplement omis,
  pas affiche comme un bloc "code" de plus. Un fichier qui ne vient pas de
  cette appli (telecharge ailleurs, ou tape a la main) n'a pas cette
  signature et bascule en edition manuelle comme avant - Blockly ne sait pas
  transformer du Python quelconque en blocs, seul du Python que cette appli
  a elle-meme produit peut etre reconstruit avec confiance.
- Le bouton "Telecharger le script .py" donne le fichier directement ouvrable
  dans l'editeur Python officiel ou dans Mu.
- Bouton "Capture d'ecran des blocs (.png)", dans la barre d'outils entre
  "Fichier" et "Envoyer sur la carte" : telecharge une image PNG de tous les
  blocs poses, telle qu'affiches a l'ecran a l'instant du clic (couleurs et
  texte fideles au theme clair/sombre et au contraste normal/eleve en cours -
  voir section theme plus haut).
- Boutons "Annuler"/"Refaire", a droite de "Envoyer sur la carte" : annulent
  ou refont la derniere action sur les blocs (equivalent des raccourcis
  Ctrl+Z / Ctrl+Maj+Z, deja actifs par defaut). Grises tant qu'il n'y a rien
  a annuler ou a refaire.
- Quand le bouton "Code" est desactive (transcription masquee), une poignee
  apparait entre la zone de blocs et le simulateur : glisser vers la gauche
  agrandit le simulateur, vers la droite le reduit. La carte micro:bit, les
  boutons et les panneaux (Peripheriques, Piste, LiDAR) gardent toujours la
  meme taille : agrandir le panneau les reorganise plutot que de les etirer
  - la carte et les 3 boutons se placent cote a cote si la largeur le permet,
  et les panneaux peuvent se ranger a deux par ligne.
- La colonne de categories (Temps, Affichage, Capteurs...) se masque le temps
  de glisser un bloc - qu'il vienne d'etre pris dans le tiroir ou qu'il soit
  deja pose sur l'espace de travail - et reapparait des que le bloc est
  lache, pour laisser toute la place a la zone de blocs pendant le geste.

Attention : la "Python" de MakeCode n'est pas MicroPython mais une variante de
TypeScript a syntaxe Python. Le .py n'y est pas exploitable non plus.

---------------------------------------------------------
5. LES SERVOMOTEURS
---------------------------------------------------------
Categorie "Servos", sur les broches P0, P1 et P2 comme dans MakeCode.

Conventions reprises de MakeCode (pxt-common-packages, libs/servo) :
- angle de 0 a 180 degres, correspondant a une impulsion de 500 a 2500 us
  dans une periode de 20 ms (50 Hz) ;
- l'intervalle borne l'angle. Le mini est ramene entre 0 et 90, le maxi entre
  90 et 180 ;
- la rotation continue transpose une vitesse de -100 a 100 % sur l'intervalle ;
- avec "arret au neutre" actif, une vitesse ramenant au neutre arrete le
  servomoteur au lieu de le maintenir. MakeCode calcule ce neutre (maxi - mini)/2,
  formule reprise telle quelle : avec l'intervalle 0-180 par defaut cela donne
  bien 90, mais avec un intervalle decale le resultat surprend ;
- "arreter" cesse d'envoyer des impulsions : le servomoteur reste ou il est ;
- la largeur d'impulsion est bornee entre 500 et 2500 us, 1500 us etant le centre.

Le simulateur dessine un cadran par broche utilisee, dans la section
"Servomoteurs" du panneau de droite :

- servo positionnel : le bras pivote jusqu'a l'angle demande, avec une
  transition. Le bras pointe vers le haut a 90 degres, a gauche a 0, a droite
  a 180 ;
- rotation continue : le bras tourne sans fin. Deux secondes par tour a 100 %,
  proportionnellement plus lent en dessous, et dans l'autre sens si la vitesse
  est negative. Une vitesse nulle immobilise le bras ;
- arret : le cadran passe en gris et le bras reste ou il est ;
- largeur d'impulsion : le bras se place a l'angle correspondant, 500 us
  valant 0 degre et 2500 us valant 180.

---------------------------------------------------------
6. CARTE D'EXTENSION BITMAKER V2
---------------------------------------------------------
La BitMaker V2 (Seeed, ref 114992653) est un simple repartiteur : elle amene des
broches de la micro:bit sur six connecteurs Grove. Aucun bloc special n'est
necessaire, il suffit de choisir la broche correspondant au port utilise.

Correspondance des six ports Grove :

   Port          Broches         Modules a y brancher
   ------------  --------------  ----------------------------------------
   1             P0 / P1         joystick (deux axes analogiques)
   2             P1 / P2         afficheur 4 digits (CLK / DIO)
   3             P2 / P12        ultrason, ruban RGB, servomoteur
   4             P8 / P14        ruban RGB, ultrason
   5             P15 / P16       usage general
   6             I2C             AHT20/DHT20, LCD 16x2, VEML6040, DRV8830,
                                 SCD30, SCD41, capteur de gestes PAJ7620

Le premier fil d'un connecteur Grove correspond a la premiere broche indiquee.
Pour le joystick sur le port 1 : X sur P0, Y sur P1 — exactement ce que suppose
le simulateur par defaut.

Tous les modules I2C partagent le meme port : ils peuvent cohabiter sur un
concentrateur, leurs adresses etant differentes (0x38, 0x3E, 0x10, 0x65, 0x61,
0x62, 0x73).

Autres connexions de la carte : pastilles P0, P1, P2, 3V3 et GND compatibles
bananes et pinces crocodiles, alimentation USB micro 5 V, batterie LiPo sur
connecteur JST, selecteur de niveau logique 3,3 V ou 5 V, protection contre les
surintensites a 1,5 A.

Deux points a savoir :
- P13 figure dans les menus de broches de l'application mais n'est PAS sorti sur
  la BitMaker V2. Les huit autres choix correspondent bien a des ports.
- La carte porte quatre LED RGB adressables. La broche qui les commande n'est
  pas indiquee dans la documentation que j'ai pu consulter. Pour la trouver,
  poser "definir le ruban RGB sur <broche> avec 4 LED" puis "colorer tout le
  ruban", et essayer les broches candidates.

---------------------------------------------------------
7. LES MODULES GROVE
---------------------------------------------------------
La categorie "Grove" se deplie en dix sous-menus, un par module. Ses blocs
tenaient auparavant dans un seul tiroir de plus de deux ecrans de haut, ou les
derniers etaient introuvables en pratique.

Elle couvre douze modules Seeed :

- LED simple sur une broche. Deux blocs : "controler la LED a HAUT/BAS" ecrit
  tout ou rien (write_digital), "regler la luminosite a 0-1023" module la
  broche (write_analog). C'est le seul module SANS pilote : une LED se commande
  directement par la broche, et le code produit est celui qu'on ecrirait a la
  main. La valeur est bornee a 0-1023 dans le code genere, car write_analog
  leve une exception hors de cette plage et arreterait le programme sur la
  carte, sans rien afficher.
  A savoir : c'est le tiroir le plus large de l'application (452 px). Replier
  le panneau du code rend cette place a la zone de blocs.
- Ruban RGB WS2813 : s'appuie sur le module neopixel, integre au firmware.
  Le module n'a pas de reglage de luminosite : le bloc "luminosite" attenue
  les couleurs avant envoi.
- Afficheur 4 digits (TM1637), protocole 2 fils, CLK et DIO au choix.
  Le simulateur le dessine en vrais sept segments : il n'affiche pas un texte
  mais allume les segments d'apres le motif exact que le pilote envoie a la
  puce. Aspect proche du module du commerce : boitier noir a bord arrondi,
  chiffres cyan penches de 8 degres, halo lumineux sur les segments allumes.
  Les segments eteints restent faiblement visibles, comme sur le module.
  Les deux points sont entre le 2e et le 3e chiffre, et la luminosite 0 a 7
  agit sur l'intensite. Consequence a connaitre : "afficher le nombre 92"
  montre 0092, et -5 montre -005, parce que le pilote remplit les quatre
  chiffres. C'est bien ce que ferait la carte.
- Ultrason : un seul fil, declenchement puis mesure de l'echo.
- Joystick : deux axes analogiques. L'appui sur le manche tire l'axe X presque
  a zero, c'est ce que teste le bloc "bouton du joystick".
- Capteur de gestes PAJ7620 en I2C (adresse 0x73). Table d'initialisation reprise
  de la bibliotheque Seeed Gesture_PAJ7620.
- Temperature & humidite : quatre jeux de blocs dans le meme sous-menu.
  - AHT20 / DHT20 (0x38, I2C) : meme puce, un seul jeu de blocs. Chaque
    mesure est controlee par son CRC ; -1 est renvoye si elle est fausse.
    Fiable sur V1 et V2.
  - DHT11 et DHT22 (protocole 1 fil) : voir l'encadre juste apres cette
    liste, ce sont les deux seuls blocs Grove qui NE fonctionnent QUE sur le
    V1.
- Ecran LCD 16x2 v1, puce JHD1802 (0x3E) : texte a une position, effacer,
  allumer et eteindre l'affichage.
- Capteur de couleur VEML6040 (0x10) : canaux rouge, vert, bleu et blanc, en
  valeur brute sur 16 bits.
- Pilote moteur DRV8830 (canal 1 : 0x65, canal 2 : 0x60) : vitesse de -63 a 63,
  arret, frein, lecture et effacement du defaut.
- CO2 SCD30 (0x61) et SCD41 (0x62) : CO2, temperature et humidite. Le SCD30 rend
  des flottants au format IEEE, le SCD41 un entier pour le CO2.

Adresses, trames et formules reprises des bibliotheques Seeed pxt-grove
(sensors/AHT20.ts, blocks/GroveLCD1602v1.ts, sensors/VEML6040.ts,
sensors/DRV8830.ts, sensors/SCD30.ts, sensors/SCD41.ts).

DHT11 / DHT22, visibles comme les autres blocs (pas masques) : protocole 1 fil
aux impulsions de quelques dizaines de microsecondes, qu'une boucle MicroPython
interpretee ne peut pas mesurer, d'ou un pilote commun en assembleur ARM Thumb
(repris de rhubarbdog/microbit-dht11, MIT) ; seul le decodage des 5 octets
recus differe entre les deux capteurs. Ce code ne vaut que pour le V1 (16 MHz) :
sur le V2 (64 MHz), il echantillonne trop vite. Sur V2, une autre lecture prend
donc le relais (oct. 2026, EXPERIMENTALE) : machine.time_pulse_us mesure la
duree de chaque impulsion haute (bit 0 ~27 us, bit 1 ~70 us), sans assembleur ;
la somme de controle ecarte une lecture fausse et la mesure est tentee 3 fois.
En cas d'echec, temperature() et humidite() renvoient -1, jamais une valeur
fausse. A valider sur de vraies cartes : branchement sur P0, P1 ou P2, module
Grove (resistance de tirage incluse) ou resistance de 10 kOhm vers 3,3 V,
1 s (DHT11) ou 2 s (DHT22) au moins entre deux mesures. L'AHT20/DHT20 (I2C)
reste le choix le plus sur sur V2 — le tooltip de chaque bloc le rappelle.

Ne sont PAS fournis, et pourquoi :
- Vision AI V2 : pile SSCMA complete (JSON transporte par blocs sur I2C), hors
  de portee d'un pilote embarque dans le programme genere.
- UartWiFi : faisable, mais initialiser l'UART sur des broches externes coupe la
  liaison serie USB, et le dialogue en commandes AT demande des temporisations a
  regler avec le module en main.

Les blocs "definir ..." et "initialiser ..." sont FACULTATIFS. Chaque module est
cree tout seul a sa premiere utilisation, avec ces reglages par defaut :

- Ruban RGB      : broche P1, 16 LED
- Afficheur 4 digits : CLK sur P0, DIO sur P1
- Les modules I2C n'ont rien a regler (adresse fixe)

Le bloc "definir ..." ne sert donc qu'a choisir d'autres broches ou un autre
nombre de LED. Le poser en tete du programme si besoin ; sans lui, rien ne
casse.

Les pilotes de ces modules ne sont pas dans le firmware : ils sont ecrits dans
le programme genere, encadres par les marqueurs "# >>> pilote grove" et
"# <<< pilote grove". Le simulateur repere ces marqueurs, retire le pilote et le
remplace par ses propres objets - sur la carte on pilote des broches, dans le
navigateur on dessine. Ne pas modifier ces marqueurs.

Cote simulateur, le panneau "Peripheriques Grove" affiche le ruban et
l'afficheur, et fournit les entrees : curseur de distance, deux curseurs pour le
joystick avec sa case "bouton enfonce", et un menu de gestes avec son bouton
"Declencher". Comme le capteur reel, le geste est consomme a la lecture.
S'y ajoutent l'ecran LCD 16x2, l'etat des deux canaux moteur, trois curseurs
(temperature, humidite, CO2) et un selecteur de couleur pour le VEML6040.

La section "LED sur broche" montre une pastille par broche effectivement
pilotee, avec la valeur ecrite. Rien n'est affiche tant que le programme n'a
rien ecrit : on ne sait pas d'avance ou la LED est cablee. L'eclat suit la
racine carree du rapport cyclique, ce qui rapproche l'affichage de ce que voit
l'oeil. A noter : toute ecriture sur une broche y figure, servomoteur compris —
c'est ce qui se passerait avec une LED reellement cablee sur cette broche.

L'ecran LCD est dessine comme le vrai module 1602 : cadre noir, retro-eclairage
bleu, caracteres clairs. Chaque caractere occupe sa propre cellule de 5x8 points
(10 x 16 px), et une trame sombre au pas du point est posee par-dessus le texte
pour donner l'aspect matriciel. Le texte s'aligne donc en colonnes, exactement
comme sur le composant : ecrire a la colonne 4 laisse quatre cellules vides,
visibles. Eteindre le retro-eclairage fait virer l'ecran au gris-vert et laisse
le texte faiblement lisible, comme sur le vrai module.

Ce panneau n'affiche que les modules effectivement utilises : chaque section
apparait des qu'un bloc du module correspondant est pose dans le programme, et
disparait quand on le retire. Sans aucun bloc Grove, le panneau entier est
masque. Les curseurs temperature et humidite servent aussi bien a l'AHT20/DHT20
qu'aux SCD30 et SCD41, qui mesurent les trois grandeurs.

---------------------------------------------------------
8. LA RADIO
---------------------------------------------------------
La categorie "Communication" regroupe la radio en quatre sous-categories :
Groupe (activer, desactiver, choisir le groupe), Envoi (envoyer un nombre, un
texte, un couple nom/valeur), Reception (le bloc "lorsque un nombre / un texte /
une valeur est recu" et le bloc de lecture) et Plus (puissance d'emission,
longueur d'onde).

Le bloc de lecture donne, au choix : le nombre recu, le nom recu, la valeur
recue, le texte recu, la force du signal. Il n'a de sens qu'a l'interieur d'un
bloc "lorsque ... recu" : ailleurs il lira le dernier message arrive, ou du vide.

La convention de transport est textuelle, la meme que celle de MicroPython :
un nombre part comme "42", un couple part comme "nom=valeur", un texte part tel
quel. A la reception, le dispatcher classe le message : s'il contient "=", c'est
un couple ; sinon s'il se convertit en nombre, c'est un nombre ; sinon c'est un
texte. Deux micro:bit programmes avec cette application se comprennent donc
parfaitement.

Ce qu'il faut savoir : cette radio n'est PAS compatible en l'air avec MakeCode.
MakeCode utilise un format binaire propre a lui, avec un en-tete et un numero de
serie. Un micro:bit sous MakeCode et un micro:bit sous cette application ne
s'entendront pas, meme sur le meme groupe. C'est une limite de MicroPython, pas
de l'application.

Deux blocs MakeCode n'ont volontairement pas ete repris, faute d'equivalent
MicroPython : "regler le numero de serie de transmission" et "radio declencher
l'evenement".

Cote simulateur, la section "Radio : message a recevoir" apparait des qu'un bloc
"lorsque ... recu" est pose. On y saisit le message et on clique "Simuler la
reception" : le dispatcher le classe et appelle le bon gestionnaire, exactement
comme sur la carte. La force du signal simulee vaut -42.

Proposition du multi-editeur radio (oct. 2026) : quand l'eleve glisse un bloc
Radio dans la zone de programmation, un bandeau propose d'ouvrir le
multi-editeur radio (Fichier > Multi-editeur radio : deux editeurs vierges cote
a cote, dans un nouvel onglet ; le programme en cours reste dans l'onglet
d'origine). Boutons : "Ouvrir le multi-editeur", "Plus tard", "Ne plus
proposer" (memorise dans le navigateur). Une seule proposition par onglet ;
rien au chargement d'un fichier, d'un exercice ou d'un exemple (seul un
glisser la declenche), ni dans le multi-editeur lui-meme, ni pendant une
seance ouverte (bandeau.js).

---------------------------------------------------------
9. LES FONCTIONS
---------------------------------------------------------
La categorie "Fonctions" est dynamique : elle fournit la definition, la
definition avec retour, le retour conditionnel, et un bloc d'appel pour chaque
fonction creee. Les parametres s'ajoutent par le bouton + du bloc.

A savoir : tant qu'aucune fonction n'existe, la categorie ne montre que les
trois premiers blocs. Le bloc d'appel apparait des qu'on a pose une definition
et nomme la fonction — un par fonction, portant son nom. C'est la difference
avec Vittascience, qui affiche d'emblee un bloc d'appel generique. Un bloc
d'appel ne peut pas exister sans fonction cible.

Les fonctions sont ecrites en tete du programme, avant tout code executable,
comme les gestionnaires "lorsque ...". On peut donc poser les blocs n'importe
ou dans l'espace de travail.

---------------------------------------------------------
10. LES BLOCS "LORSQUE ..."
---------------------------------------------------------
MicroPython n'a pas de systeme d'evenements. Chaque bloc "lorsque ..." produit
une fonction, et l'application ajoute automatiquement une boucle qui les
appelle. S'il existe deja une boucle "Repeter indefiniment", la scrutation y est
inseree ; sinon une boucle dediee est ajoutee a la fin du programme.

Consequence pratique : un bloc "lorsque ..." pose seul suffit, le programme
tournera. Inutile de l'entourer d'une boucle.

Au demarrage de l'application, l'espace de travail contient deja deux blocs
emboites l'un dans l'autre : "Au demarrage" au-dessus de "Repeter
indefiniment", comme dans MakeCode.

"Au demarrage" s'execute une seule fois, avant tout le reste. Il n'a pas
d'encoche du dessus (rien ne s'accroche AU-DESSUS : il reste toujours le bloc
le plus haut, et un seul exemplaire est autorise — deux rendraient l'ordre
d'execution ambigu), mais a une encoche du bas pour s'emboiter avec le bloc
suivant, comme "Repeter indefiniment" par defaut. Son contenu est genere a
plat, en tete du programme.

L'ordre des blocs de premier niveau suit leur position verticale dans l'espace
de travail : garder "Au demarrage" au-dessus des boucles. L'emboitement les
lie physiquement pour garantir cet ordre, mais reste facultatif : les
detacher et les laisser juste l'un au-dessus de l'autre produit le meme code.

Les fonctions produites par les blocs "lorsque ..." font exception : elles sont
placees d'office en tete du programme, avant tout code executable. Sans cela, un
bloc "lorsque ..." pose a droite ou en dessous d'une boucle aurait ete defini
apres l'appel qui l'utilise, et le programme se serait arrete sur un NameError.
On peut donc les disposer librement dans l'espace de travail.

Un bloc pose sur l'espace de travail mais pas accroche a "Au demarrage", a
"Repeter indefiniment", a un bloc "lorsque ..." (ou a l'interieur de l'un
d'eux) s'affiche automatiquement griffe/grise (rendu Blockly standard) : il
n'est pas actif, et n'apparait pas dans le code genere. Le reconnecter le
reactive aussitot. Avant cette regle, un tel bloc isole n'etait pas grise
alors qu'il ne faisait deja rien la plupart du temps - pire, un bloc
d'instruction pose seul (pas un conteneur) etait bien execute une fois, tout
en haut du programme, ce qui pouvait surprendre.

"nombre de clics du bouton" (categorie Entrees/Sorties) : sur la vraie carte,
l'API MicroPython sous-jacente (get_presses()) remet son compteur a 0 des
qu'on la LIT - un simple "si nombre de clics = 10 alors ..." ne se
declencherait donc quasiment jamais tel quel. Le bloc genere pour cette
raison son propre compteur cumulatif a cote (une petite fonction Python,
invisible dans les blocs), qui lui ne se remet jamais a 0 tout seul :
correct aussi bien sur la vraie carte que dans le simulateur, puisque c'est
le meme code qui tourne dans les deux cas.

Le simulateur garde desormais cette session (variables Python globales,
objets Grove deja crees, etat des servos...) d'un declenchement a l'autre
tant que le code n'a pas change : un bouton virtuel presse pendant que rien
n'est en cours poursuit l'environnement existant au lieu de tout relancer
depuis "Au demarrage". Des clics espaces de plusieurs secondes s'additionnent
donc correctement dans "nombre de clics du bouton", comme sur la vraie
carte. Seul le bouton "Lancer la simulation" continue a tout redemarrer a
zero (son role naturel), et "Reinitialiser la simulation" efface cette
session au passage.

"attendre jusqu'à" (categorie Temps) : sur la vraie carte, "sleep()" met
vraiment en pause, le temps que la condition attendue (bouton, capteur...)
puisse changer. Dans le simulateur, "sleep()" ne met rien en pause pour de
vrai - la boucle d'attente ne peut donc jamais voir la condition changer
tant qu'elle tourne, et bouclerait indefiniment. Une limite interne coupe
court a cette boucle sans figer l'onglet : si la condition n'est toujours
pas vraie a la fin d'un tour, ce tour n'affiche simplement rien (comme la
vraie carte, qui attendrait juste le prochain declenchement) - pas de
message d'erreur pour ce cas normal, seulement pour une vraie erreur de
programme. Pour tester ce genre d'attente dans le simulateur, on peut aussi
remplacer "attendre jusqu'à" par un "si ... alors" verifie a chaque tour de
"Repeter indefiniment".

"lorsque la broche P0/P1/P2 est activée" et "broche ... est pressée"
(categories Communication/Entrees-Sorties) : sur une vraie carte, detecter
un "touche" sur ces broches necessite normalement de toucher la broche ET
une broche GND en meme temps (detection resistive, mesuree entre les deux) -
un simple doigt sur P0 seul ne suffirait pas. Le code genere active
automatiquement le mode tactile capacitif de la carte V2
(set_touch_mode(CAPACITIVE)) : un seul doigt sur la broche suffit donc,
comme dans le simulateur (qui, lui, n'a jamais eu besoin de circuit GND).

"LCD : allumer / eteindre l'affichage" (Grove LCD 16x2 v1, JHD1802,
monochrome) : le retro-eclairage de ce module est cable en permanence, il
n'existe aucune commande I2C pour le couper. Le bloc agit seulement sur
l'affichage des caracteres (bit "display on/off" du controleur HD44780) : le
texte disparait puis revient a l'allumage, le fond bleu reste allume - sur la
vraie carte comme dans le simulateur (aligne depuis : il grisait auparavant
tout l'ecran, ce que la carte ne fait pas). Pour un "vrai" ecran eteint, il
faudrait couper l'alimentation du module. Apres "eteindre", ne pas oublier
"allumer" : "LCD : effacer" ne rallume pas l'affichage.

Grove LCD RGB Backlight V4.0 (JHD1313M3) - blocs "LCD RGB : ..." (categorie
Grove) : deux circuits I2C sur le meme module, texte a l'adresse 0x3E (memes
commandes que le LCD v1) et retro-eclairage RGB a 0x62 (puce PCA9633).
Initialisation du fond selon la fiche Seeed : MODE1=0, MODE2=0, LEDOUT=0xAA,
puis PWM registre 4 = rouge, 3 = vert, 2 = bleu. Blocs : initialiser,
afficher (x, y), effacer, allumer/eteindre l'affichage (caracteres seulement),
retro-eclairage couleur (palette), retro-eclairage rouge/vert/bleu (0 a 255)
et allumer/eteindre le retro-eclairage (eteindre le coupe, allumer remet la
derniere couleur). Au demarrage le fond est blanc. Alimentation 5 V : la
V4.0 n'accepte pas le 3,3 V. La V5.0 (adresse 0x30, puce SGM31323) n'est PAS
geree. Le simulateur reutilise le meme panneau d'ecran que le LCD v1, avec la
couleur du fond et des caracteres adaptes a sa luminosite. Les blocs LCD ne
sont pas reconstruits en blocs a l'import d'un .py (comme les autres blocs
Grove) : ils deviennent des blocs "code".

Console (barre en bas de l'application, sous les trois panneaux) : un seul
espace pour deux sources. Elle est MASQUEE au depart ; le bouton >_ de la
barre d'outils l'affiche ou la masque (la croix de sa barre aussi), et la
zone de blocs se redimensionne en consequence. Elle s'ouvre toute seule a la
premiere sortie (print du simulateur ou de la carte), sauf si l'utilisateur
l'a fermee lui-meme. Sa hauteur se regle en glissant son bord haut (trait orange
au survol ; souris ou doigt) ; elle est retenue dans le navigateur, et un double-clic sur ce
bord rend la hauteur de depart. L'espace de blocs garde toujours au moins 150 px. Le bouton "?" de sa barre ouvre l'aide d'utilisation de la
console (meme fenetre que l'aide d'un bloc ; texte dans TEXTE_AIDE_CONSOLE,
un.js : a tenir a jour si la console change). Le bouton 📊 exporte toutes les
lignes affichees dans un fichier Excel .xlsx (console-microbit-AAAAMMJJ-
HHMMSS.xlsx) : colonnes N°, Heure (hh:mm:ss.mmm de la reception), Source
(Simulateur / Carte / Information), Texte et Valeur numerique (remplie quand
la ligne est un nombre, pour tracer une courbe). Format .xlsx et non .xls (le
.xls binaire est obsolete ; Excel et LibreOffice lisent le .xlsx). Le fichier
est fabrique dans le navigateur sans bibliotheque (archive ZIP non compressee
de cinq fichiers XML : creerZip / creerXlsxConsole dans un.js), donc il marche
aussi hors ligne. Valide en relisant un export avec openpyxl et LibreOffice.
Onglet "Graphique" (a cote de "Texte", dans l'en-tete de la console) : trace en
courbes les valeurs NUMERIQUES des lignes deja affichees, au fil du temps (axe
horizontal en secondes depuis la premiere mesure), sur un canevas dessine a la
main (pas de bibliotheque, marche hors ligne). Formats reconnus, un par ligne :
"21.5" (une courbe "Valeur"), "(12, 40, 7)" ou "12 40 7" (courbes "Serie 1",
"Serie 2"... comme le traceur de Mu), "temp:21 lum:40" ou "nom=valeur" (une
courbe par nom). Une virgule entre deux chiffres est decimale ("21,5") quand la
ligne ne contient qu'un nombre ; "1,2,3" est une liste. Les lignes non
numeriques sont ignorees. Si simulateur et carte envoient des valeurs, leurs
courbes sont separees (prefixe "Simulateur ·" / "Carte ·"). 600 derniers points
par courbe, echelle verticale automatique, couleurs du theme en cours (sombre,
clair, contraste eleve), mise a jour automatique (regroupee par pas de 100 ms).
Fonctions : extraireMesures, collecterSeries, dessinerGraphique (un.js).
1) SIMULATEUR : le bloc "afficher dans la console" (categorie
Affichage, genere print(x)) ecrit dans la console, dans l'ordre du programme
par rapport aux affichages et aux pauses (file d'actions du simulateur, voir
print_console dans index.html). "Lancer la simulation" et "Reinitialiser"
effacent les lignes du simulateur ; 1000 lignes maximum sont gardees (une
boucle sans pause inonderait la page). 2) VRAIE CARTE : bouton "Connecter" =
Web Serial (Chrome ou Edge uniquement), port USB de la carte (constructeur
0x0D28, DAPLink), 115200 bauds ; la sortie de la carte s'affiche en vert. Le
champ du bas envoie du texte a la carte (termine par \r\n) et l'affiche en
gris ("> texte"). Apres "Envoyer sur la carte", la carte redemarre, son port
disparait puis revient : la console se reconnecte toute seule (sauf si on a
clique "Deconnecter" soi-meme). Si la connexion echoue, un autre onglet ou
programme (editeur de code, terminal serie) utilise probablement deja le port.
Non teste avec une vraie carte : la logique (lecture en morceaux, envoi,
debranchement, reconnexion) a ete validee avec un faux port serie.

Aide sur un bloc : clic droit sur un bloc de l'espace de travail >
"Aide sur ce bloc" ouvre une fenetre (avec le logo de l'application, logo.png,
dans son en-tete) avec le nom du bloc, son texte d'aide et
le code MicroPython qu'il genere (le bloc seul, pas les suivants). Le texte
vient, par priorite : de la table AIDE_BLOCS (un.js, une ligne par bloc, avec
son identifiant technique), puis de l'infobulle du bloc (setTooltip, blocs
natifs de Blockly compris), sinon un message "aucune aide detaillee". Tous
les blocs personnalises ont aujourd'hui un texte (105 entrees dans AIDE_BLOCS
en plus des infobulles existantes) ; un bloc cree plus tard n'en aura pas tant
qu'on n'y ajoute pas sa ligne. Pour
rediger l'aide d'un bloc, ajouter sa ligne dans AIDE_BLOCS. Fermeture : bouton
Fermer, touche Echap ou clic hors de la fenetre.

Programmes d'exemple : sous le texte d'aide, la fenetre propose un petit
programme d'exemple (titre, explication, le programme EN BLOCS dans un petit
espace Blockly en lecture seule, reduit si besoin pour tenir en entier ; le
code MicroPython est replie sous "Voir le code MicroPython") et un bouton
"Insérer cet exemple dans mon espace de travail". L'exemple est ajoute SOUS
les blocs existants, sans rien effacer, en un seul pas d'annulation (un
Ctrl+Z le retire entierement). Attention : si le programme contient deja un
"Au demarrage" ou un "Repeter indefiniment", l'exemple en ajoute un second ;
c'est a l'utilisateur de fusionner ou de supprimer. 131 exemples couvrent 174
blocs (les familles partagent un exemple : LCD, LCD RGB, ruban, etc.). Ils
sont declares dans EXEMPLES_BLOCS (un.js), avec la fonction exemple(ids,
titre, texte, blocs) ; les blocs racines doivent etre des conteneurs
(exStart, exLoop, exWhen), un bloc pose seul etant grise. Les LiDAR : les
lectures (distance, direction, urgence) relisent la DERNIERE acquisition, donc
leurs exemples appellent "acquerir" avant. Blocs sans exemple : les blocs
natifs de Blockly, les deux blocs de secours (code_brut, expression_brute) et
lidar_initialiser : son generateur ecrit
`TRUE` / `FALSE` (sans majuscule unique) au lieu de `True` / `False`, ce qui
donnerait un NameError sur la vraie carte - bug connu, a corriger avant d'en
faire un exemple (le moteur de reconstruction attend aujourd'hui ces memes
`TRUE`/`FALSE`, a adapter en meme temps).

Les blocs de la boite a
outils (volet de gauche) n'ont pas de menu contextuel : Blockly n'en propose
que pour les blocs deja poses.

"Envoyer sur la carte" : une fenetre modale s'affiche au premier plan
pendant tout le transfert (generation, choix du lecteur, ecriture,
finalisation) avec une barre de 0 a 100 %. Le pourcentage compte de vrais
octets ecrits, par morceaux de 32 Ko ; il reste a 99 % ("Finalisation...")
tant que le lecteur n'a pas valide la fin de l'ecriture. La reprogrammation
de la carte elle-meme, ensuite, n'est pas mesurable depuis le navigateur. En
cas d'erreur ou d'annulation la fenetre se ferme et le message reste dans la
barre d'etat. Balisage : #voile-envoi (index.html) ; logique : fenetreEnvoi
(un.js).

---------------------------------------------------------
11. LE FICHIER FIRMWARE.HEX
---------------------------------------------------------
C'est l'image MicroPython dans laquelle le programme vient s'ecrire. Celui
fourni ici est un hex universel (V1 + V2) exporte depuis python.microbit.org.

Les deux formats sont acceptes, Intel et universel. Un .hex exporte depuis
l'editeur convient meme s'il contient deja un programme : deux.js efface la zone
du systeme de fichiers avant d'y ecrire le nouveau main.py.

Attention aux copies incompletes : un firmware tronque est refuse avec le
message "firmware.hex est incomplet", qui indique le nombre d'octets recus.

Ce message peut aussi apparaitre alors que le fichier sur le disque est
parfaitement valide : si un autre projet a ete servi auparavant sur le meme
http://localhost:8000, le navigateur a garde SON firmware.hex en cache, a la
meme adresse, et le ressert. deux.js demande desormais la lecture avec
cache: "no-store" pour eviter cela ; en cas de doute, comparer la taille
annoncee dans le message avec celle du fichier sur le disque.

---------------------------------------------------------
12. REGENERER L'EXECUTABLE
---------------------------------------------------------
Apres toute modification des fichiers du projet :

   python -m PyInstaller app.spec --noconfirm

Le fichier produit est dist/MicrobitBlockly_V2.0E.exe (un seul fichier, ~16 Mo,
sans installation). NUMERO DE VERSION (actuellement V2.0E) : a changer aux
QUATRE endroits suivants, sinon ils divergent : VERSION dans app.py (affichee
dans la fenetre console de l'exe), version_info.txt (proprietes du fichier,
onglet Details : filevers/prodvers en nombres + FileVersion/ProductVersion/
OriginalFilename en texte), name= dans app.spec (nom du fichier .exe) et le
texte de #copyright-toolbar dans index.html (barre d'outils de l'application).
Supprimer ensuite l'ancien .exe de dist/ pour ne pas garder deux versions. Il embarque index.html, un.js, deux.js, trois.js, firmware.hex,
logo.png et readme.txt : tout NOUVEAU fichier utilise par l'application doit
etre ajoute a la liste datas de app.spec, sinon il manquera dans l'exe (logo.png
avait ete oublie). Double-clic : AUCUNE fenetre ne s'ouvre (l'exe
est construit sans console : console=False dans app.spec) ; le navigateur
s'ouvre directement sur http://localhost:8000. Le serveur tourne cache et
s'ARRETE TOUT SEUL quand la derniere page de l'application est fermee (voir
"Cycle de vie" ci-dessous). Si le port 8000 est occupe par un autre programme,
le suivant libre est pris (8001, 8002...). Si l'application tourne deja
(double-clic repete), le navigateur est simplement rouvert dessus, sans lancer
de seconde copie. Une erreur (aucun port libre) s'affiche dans une boite de
dialogue Windows.
Cycle de vie (app.py, exe uniquement ; `python app.py` garde sa console et ne
s'arrete jamais seul) : chaque page ouverte envoie un signe de vie toutes les
5 s (/_vie, script en bas de index.html) et un signal de fermeture quand le
navigateur la quitte (/_ferme, navigator.sendBeacon sur l'evenement pagehide).
Le serveur s'arrete 5 s apres la fermeture de la derniere page (delai de grace :
un rechargement F5 ne l'arrete pas) ; 150 s apres le dernier signe de vie si le
navigateur a plante ; 90 s apres le demarrage si aucune page ne s'est connectee.
Les delais se surchargent pour les tests par les variables d'environnement
MICROBIT_DELAI_GRACE, MICROBIT_DELAI_SILENCE et MICROBIT_DELAI_DEMARRAGE.
Plusieurs onglets/fenetres : le serveur reste tant qu'il en reste un d'ouvert.
Pour VOIR les messages du serveur (diagnostic), lancer `python app.py` dans un
terminal ou lancer_projet.bat. HORS LIGNE (depuis
V1.2) : plus aucune ressource n'est chargee depuis Internet, l'application et
l'exe fonctionnent sans connexion. Toutes les bibliotheques sont dans lib/ (a
embarquer dans app.spec : ('lib', 'lib')) :
  lib/blockly/        Blockly 10.4.3 (blockly_compressed, blocks_compressed,
                      python_compressed, msg/fr.js) + media/ (images et sons,
                      option media: 'lib/blockly/media/' dans les deux inject)
  lib/brython/        Brython 3.11.2 (brython.min.js, brython_stdlib.min.js)
  lib/microbit/       microbit-fs 0.10.1 et microbit-universal-hex 0.2.2, fichiers
                      autonomes tires d'esm.sh (?bundle), lus par deux.js et
                      trois.js. Extension .js et non .mjs : le serveur Python
                      de Windows sert .mjs en text/plain, que le navigateur
                      refuse pour un module.
Pour mettre a jour une bibliotheque : telecharger la nouvelle version au meme
emplacement (unpkg.com/blockly@X/..., cdnjs brython X, esm.sh/@microbit/...?bundle)
puis retester simulation, generation du .hex et envoi sur la carte. Ne pas
remettre de lien vers un CDN : aucune requete externe ne doit rester (verifiable
dans la console du navigateur, onglet Reseau). Licences d'origine conservees dans
les en-tetes des fichiers (Blockly : Apache 2.0 ; Brython : BSD ; microbit-fs et
microbit-universal-hex : MIT). Windows peut afficher un avertissement SmartScreen
au premier lancement (executable non signe).
Piege Windows corrige dans app.py : allow_reuse_address=True y laisse deux
serveurs ecouter le meme port, la detection de port occupe ne marchait donc pas.

---------------------------------------------------------
13. LE PANNEAU ADMINISTRATEUR
---------------------------------------------------------
Raccourci Ctrl+Alt+Maj+A : active ou desactive le mode administrateur. Le
bouton ⚙ est invisible tant que ce raccourci n'a pas ete utilise. Ce n'est pas
une vraie protection (l'app est 100% cliente, sans compte ni serveur) : ca
evite juste qu'un eleve tombe dessus par hasard.

Le panneau a quatre onglets :

- CATEGORIES : glisser pour reordonner, l'oeil masque une categorie aux
  eleves, le crayon la renomme, la pastille de couleur en tete de ligne
  change sa couleur (selecteur natif du navigateur). "Tout reinitialiser"
  revient a l'etat d'origine (ordre, noms et couleurs compris).
- SOUS-MENUS : on choisit une categorie dans la liste deroulante.
  - Communication et Grove ont deja des sous-menus (un par module) : ils se
    reordonnent/masquent/renomment/recolorent comme les categories.
  - Les autres categories sont a plat : on peut regrouper des blocs choisis
    dans un nouveau sous-menu (utile si une categorie s'allonge trop), avec
    lui aussi sa propre pastille de couleur. Un sous-menu supprime rend ses
    blocs au niveau superieur.
- LIBELLES : cherche un bloc par son nom technique ou par un mot de son
  texte affiche, puis modifie ce texte. Ca ne touche qu'a l'affichage, jamais
  au code Python genere ni au comportement du bloc.
- AIDE : le contenu de ce readme.txt, charge depuis le serveur local au
  premier clic sur l'onglet. Un lien l'ouvre aussi dans un nouvel onglet du
  navigateur.

Tout est memorise en localStorage, donc propre a chaque navigateur/poste :
pas de fichier de config partageable entre les postes d'une salle pour
l'instant. Reglages perdus si le cache du navigateur est vide.

---------------------------------------------------------
14. ÉDITION MANUELLE DU CODE
---------------------------------------------------------
Bouton "✎ Éditer" au-dessus de la transcription MicroPython : bascule le
panneau en zone de texte modifiable.

Blockly sait transformer des blocs en Python, jamais l'inverse de façon
fiable : du code tape a la main ne peut donc pas revenir en blocs. Les deux
ne peuvent pas rester synchronises, alors ce mode est exclusif plutot que de
laisser deriver l'un des deux sans le dire :

- Entrer en edition manuelle GELE le canevas Blockly (voile visible dessus,
  qui bloque aussi les clics) : impossible de modifier les blocs tant qu'on
  est en train de taper du code.
- Ce qui est tape remplace en direct le code utilise par le simulateur, le
  bouton .hex, le bouton .py et "Envoyer sur la carte".
- "↩ Revenir aux blocs" ABANDONNE la saisie manuelle et restaure le code tel
  que les blocs le decrivent a cet instant (pas celui d'avant l'edition, s'ils
  ont continue d'exister en arriere-plan).

Rien n'est sauvegarde d'une session a l'autre : recharger la page perd la
saisie manuelle, exactement comme elle perd deja l'espace de travail Blockly
lui-meme. Telecharger le .py avant de recharger si le texte tape doit etre
garde.

---------------------------------------------------------
15. MAQUEEN PLUS (robot sur piste)
---------------------------------------------------------
Nouvelle categorie de blocs pour le chassis robot DFRobot Maqueen Plus (I2C,
adresse 0x10) : moteurs gauche/droit, cinq capteurs de ligne, phares,
DEL RGB, capteur a ultrason. Des qu'un bloc de cette categorie est pose, un
panneau "Piste" apparait sous le simulateur habituel, avec une piste et le
robot dessus.

IMPORTANT : ce panneau piste est PARTAGE entre les trois robots du projet
(Maqueen Plus, Kitrobot v2, Maqueen Lite - voir §16 et §18). Un seul robot
y est visible a la fois, celui dont un bloc est reellement pose sur l'espace
de travail (le titre du panneau change en consequence). Les trois profitent
donc des memes reglages : choix du tracé, largeur de la piste, echelle
d'affichage, editeur de piste personnalisee. Kitrobot lit un pixel SOMBRE
comme "sur la ligne" (l'inverse des deux autres) : la piste change donc de
couleurs (blanc/noir au lieu de vert/blanc) des que Kitrobot est le robot
actif, quel que soit le tracé choisi.

Un menu deroulant au-dessus de la piste propose plusieurs tracés : boucle
ovale, circuit aux coins presque vifs, circuit en huit (deux boucles qui se
croisent). Changer de piste replace le robot au point de depart propre a ce
tracé.

Le bouton "✏ Éditer la piste" ouvre un editeur a points de passage pour
dessiner sa propre piste :
- Clic sur la piste : ajoute un point a la fin du tracé.
- Glisser un point (poignee jaune, verte pour le premier) : le deplace.
- Double-clic sur un point : le supprime.
- "Terminer" enregistre (3 points minimum pour fermer une boucle) et bascule
  dessus ; "Annuler" abandonne les modifications ; "Effacer" repart de zero
  sans quitter l'editeur.
Une seule piste personnalisee a la fois, memorisee en localStorage (donc
propre a chaque navigateur/poste, comme le reste des reglages). Le premier
point pose devient le depart, oriente vers le deuxieme point.

Un curseur "Largeur de la piste (px)" (8 a 40, 26 par defaut) regle
l'epaisseur du trait blanc, pour les trois tracés predefinis comme pour la
piste personnalisee. Se repercute immediatement sur la difficulte a suivre
la ligne (plus etroit, plus facile de la perdre) : pratique pour un
suiveur de ligne plus exigeant. Non memorise d'une session a l'autre
(revient a 26 px au rechargement, comme le choix du tracé).

Un second curseur "Échelle du robot" (×1 a ×4) agrandit uniquement
l'affichage du robot, sans rien changer a la simulation (position, cap,
capteurs) : pratique pour voir le detail du chassis ou l'etat des
capteurs de ligne sur le robot lui-meme (voir plus haut). A forte echelle,
le robot peut deborder du cadre de la piste pres des bords - normal, la
piste garde ses coordonnees internes inchangees.

Une ligne "Ligne :" apparait sous la piste, avec un point par capteur
REELLEMENT utilise par le programme (un bloc "capteur de ligne" pose sur
l'espace de travail) : vert s'il est actuellement sur la piste, gris sinon.
Se met a jour en direct, aussi bien pendant une simulation qu'en deplacant
le robot a la souris. Les memes points sont aussi affiches directement sur
le bord avant du robot (dans l'ordre L2/L1/M/R1/R2, de haut en bas quand il
pointe vers la droite), pour voir l'etat des capteurs sans quitter le robot
des yeux.

Le robot se glisse-depose n'importe ou sur la piste, a la souris ou au doigt :
c'est la nouvelle position de depart, conservee par "Reinitialiser la
simulation" (qui ne revient donc plus a un point fixe une fois le robot
deplace). Cela fonctionne aussi pour Kitrobot v2 et Maqueen Lite (meme
piste partagee, voir plus haut) : glisser le robot reellement affiche le
deplace, quel que soit celui des trois.

Contrairement aux autres modules, le robot BOUGE REELLEMENT sur la piste :
sa position et son cap suivent la vitesse donnee a chaque moteur, et les
blocs "capteur de ligne" lisent la couleur de la piste sous le robot a
l'endroit ou il se trouve a cet instant precis. Un vrai programme suiveur de
ligne (lire un capteur, corriger, boucler) fonctionne donc pour de vrai dans
le simulateur, tour de boucle apres tour de boucle - pas seulement une
demonstration figee.

A savoir avant de juger que "ca ne suit pas bien la ligne" :
- La cinematique est une approximation simple (un seul calcul par pause
  sleep()), pas une simulation physique complete. Des pauses courtes et
  regulieres (sleep(50) a sleep(150)) donnent une trajectoire plus fidele
  que de grosses pauses espacees.
- Trois tracés au choix, tous fermes ; aucun n'est dessinable ou modifiable
  a la main.
- Le deplacement du robot est anime (transition CSS) sur la duree reelle de
  chaque sleep() du programme, pour rester fluide plutot que saccade.
- Aucun materiel Maqueen Plus n'a servi a verifier ceci : le protocole I2C
  vient d'un pilote MicroPython tiers verifie (pas invente), mais rien ne
  remplace un test sur la vraie carte.

Comme les autres modules, le pilote reel est ecrit dans le programme
genere (marqueurs "# >>> pilote maqueen") : sur la carte, ce sont les
memes lignes qui pilotent le vrai chassis.

Le robot dessine s'inspire d'une photo du vrai chassis (coque sombre, bord
dore, vis aux coins, compartiment a pile 18650 avec son "+", liseré de
circuit imprime vert cote broches) sans etre une image : tout est en CSS,
comme le reste du simulateur. Les deux DEL visibles sur le robot
refletent en direct les couleurs reellement programmees (blocs "DEL RGB"),
pas juste decoratives.

---------------------------------------------------------
16. KITROBOT V2 (robot sur piste droite)
---------------------------------------------------------
Deuxieme robot, distinct du Maqueen Plus ci-dessus : chassis a deux servos.
Des qu'un bloc de la categorie "Kitrobot v2" est pose, le panneau "Piste"
(voir §15) affiche ce robot a la place du Maqueen, sur la MEME piste que les
deux autres robots - y compris le tracé "Ligne droite (départ/arrivée)"
d'origine dediee a Kitrobot, desormais un choix de tracé comme un autre.
La piste passe en fond blanc/ligne noire (inversee par rapport a Maqueen)
tant que Kitrobot est le robot actif, pour bien distinguer les deux d'un
coup d'oeil quel que soit le tracé choisi.

Contrairement au Maqueen Plus, aucun cablage reel n'a pu etre verifie pour
ce kit. Toutes les broches (servos, ultrason, buzzer, capteurs de ligne,
ruban RGB) ont donc des valeurs par defaut raisonnables, mais modifiables
par des blocs "definir" facultatifs en haut de la categorie - a ajuster
selon le cablage reellement fait en classe. Le tooltip de chaque bloc
"definir" rappelle la valeur par defaut.

Les blocs disponibles :
- Configuration (facultatif) : definir les broches des servos, de
  l'ultrason, du buzzer, des capteurs de ligne, du ruban RGB.
- Detection : distance (cm), etat d'un capteur de ligne (gauche/droit).
- Deplacement : avancer/reculer a une vitesse (%), pivoter sur place,
  piloter un seul moteur, avancer/reculer d'une case, pivoter d'un quart de
  tour, tout arreter.
- Controle : jouer un son (frequence, duree), clignoter en blanc.
- LED RGB : allumer une DEL du ruban par couleur ou par R/V/B, effet
  "Arc-en-ciel" sur tout le ruban.

Comme les autres modules, le pilote reel est ecrit dans le programme genere
(marqueurs "# >>> pilote kitrobot") : sur la carte, ce sont les memes lignes
qui pilotent le vrai chassis. Le robot dessine (chassis bleu-gris, pour ne
pas le confondre avec le Maqueen) bouge reellement sur la piste, comme pour
Maqueen : position et cap suivent la vitesse donnee a chaque moteur, les
capteurs de ligne lisent vraiment la piste sous le robot.

Aucun materiel Kitrobot v2 n'a servi a verifier ceci : contrairement au
Maqueen Plus, aucune source de cablage fiable n'a ete trouvee pour ce kit,
d'ou le choix de rendre toutes les broches configurables plutot que
d'inventer un cablage. Avant un premier essai reel : verifier le sens de
montage des deux servos (si le robot recule au lieu d'avancer, inverser le
cablage d'un cote), et le sens des capteurs de ligne (certains modules
Grove Line Finder sortent l'inverse selon calibration).

---------------------------------------------------------
17. MAQUEEN PLUS V3, TELECOMMANDE INFRAROUGE ET LIDAR
---------------------------------------------------------
Trois ajouts a la categorie "Maqueen Plus" et une nouvelle categorie
"LiDAR", tous verifies depuis le code source officiel DFRobot (memes
depots GitHub que sert MakeCode), jamais confrontes a un vrai chassis V3
ni a un vrai capteur LiDAR.

SUIVEUR DE LIGNE ET PID (V3) - sous-sections "Suiveur de ligne (V3)" et
"PID (V3)" de la categorie Maqueen Plus. Le Maqueen Plus V3 possede un
codeur de roue et des capteurs de carrefour absents des chassis V1/V2 :
sur un chassis plus ancien, ces blocs envoient des octets valides mais
sans effet observable (ni erreur, ni mouvement). Dans le simulateur, seuls
les blocs "avancer de X cm (PID)" et "tourner de X degres (PID)" font
vraiment bouger le robot (memes moteurs simules que les blocs Maqueen
ordinaires) ; le suiveur de ligne autopilote et le codeur de roue n'ont
pas d'equivalent visuel, faute de modele physique pour un pilotage
entierement automatique.

DEL DE CARROSSERIE : distinctes du ruban RGB adressable (registres 11/12
au lieu du NeoPixel sur P15) - un jeu de couleurs simples (rouge, vert,
jaune, bleu, violet, cyan, blanc, eteint), pas un choix de teinte libre.

TELECOMMANDE INFRAROUGE : le pilote DFRobot d'origine est ecrit en C++
compile dans le firmware MakeCode, impossible a reutiliser tel quel en
MicroPython. Le decodage a donc ete reecrit a partir du protocole NEC
(norme publique, pas un secret DFRobot), avec la meme technique que le
capteur ultrason (machine.time_pulse_us). Deux telecommandes reconnues :
- "Noire" : boutons de la telecommande DFRobot d'origine (Power, Vol +/-,
  fleches, chiffres 0-9, EQ...).
- "Grise Car mp3" : telecommande generique tres repandue (fournie dans de
  nombreux kits Arduino), 21 boutons.
Poser un bloc "lorsque la commande ... est recue" par telecommande cree
l'evenement ; il se declenche automatiquement a chaque tour de boucle,
inutile d'appeler "decoder le recepteur infrarouge" a la main (ce bloc
existe pour un controle plus fin, dans une boucle personnalisee). Le
panneau Maqueen Plus propose un simulateur de telecommande (deux menus
deroulants + bouton "Simuler l'appui") puisqu'aucun vrai signal infrarouge
n'existe dans un navigateur. Une seule reserve non verifiee sur la vraie
telecommande DFRobot : son adresse NEC exacte n'est pas documentee, le
decodeur ne verifie donc que le bouton, pas l'appareil emetteur - une
autre telecommande NEC a adresse differente pourrait donc, en theorie,
declencher les memes evenements sur du vrai materiel.

LIDAR MATRICIEL (nouvelle categorie "LiDAR", capteur DFRobot SEN0628,
I2C 0x30 a 0x33) : mode "Matrice 8x8" pour lire la distance en un point
precis (x, y de 0 a 7), ou mode "Evitement 4x4" pour une detection
gauche/avant/droite toute faite - poser "configurer la taille" avec le
bon mode avant d'utiliser les blocs correspondants. En mode evitement,
"acquerir les donnees d'evitement" doit etre appele avant de lire le
signal d'urgence, la direction conseillee ou une distance : ces blocs-la
relisent la derniere acquisition, pas le capteur en direct. Independant
d'un robot precis (utilisable seul ou avec un Maqueen) ; le panneau du
simulateur propose trois curseurs (gauche/avant/droite, en mm) plutot
qu'une vraie matrice de distances.

---------------------------------------------------------
18. MAQUEEN LITE
---------------------------------------------------------
Chassis DFRobot plus simple, distinct du Maqueen Plus (categorie separee,
protocole different) : meme adresse I2C 0x10 pour les moteurs, mais
seulement 2 capteurs de ligne (gauche/droit, lus directement sur des
broches, pas de registre dedie), 2 DEL simples marche/arret (pas de RGB),
et un capteur ultrason a broches fixes (pas de choix de broche).

Blocs disponibles : moteur (vitesse -255 a 255, comme le Maqueen Plus),
arreter le moteur, distance (cm), capteur de ligne (0 ou 1, sens non
verifie sur une vraie carte), DEL allumee/eteinte, servo (S1/S2), et un
bloc "lorsque le capteur de ligne ... passe a l'etat ..." pour reagir aux
changements sans avoir a le lire soi-meme dans une boucle.

Depuis que la piste est partagee entre les trois robots (voir §15), le
Maqueen Lite a lui aussi un robot anime : des qu'un bloc de la categorie
est pose, le panneau "Piste" l'affiche, sur la meme piste que les deux
autres, memes couleurs que le Maqueen Plus (vert/blanc, pas d'inversion).
Le chassis (au depart un simple rectangle CSS gris-violet) est desormais
dessine en SVG d'apres deux photos officielles DFRobot du vrai robot
(ROB0148-EN) : carte bleue en pointe vers l'avant, deux capteurs ultrasons
chromes a la pointe, compartiment a piles noir a l'arriere, grandes roues
blanches/argentees. Le bloc moteur deplace donc vraiment le robot, et le
bloc/l'evenement capteur de ligne lisent vraiment la piste sous lui - les
deux anciennes cases a cocher qui simulaient ces capteurs ont disparu, plus
necessaires. L'etat des deux capteurs (gauche/droit) s'affiche a la fois
sous la piste ("Ligne : G/D") et directement sur le robot (deux points sur
le bord avant, comme le Maqueen Plus), vert quand le capteur est sur la
ligne. Seul le bloc servo reste sans effet visuel (aucun panneau
dedie pour ca, comme le Maqueen Plus).

Aucun materiel Maqueen Lite n'a servi a verifier ceci : le protocole vient
du depot officiel MakeCode de DFRobot (pxt-maqueen), pas invente, mais
rien ne remplace un test sur la vraie carte - en particulier le sens des
capteurs de ligne (0 ou 1 = sur la ligne ?), qui depend du cablage reel.

---------------------------------------------------------
19. IA : VISION (CAMERA) ET SON (MICRO)
---------------------------------------------------------
Reconnaissance d'images et de sons avec des modeles crees sur Teachable
Machine (teachablemachine.withgoogle.com, projet "Image" ou "Son"). Le
resultat pilote le programme : simulateur ou vraie carte, avec les memes blocs.

Principe : la reconnaissance tourne dans le NAVIGATEUR (la carte n'a ni
camera ni micro, et le modele est bien trop gros pour elle). La carte recoit
seulement le RESULTAT, une ligne de texte par le cable USB :
    IA:<vision|son>:<classe>:<confiance 0-100>
La classe y est ecrite sans accents ni majuscules ("Chat noir" -> chat_noir).
La ligne part a chaque changement de classe (classe vide quand la confiance
retombe sous le seuil), et un peu plus souvent pour mettre a jour la confiance
quand elle varie d'au moins 10 points. Le navigateur doit donc rester ouvert.

Blocs (categorie "IA", rose) :
- lorsque l'IA [vision|son] reconnait [classe]  : gestionnaire, ne se redeclenche
  pas tant que la classe reste la meme ;
- l'IA [vision|son] reconnait [classe]          : condition (vrai/faux) ;
- derniere classe reconnue par l'IA [type]      : texte (ex. "chat_noir") ;
- confiance de l'IA [type] (%)                  : nombre de 0 a 100.
Un programme qui en contient recoit un petit pilote (section "pilote ia",
replie dans la transcription) qui lit le port serie de la carte (uart.init a
115200 bauds, lecture dans la boucle d'evenements ; le tampon de reception de
la carte ne contient que 64 octets : eviter les longues pauses dans la boucle).
Ce pilote fait un uart.init(115200) : la liaison USB reste celle de print() et
de la console.

Panneau IA (bouton 🧠 de la barre d'outils, barre en bas) :
1. Coller l'adresse du modele (lien de partage Teachable Machine, "Charger" -
   necessite Internet) OU "Fichiers..." et selectionner d'un coup model.json,
   metadata.json et weights.bin du modele exporte (fonctionne hors connexion).
2. "Demarrer" : le navigateur demande la camera ou le micro. Les classes
   s'affichent avec une barre de probabilite ; la classe retenue passe en orange.
3. "Seuil de confiance" (30 a 99 %, 80 par defaut) : en dessous, aucune classe.
Fenetre IA (oct. 2026, sur le modele de la version Arduino R4) : le bouton IA ouvre une fenetre centree. Bandeau titre
(« Entrainer l'IA a reconnaitre des objets ou des images »...), onglets Apprentissage immediat / Modele Teachable Machine
(camera) / Modele Teachable Machine (micro) / QR codes et codes-barres (point bleu : pret, vert : en marche), pied :
Tout effacer, seuil de confiance, interrupteur « Envoyer a la carte », Termine. Apprentissage immediat : pastilles
« L'IA doit reconnaitre » ; une carte par classe a gauche (nom modifiable, nombre d'exemples, 🧹 vider, ✕ supprimer,
« Une photo », « Plusieurs photos » jusqu'a « Arreter », « Ajouter des images » ; sons : « Enregistrer »), « + Ajouter une
classe » ; a droite la camera (allumee a l'ouverture, eteinte a la fermeture), le test (Demarrer et barres), l'aide et la
note de confidentialite. Termine, Echap ou un clic sur le voile ferment la fenetre ; une reconnaissance en cours continue
(bouton IA souligne en vert).
4. Simulateur : lancer la simulation (sans elle, rien n'est transmis).
   Vraie carte : la connecter par le bouton Connecter de la console, envoyer le
   programme, cocher "Envoyer a la carte".
L'image et le son restent dans le navigateur ; seuls les noms de classe sont
transmis. Camera et micro sont coupes quand on arrete ou ferme la page.

Creer son modele dans l'application (sans Internet, comme sur Teachable Machine) :
dans chaque colonne, section "Creer un modele (entrainement)".
- Vision : bouton "Camera", puis maintenir "Maintenir" en face de chaque classe
  pour capturer des images en rafale. Son : "● 1 s" enregistre 1 seconde de son
  (prevoir une classe "Bruit de fond" pour le silence).
- Au moins 2 classes et 5 exemples par classe (30 ou plus, varies, est bien mieux).
- "Entrainer" : apprentissage par transfert. Un reseau de base (MobileNet v2 pour
  l'image, speech-commands pour le son, dans lib/tm/base/, ~7,5 Mo) extrait les
  caracteristiques ; seule une petite couche finale est entrainee (50 epoques en
  vision, 25 en son). Le modele devient aussitot le modele actif de la colonne.
- "Enregistrer" telecharge model.json, metadata.json et weights.bin (meme format
  que Teachable Machine : rechargeables avec "Fichiers..." ou sur leur site).
- Les exemples restent dans le navigateur et sont perdus si la page est rechargee.
- Sur un ordinateur sans accelerateur graphique (WebGL), la capture d'images et
  l'entrainement sont nettement plus lents (environ 1 s par image mesuree en
  CPU dans le navigateur integre ; beaucoup plus rapide avec WebGL).
- Garder l'onglet visible pendant l'entrainement : le navigateur met en pause les
  onglets caches et l'entrainement s'arrete avec eux.
- La capture sonore est suspendue pendant que le micro de reconnaissance tourne.

Hors connexion : TensorFlow.js 1.3.1 et les bibliotheques Teachable Machine
sont dans lib/tm (embarquees dans l'exe), chargees au premier "Charger".
Seule l'adresse en https:// d'un modele demande Internet.

Verifie : generation des blocs, simulateur (classes, seuil, redeclenchement,
ligne coupee en deux morceaux), chargement de modeles image ET son au format
Teachable Machine depuis des fichiers (modeles synthetiques), prediction sur
une image, boucle de reconnaissance avec une camera simulee, envoi sur un port
serie simule, entrainement vision (2 classes de couleur) et son (silence/bip),
enregistrement puis rechargement des 3 fichiers, avec les resultats justes.
NON verifie : camera et micro reels, modeles Teachable Machine reels, vraie
carte (reception par l'uart du pilote), chargement par adresse https://.
Le micro de la reconnaissance sonore demande un modele "Son" de Teachable
Machine (reconnaissance sur environ 1 seconde ; la classe "Background Noise"
est le bruit de fond).

---------------------------------------------------------
20. VISITES GUIDEES (MENU AIDE)
---------------------------------------------------------
L'entree "Visite guidee (tuto)" du menu Aide (elle relance toujours depuis
le debut) lance une visite en 12 etapes : une bulle
explicative se place a cote de l'element presente (mis en evidence, le reste de
l'ecran est assombri). Le voile ne bloque pas les clics : on manipule les vrais
outils pendant la visite. Boutons Precedent / Suivant / Quitter, touche Echap
pour arreter ; relancer la visite par le meme menu.
Parcours : categories de blocs, premier programme, code MicroPython, simulateur,
lancer la simulation, boutons/gestes/capteurs, console, menu Fichier, envoi sur
la carte, panneau IA, blocs IA, aides.
Certaines etapes attendent une action (ouvrir une categorie, poser "Au demarrage"
avec "afficher icone" dedans, cliquer "Lancer la simulation", ouvrir la console) et
affichent "Bien joue" ; "Suivant" reste toujours utilisable pour ne jamais coincer.
Message d'accueil : au demarrage (1,2 s apres le chargement), une bulle sous le bouton
Aide propose de "visiter" le menu Aide ou se trouvent les visites. "Ouvrir le menu
Aide" l'ouvre et fait clignoter les deux entrees de visite ; "Plus tard" ferme le
message (il reviendra au prochain demarrage) ; la case "Ne plus afficher ce message"
le supprime definitivement (localStorage, cle tuto-accueil-masque, propre a chaque
adresse/port : pour le reafficher, vider les donnees du site). Ouvrir soi-meme le menu
ou appuyer sur Echap ferme aussi le message.
Deuxieme visite, consacree a l'IA : menu Aide > "Visite guidee IA" (15 etapes) :
ouvrir le panneau, les deux colonnes vision/son, creer un modele (camera, capture
d'exemples, entrainement), le tester, le seuil de confiance, charger un modele
Teachable Machine, le son et sa classe "Bruit de fond", enregistrer, les blocs IA,
reagir a une classe, essai dans le simulateur, vraie carte, aide. Les etapes
d'action attendent : camera allumee, 5 images par classe, "Modele entraine",
reconnaissance demarree, categorie IA choisie, bloc pose, simulation lancee.
Verifie dans le navigateur integre : positionnement des 15 etapes, detection de
chaque action (camera, captures, entrainement et reconnaissance simules par un flux
synthetique). Non verifie : avec une vraie camera.
Troisieme et quatrieme visites : menu Aide > "Visite guidee Console" (11 etapes : ouvrir la console,
le bloc "afficher dans la console", le poser, lancer la simulation, la zone de texte, l'onglet Graphique,
effacer, exporter Excel, lire la vraie carte, envoyer du texte, aide et fermeture) et "Visite guidee
clic droit" (8 etapes : menu d'un bloc, "Aide sur ce bloc", Dupliquer, Ajouter un commentaire, Reduire,
Desactiver, menu du fond - Nettoyer / Reduire / Developper / Supprimer -, annuler). Les etapes d'action
detectent un vrai clic droit (menu contextuel Blockly affiche), la fenetre d'aide ouverte, un bloc copie,
un commentaire, un bloc replie ou desactive. Echap ferme d'abord le menu contextuel ou la fenetre d'aide
(sans arreter la visite) ; un second Echap arrete la visite. Le message d'accueil cite les quatre visites.
Le cadre orange de mise en evidence a une marge de 8 px, reduite a 3 px pour les elements de moins de 40 px de
haut (lignes de categories, boutons) : sinon il debordait sur les lignes voisines et semblait les entourer aussi.
La bulle ne doit jamais recouvrir l'element presente : si la cible est collee au bord droit de l'ecran (boutons de la
console), elle s'aligne sur son bord droit, au-dessus ou en dessous. Verifie dans le navigateur integre : positionnement des etapes de chaque visite (1280x720), chaque detection
d'action (clic droit reel sur un bloc et sur le fond, le reste simule), Echap. Pas verifie : vraie carte.
Modifier ou ajouter une etape : une entree dans les tableaux ETAPES_GENERAL, ETAPES_IA, ETAPES_CONSOLE ou
ETAPES_CLIC_DROIT de tuto.js
(titre, texte, cible = selecteur CSS ou fonction, avant(), attendre() ou
attendreClic, consigne). Si un identifiant du HTML change, adapter la cible.
Verifie dans le navigateur integre : positionnement de la bulle sur les 12
etapes (dans l'ecran 1280x720), detection des actions, navigation, Echap. Pas
verifie : petits ecrans (bulle de 340 px de large) ni lecteurs d'ecran.
Fichier a ajouter a la liste datas de app.spec (fait) pour l'exe.

---------------------------------------------------------
21. COULEURS DES CATEGORIES
---------------------------------------------------------
Une seule table, PALETTE_CATEGORIES (un.js, juste avant Blockly.inject), donne la
couleur de chaque categorie : la bande de la colonne de categories (large de 16 px,
regle CSS dans index.html) ET tous les blocs de la categorie la suivent
(appliquerPaletteToolbox les recolore a leur creation). Les sous-categories
(Communication, Grove) heritent de leur parent.
Palette volontairement reduite a 7 couleurs TRANCHEES (orange, bleu, or, violet,
turquoise, rouge, magenta), sans vert, choisies pour rester distinguables en cas de
daltonisme. Une couleur sert a plusieurs categories mais jamais a deux categories
voisines de la colonne ; les quatre robots (Maqueen Plus/Lite, Kitrobot, LiDAR)
partagent le violet. Texte blanc des blocs lisible (contraste >= 3,9). Pour changer
une couleur : modifier la ligne de la table (constantes C_ORANGE, C_BLEU...). Les
couleurs choisies dans le panneau administrateur (§13) remplacent la bande
seulement, pas les blocs. Non verifie avec une personne daltonienne ni un simulateur
de daltonisme : choix fait d'apres la theorie (palette dite d'Okabe-Ito adaptee).

---------------------------------------------------------
22. CHARTE GRAPHIQUE (COULEURS TECHNOLOGIE SERVICES)
---------------------------------------------------------
Les couleurs de l'interface reprennent celles de Technologie Services
(technologieservices.fr), relevees sur leur site et leur logo : ORANGE (accent du
site #ff5501 ; le logo va du rouge #e02010 a l'orange #e87000), ANTHRACITE / NOIR
(#303030 en pied de page, #0f171f) et BLANC. Il n'y avait plus de bleu-ardoise.
- Fonds (variables CSS en tete de index.html, themes sombre / clair / contraste) :
  anthracite #303030 (barre d'outils, colonne de categories, panneaux), #1c1c1c
  (zones profondes), #202020 (champs de saisie) ; theme clair : gris neutres.
- Boutons d'action principaux (Fichier, Envoyer, Lancer la simulation, .hex) : orange
  fonce #cf4400, survol #b33a00 (texte blanc, contraste 4,8:1 ; le #ff5501 pur, trop clair
  pour du texte blanc, est reserve aux bandes, titres et contours).
- Boutons secondaires : gris anthracite #4a4a4a (survol #5e5e5e).
- Titres de panneaux : orange clair #ff7a33 (lisible sur fond sombre).
- Conserves : couleurs des categories de blocs (§21, hors charte, pour leur lisibilite),
  vert des etats "ok" (carte connectee, classe reconnue), rouge des erreurs, couleurs
  "d'appareil" (carte micro:bit, robots, DEL).
- Le logo logo.png (barre d'outils) n'a PAS ete change.
Pour modifier la charte : remplacer ces codes hexadecimaux dans le bloc <style> de
index.html et dans les themes Blockly de un.js (THEME_SOMBRE_*).
- Barre d'outils et menu Fichier : plus aucune icone, les boutons portent un libelle
  texte (Fichier, Capture, Envoyer, Annuler, Refaire, Code, Simulateur, Console, IA,
  Theme, Contraste). Les boutons ne se coupent jamais sur deux lignes ; la barre passe
  a la ligne quand la fenetre est trop etroite (moins de ~1250 px). Les boutons a
  l'interieur des panneaux Console et IA (Connecter, Camera, Entrainer...) gardent
  pour l'instant leurs petits symboles.

---------------------------------------------------------
23. BARRE D'OUTILS : ORGANISATION
---------------------------------------------------------
De gauche a droite : logo | Affichage (menu : Theme, Contraste eleve) | Fichier (menu :
Nouveau projet, telecharger .hex/.py, importer .hex/.py) | champ "Nom du fichier" |
Annuler | Refaire | Capture | Envoyer | Console | Simulation | Code | IA | version |
Aide (menu : Visite guidee, IA, Console, clic droit), tout a droite ; son menu s'ouvre vers la gauche.
- Message d'etat (ex. "Fichier telecharge.", erreurs en rouge) : petit bandeau sous le bord droit de la
  barre, par-dessus le contenu, sans effet sur les clics ; il ne decale plus aucun bouton et n'est plus tronque.
- Champ "Nom du fichier" : nomme les fichiers telecharges (.hex, .py) et la capture
  d'ecran (.png) ; vide = noms d'origine (programme-microbit.hex, script_microbit.py,
  programme-microbit.png). Les caracteres interdits par Windows (\ / : * ? " < > |) et
  l'extension saisie sont retires. Importer un .hex ou .py reprend le nom du fichier
  dans le champ ; "Nouveau projet" le vide. Le nom n'est pas memorise au rechargement.
  Le fichier ecrit directement sur la carte ("Envoyer") garde son nom (sans importance
  pour la carte). Le fichier xlsx de la console garde son nom date.
- Icones (SVG, couleur du texte, grisees avec le bouton quand il est inactif) : ◐ Affichage,
  ☰ Fichier, fleches Annuler / Refaire, appareil photo Capture, fleche vers le haut Envoyer,
  terminal Console, panneau a deux colonnes Simulation, chevrons < > Code, etincelles IA.
  Seuls Aide et les menus Affichage / Fichier / Aide (hors leur bouton) n'ont pas d'autre icone.
  Police des boutons ramenee a 12 px et marges resserrees (dont le groupe de zoom) pour que tout
  tienne sur une ligne a 1280 px (marge restante faible : sous ~1280 px la barre passe a la ligne).
- Couleur : tous les boutons de la barre sont du meme orange (#cf4400, survol #b33a00). Les boutons
  qui ouvrent un panneau (Code, Simulation, Console, IA) montrent leur etat par un lisere BLANC sous
  le bouton quand le panneau est ouvert. Annuler / Refaire sans rien a annuler sont attenues (opacite
  45 %). Les boutons des menus deroulants et du groupe de zoom restent gris anthracite.
- Les trois menus s'ouvrent au clic, un seul a la fois ; un clic ailleurs les ferme.
- "Envoyer" (vers la carte) et "IA" ne figuraient pas dans la liste demandee : ils ont ete
  conserves, Envoyer apres Capture et IA apres Code.

---------------------------------------------------------
24. BANDEAU IDENTIQUE A LA VERSION ARDUINO R4 (copie d'essai blockly_ts_adacraft_vilain)
---------------------------------------------------------
Le bandeau du haut reprend l'apparence de la version Arduino R4 (modele fourni par le collegue) : memes boutons,
memes menus, meme ordre, memes couleurs. Seul l'habillage change (index.html + bandeau.js, nouveau) : les id et les
fonctions de ce logiciel sont conserves. Ordre, de gauche a droite :
 logo | Affichage (icone ronde : Theme Clair/Sombre, Contraste Normal/Eleve, avec ✓) | Fichier (Nouveau projet,
 Charger .hex, Charger .py, Telecharger .xml [grise], Telecharger .hex, Telecharger .py) | nom du fichier (encadre
 blanc, champ de saisie) | Defaire | Refaire | Capture | Afficher/Masquer la console | Masquer/Afficher la simulation |
 Masquer/Afficher le code | IA | selecteur de carte [grise] | Televerser | Lancer la simulation /
 Arreter | version | Aide (Visite guidee, IA, Mon premier programme [grise], clic droit, Console), tout a droite.
Correspondances (modele -> ce logiciel) : Le "Moniteur serie" du modele est FUSIONNE dans "Console" (la console est le moniteur) : le bouton Console
affiche / masque le panneau et porte un VOYANT de connexion de la carte (anneau vide = non connectee, disque
vert plein = connectee ; la forme change en plus de la couleur) ; la connexion se fait avec "Connecter" dans
l'en-tete de la console (#btn-console-carte, code existant ; le voyant suit sa classe .connecte) ; Televerser = "Envoyer sur la carte" (#btn-envoyer) ; Lancer = #run-sim, Arreter = #btn-reset ; Theme / Contraste =
boutons d'origine #btn-theme / #btn-contraste, caches dans le menu et pilotes par les nouvelles entrees ; Telecharger
.ino = .hex et .py. Absents de ce logiciel, donc GRISES : Telecharger .xml, Mon premier programme.
Selecteur de carte ACTIF : le menu liste les micro:bit deja autorisees (Web Serial, navigator.serial.getPorts, filtre
fabricant 0x0D28 ; nommees micro:bit 1, 2... car le navigateur ne donne pas leur nom) ; ⟳ ouvre la fenetre de choix du
navigateur pour en autoriser une nouvelle ; le bouton Connecter de la console utilise la carte choisie SANS rouvrir la
fenetre (bandeau.js enveloppe navigator.serial.requestPort, un.js n'est pas modifie). Sans carte autorisee, ou hors
Chrome/Edge, comportement d'origine. Ne concerne que la connexion serie : Televerser garde son choix de lecteur.
Specifiques a ce logiciel (absents du modele) : bouton IA (apres Code), Charger .hex / .py, visite Console, version.
Couleurs (charte Technologie Services, qui remplace le turquoise du modele Arduino) : fond ANTHRACITE #303030 (theme
clair) / #262626 (sombre) / noir (contraste eleve), filet ORANGE #ff5501 de 3 px sous le bandeau, coche des menus orange ; Televerser bleu #1c7ed6, Lancer vert
#4caa3c, Arreter rouge. Tient sur une ligne a 1920 px, passe sur deux lignes en dessous (verifie a 1366 px).
bandeau.js (ne modifie aucune fonction existante) : relais des nouveaux boutons, libelles Afficher/Masquer, coches ✓,
bascule Lancer/Arreter. A embarquer dans app.spec (fait).

---------------------------------------------------------
25. PUCES RONDES DE LA COLONNE DE CATEGORIES (copie d'essai)
---------------------------------------------------------
Les bandes rectangulaires de couleur sont remplacees par des puces rondes (12 px, cerclees de blanc ; de noir en
theme clair, pour rester visibles sur la ligne selectionnee qui prend la couleur de la categorie). Blockly pose la
couleur de la categorie en bordure gauche de la ligne : bandeau.js la recopie dans la variable CSS --puce
(colorerPuces, relancee quand la boite a outils est reconstruite), et index.html supprime la bordure et dessine la
puce (.blocklyTreeRow::before). Les couleurs elles-memes (§21) ne changent pas.

---------------------------------------------------------
26. ORDRE DES CATEGORIES (copie d'essai)
---------------------------------------------------------
Ordre par defaut de la colonne (table ORDRE_CATEGORIES, un.js, appliquee par reordonnerToolbox avant la couleur) :
Boucles, Temps, Affichage, Entrees/Sorties, Capteurs, Actionneurs (Audio), Servos, Radio, IA, Grove, Logique, Variables, Maths, Texte, Fonctions, Listes, puis
"Robots", categorie parente dont les sous-menus sont
Maqueen Plus, Maqueen Lite, Kitrobot v2 et LiDAR (liste NOMS_ROBOTS ; construite par reordonnerToolbox, meme principe
que Grove et Radio : leurs blocs, couleurs et noms sont inchanges ; verifie : les 4 sous-menus affichent leurs blocs).
- "Communication" est renommee "Radio" (le nom est change dans la boite a outils ; le panneau administrateur la
  designe donc "Radio" ; une configuration administrateur deja enregistree dans le navigateur prime sur cet ordre :
  la reinitialiser dans le panneau administrateur pour retrouver l'ordre par defaut).
- "Listes" (nouvelle) : blocs de listes standards de Blockly - creer une liste (3 elements, vide), repeter, longueur, est
  vide, position de, obtenir / definir un element, sous-liste. Le code MicroPython genere (listes, len, tranches, une
  fonction first_index) a ete execute dans le simulateur (resultats justes) ; PAS verifie sur une vraie carte.
- "Graphique" (demandee) n'existe pas : non creee, contenu a definir.
- Couleurs (§21) : Maths passe au rouge, Listes au turquoise, pour que deux categories voisines restent differentes.
Sous-categories (Radio, Grove, Robots) : leur puce et leur texte sont decales de 14 px vers la droite par rapport aux
categories de premier niveau (regle .blocklyToolboxCategory .blocklyToolboxCategory, index.html).

---------------------------------------------------------
27. RECHERCHE DE BLOCS (copie d'essai)
---------------------------------------------------------
Une zone « Rechercher un bloc… » est collee en haut de la colonne de categories (au-dessus de Boucles ; elle reste
visible quand la colonne defile). Taper un ou plusieurs mots affiche les blocs correspondants dans le tiroir, comme une
categorie : ils se prennent et se deposent normalement. Le tiroir de resultats RESTE OUVERT apres un depot (flyout.autoClose = false pendant la
recherche : on peut prendre plusieurs blocs d'affilee) ; Echap ou effacer le texte le ferme ; choisir une categorie vide la
recherche et rend aux categories leur comportement normal (le tiroir se referme apres un depot).
- Texte cherche : ce qui s'affiche sur le bloc (« attendre ... secondes »), le nom de sa categorie (Radio, Robots...) puis,
  en second rang, son texte d'aide. Sans accents ni majuscules ; tous les mots doivent etre presents ; 40 resultats au plus.
- Portee : les 211 blocs de la boite a outils d'origine, sous-categories comprises (meme ceux d'une categorie masquee par le
  panneau administrateur) + les tiroirs VARIABLES et FONCTIONS, generes a la volee par Blockly et donc interroges a chaque
  recherche (blocsDynamiques) : le bouton « Creer une variable… », les blocs mettre / changer / valeur d'une variable, les
  definitions de fonctions et l'appel de chaque fonction deja creee. Comme dans le tiroir normal, les blocs de variable
  n'existent qu'apres la creation d'une premiere variable. Des synonymes sont ajoutes a ces blocs (mettre, definir, changer,
  ajouter, appeler, lancer, creer, retourner...) car leur libelle francais ne les contient pas.
- Code : bandeau.js (index construit au premier usage, ~50 ms ; utilise toolbox.getFlyout().show) et style #recherche-blocs
  dans index.html. Aucune fonction existante n'est modifiee.
Puces « pechues » : la puce n'a plus la couleur sombre des blocs mais une variante plus vive (meme teinte ; saturation +25 points,
luminosite relevee a 52-62 %), de 18 px, avec un reflet (degrade radial), un cercle blanc et une legere lueur coloree, pour
ressortir sur le fond anthracite. Calcul dans bandeau.js (variantePuce -> variables --puce et --puce-reflet) ; les couleurs
des BLOCS (§21) ne changent pas.
Police de la colonne de categories : 'Segoe UI', Arial, sans-serif (variable --font), comme le reste de l'interface ; elle etait auparavant la police sans empattement par defaut du navigateur (16 px, inchange).

---------------------------------------------------------
28. POLICES (copie d'essai)
---------------------------------------------------------
Segoe UI (repli Arial) partout : page (body), bandeau, colonne de categories, recherche, titres de panneaux, console (etat),
boutons / champs / listes (font-family: inherit), bandeau d'etat, visites guidees, aide, panneau administrateur, et TEXTE DES
BLOCS (reglee dans les themes Blockly : constante POLICE_BLOCS, 11 pt, un.js ; Blockly mesure le texte avec cette police pour
dimensionner les blocs, d'ou le reglage par le theme et non par le CSS). Le theme « clair normal » est maintenant derive de
Classic (THEME_CLAIR_NORMAL) pour porter cette police.
Gardent leur police propre : le CODE (Consolas, repli monospace : transcription, editeur de code, aide technique) et la CONSOLE
(Consolas, DejaVu Sans Mono), ainsi que les dessins de la carte micro:bit et des robots. Les petits espaces de travail d'exemple
de la fenetre d'aide gardent la police par defaut de Blockly.

---------------------------------------------------------
29. COULEURS : UNE PAR CATEGORIE (copie d'essai ; remplace la palette a 7 couleurs du §21)
---------------------------------------------------------
Demande : aucune couleur identique entre deux categories. PALETTE_CATEGORIES (un.js) contient maintenant 17 couleurs toutes
differentes (une par categorie de premier niveau), choisies par echantillonnage du point le plus eloigne dans l'espace CIE Lab :
ecart minimal de 26 entre deux couleurs, mesure sur les blocs ET sur les puces vives ; assez sombres pour le texte blanc des blocs ;
attribuees pour que deux categories voisines dans la colonne soient tres differentes (ecart >= 97). Les sous-categories (Radio,
Grove, Robots) heritent de leur parent (les entrees propres aux 4 robots ont ete retirees de la table). La puce vive (bandeau.js,
variantePuce) conserve desormais l'ecart de luminosite entre categories (L = 0,36 + 0,62 x L du bloc) pour que les puces restent
distinctes. Valeurs : Boucles #1f5c52, Temps #d50bd5, Affichage #5c521f, Entrees/Sorties #0909b3, Capteurs #915808, Actionneurs
(Audio) #2270bf, Servos #910808, Radio #1c8aa0, IA #d50b70, Grove #178255, Logique #a83896, Variables #678217, Maths #6738a8, Texte
#d53e0b, Fonctions #123668, Listes #089108, Robots #74062b. Limite : l'ecart Lab ne garantit pas la distinction pour un daltonisme.

30. APPARENCE ALIGNEE SUR LA VERSION ARDUINO R4 (copie d'essai ; « Prompt police et couleurs pour un collegue »)
Purement esthetique : aucun nom/ordre de categorie, aucun bloc, aucune fonction modifie. Fichiers touches : index.html (bloc CSS
« APPARENCE ALIGNEE SUR LA VERSION ARDUINO R4 » en fin de <style> ; chaque mode est un jeu de variables --ec-* : sombre = :root,
clair = [data-theme="light"], contraste eleve = [data-contrast="high"] (= sombre + eleve), clair + eleve = les deux), un.js (themes
Blockly : fonds de la zone de programmation / colonne de categories / tiroir, police des blocs = sans-serif par defaut de Blockly,
grille 20/3 #e8e8e8 avec aimantation snap:true) et bandeau.js (table PASTILLES : couleur EXACTE de chaque pastille).
Pastilles (les sous-categories prennent la couleur de leur categorie) : Boucles #FD7E14, Temps #15AABF, Affichage #F03E3E,
Entrees/Sorties #343A40, Radio #1864AB, IA #9C6644, Grove #2B8A3E, Logique #FCC419, Variables #E64980, Maths #82C91E, Texte #7048E8,
Fonctions #CC5DE8, Listes #A61E4D ; sans equivalent Arduino (couleurs proposees) : Capteurs #D2CC79, Actionneurs (Audio) #622D86,
Servos #25F478, Robots #25F4CA. Les COULEURS DES BLOCS ne changent pas (PALETTE_CATEGORIES du §29 les pilote encore seule) : les puces
ne leur sont plus liees. Categories : 12,5 px (sous-categories 11,5 px), gras 600 en contraste eleve, fleche ▸/▾ a la couleur du texte
(le sprite noir de Blockly n'etait pas visible sur fond noir), categorie choisie avec filet gauche #e8a020 (sauf contraste eleve).
Blocs en contraste eleve : clair = fond blanc, bord noir 3 px, texte noir ; sombre = l'inverse. Non aligne : barre d'onglets et
#carte-pane (absents) ; l'accent turquoise du modele n'est pas repris (charte orange du bandeau conservee, survol du separateur compris).

Bandeau du haut : fond ORANGE (clair #ff5501 = charte Technologie Services, sombre #d94700 un peu plus profond), filet bas orange fonce #b33a00 ; en contraste eleve il reste noir. Variables --bandeau / --bandeau-sombre / --accent-fonce (index.html).

Logo (barre d'outils et fenetre d'aide des blocs) et mention « RAJ Editions » retires de index.html ; le numero de version est affiche en derniere ligne du menu Aide (« Version V2.0E »). logo.png n'est plus utilise par la page (il reste dans app.spec, sans effet). Les proprietes du fichier .exe (version_info.txt, CompanyName) gardent « RAJ Editions » : a changer separement si besoin.

31. EXERCICES PAS A PAS ET MODE EVALUATION (copie d'essai)
Fichiers : exercices.js (moteur, charge apres bandeau.js) et exercices.json (les 16 exercices en 5 niveaux, modifiable a la main : voir le champ « aide_enseignant »).
Entrees : menu Aide > « Exercices pas a pas » et « Mode evaluation ». Entrainement : panneau « Mission » deplacable, 3 indices progressifs, solution, validation AUTOMATIQUE
(les blocs sont lus, rien n'est execute), 1 a 3 etoiles (3 = sans indice), exercice suivant verrouille tant que le precedent n'est pas fait ou passe (case « Acces libre »
pour tout deverrouiller). Evaluation : sans indice ni solution, bouton Valider, 3 essais (100 % / 75 % / 50 % des points), duree maximale facultative, note sur 20,
rapport imprimable + export CSV / JSON. Progression : localStorage du navigateur (cle exercices_progression_v1), un profil par nom d'eleve ; export / import JSON
pour regrouper une classe, tableau de classe imprimable et export CSV. Les ids d'exercice (1.1, 2.3...) ne doivent plus changer une fois utilises (la progression s'y rattache).
app.spec embarque exercices.js et exercices.json ; l'exe V2.0E les embarque.

32. IA : APPRENTISSAGE IMMEDIAT, GESTES, POSITIONS, QR CODES (copie d'essai, oct. 2026)
Reprend les points forts de l'IA d'EasyBloc TS (Arduino R4), recrits ici (aucun code d'EasyBloc copie ; seules les bibliotheques
libres MediaPipe et ZXing, licence Apache 2.0, sont reprises dans lib/mediapipe et lib/zxing, 27 Mo et 0,3 Mo).
Fichiers : ia-immediat.js (nouveau, charge apres ia.js), ia.js (renvoi periodique, noyau partage window.iaNoyau), un.js (pilote
MicroPython, blocs, aide, .py), index.html (deux colonnes du panneau IA), app.py (types .mjs et .wasm), app.spec (ia-immediat.js).
- Colonne « Apprentissage immediat » : objets et images (MobileNet v3), gestes de la main (21 points), positions des bras
  (epaules, coudes, poignets). Pas d'entrainement : k plus proches voisins (K = 5, votes moyennes sur 3 images). Exemples par la
  camera (« Maintenir ») ou par des images (🖼). 8 classes, 150 exemples par classe au plus. Les resultats pilotent les blocs
  « vision » ; demarrer l'un arrete l'autre (Teachable Machine ou immediat). Renommer une classe met a jour les blocs.
- Sauvegarde : l'apprentissage (empreintes, jamais d'images) est ajoute a la fin du .py telecharge, en commentaires
  « # >>> apprentissage-ia » ignores par la carte, et relu a l'ouverture du .py. « Exporter » / « Importer » : fichier .json.
  PAS dans le .hex (place limitee, inutile a la carte). Environ 1,4 Ko par exemple d'image, 0,3 Ko par geste.
- Colonne « QR codes » : lecture (QR, EAN, UPC, Code 128/39, Data Matrix) et creation d'un QR code a imprimer (.png).
  Blocs : « lorsqu'un code QR est lu », « un code QR est visible », « texte du dernier code QR lu » (sans accents, 60 car.).
- Plus de doublon : la colonne Vision ne fait plus que CHARGER un modele Teachable Machine (adresse ou 3 fichiers) ;
  toute creation de classes d'images passe par l'apprentissage immediat. Le son garde sa creation (entrainement).
  La visite guidee IA (menu Aide) suit ce nouveau parcours.
- Blocs « l'IA reconnait » : la classe se choisit dans une liste (classes du panneau IA) ou « ✎ autre nom… ».
- Fiabilite : le navigateur renvoie le dernier resultat toutes les 500 ms ; la carte oublie un resultat de plus de 1,5 s.
  Ligne envoyee : IA:<vision|son|qr>:<classe ou texte>:<confiance>.
- Limites : gestes et positions non testes avec une vraie camera dans la session de developpement (modeles charges et
  verifies sur images de synthese) ; la carte peut perdre des lignes si le programme attend longtemps (sleep) avec
  plusieurs IA en marche, sans risque de faux declenchement (ligne illisible = ignoree).
- Evolutions (oct. 2026) :
  * SONS EN APPRENTISSAGE IMMEDIAT : type « sons et mots (micro) ». Sans modele ni entrainement (ia-son-immediat.js) :
    le micro est decoupe en sons (volume au-dessus du bruit de fond), chaque son devient 30 instants x 12 coefficients
    de timbre (MFCC), compares par alignement dans le temps (DTW). Un son reconnu le reste 1 s ; il pilote les blocs
    « son ». Pas de classe « bruit de fond » : le silence ne declenche rien ; un bruit continu de plus de 1,5 s est ignore.
    La colonne Son ne fait plus que charger un modele Teachable Machine (entrainement du son retire, ainsi que
    lib/tm/base, 7,3 Mo, devenu inutile).
  * VIGNETTES : chaque exemple apparait sous sa classe (photo pour les objets, en memoire seulement ; squelette pour les
    gestes et positions ; dessin du timbre pour les sons). CLIQUER sur une vignette supprime cet exemple seul.
    Apres reouverture d'un .py, squelettes et timbres se redessinent, les photos sont remplacees par ▣.
  * RECONSTRUCTION EN BLOCS a l'import d'un .py : « lorsque l'IA reconnait » (vrai nom de classe retrouve parmi les
    classes connues, sinon l'identifiant), « lorsqu'un code QR est lu », et les expressions IA (l'IA reconnait,
    derniere classe, confiance, code QR visible, texte du QR). Les lignes de scrutation (_ia_traiter(), _radio_traiter(),
    _ir_traiter()) et les « pass » des corps vides ne deviennent plus des blocs « code ».

33. BANDEAU SUR UNE LIGNE (oct. 2026)
Le bandeau tient sur une seule ligne des 1536 px de large (ecran 1920 px avec affichage Windows a 125 %, zoom du
navigateur 100 %), y compris dans le cas le plus long (console, simulation et code affiches : 39 px de reserve).
Reglages (index.html) : boutons 5 x 6 px de marge interieure, ecart 2 px, separateurs 2 px, nom du programme 84 px,
Televerser et Lancer la simulation un peu moins larges. En dessous (1366, 1280 px), il passe sur deux lignes sans
couper de bouton. Aucun bouton ni libelle retire.

34. LOGO TECHNOLOGIE SERVICES (oct. 2026)
Le logo de Technologie Services (logo_ts.png, 360 x 100 px, telecharge de technologieservices.fr) est affiche en haut a
gauche du bandeau, sur une pastille blanche (texte noir et icone orange illisibles directement sur l'orange), 24 px de
haut. Pour lui laisser la place sans repasser sur deux lignes a 1536 px, Defaire et Refaire n'ont plus que leur icone
(fleches ; le libelle reste dans l'info-bulle et pour les lecteurs d'ecran). logo_ts.png est dans app.spec et site_web.

35. UN SEUL BOUTON « LANCER LA SIMULATION » (oct. 2026)
Le bouton orange du panneau de simulation (#run-sim) faisait doublon avec le bouton vert du bandeau (#tb-lancer) : il est
masque (display: none), pas supprime, car c'est lui que le bandeau clique (bandeau.js) et que le simulateur Brython ecoute.
Restent sous la carte : « Secouer la carte » et « Reinitialiser la simulation ». Les visites guidees visent le bouton vert.

36. DISPOSITION AU LANCEMENT (oct. 2026)
L'application s'ouvre avec : simulation affichee, code MicroPython MASQUE (bouton « Afficher le code »), console et IA
masquees. Code masque, le simulateur occupe 37 % de la largeur (au lieu de 24 %) : les boutons « Secouer la carte » et
« Reinitialiser la simulation » se placent a droite de la carte, et la poignee de redimensionnement est active d'emblee.
Reglage : classes inactif / replie dans index.html (#btn-vue-code, #code-container), regle CSS
#code-container.replie ~ #simulator-container, et synchroniserResizerSimulateur() appele au demarrage (un.js).

37. DESSIN DES SERVOMOTEURS (oct. 2026)
Le cadran rond du panneau « Servomoteurs » est remplace par un servo vu de dessus (modele A, choisi parmi 4 propositions) :
boitier bleu type SG90 a deux oreilles, palonnier blanc qui tourne autour de l'axe (90 deg = palonnier vers le haut,
0 deg a gauche, 180 deg a droite). Rotation continue : le palonnier tourne sans fin (sens et vitesse selon la vitesse).
Arret : boitier et palonnier gris. Dessin SVG cree par cadranServo() (un.js), styles .servo-* (index.html) ; le rotor
tourne avec transform-box: view-box et transform-origin: 42px 52px (unites du dessin).

38. GROVE : POTENTIOMETRE (oct. 2026)
Nouvelle sous-categorie Grove « Potentiometre » (Grove Rotary Angle Sensor), apres « Joystick ». Un bloc :
« potentiometre sur [broche] en [valeur 0 a 1023 / angle 0 a 300 deg / pourcentage 0 a 100 %] ». A brancher sur P0, P1
ou P2 (entrees analogiques). Code : pilote « potentiometre » (_grove_potentiometre(broche, unite), read_analog() puis
conversion). Simulateur : module Grove dessine (modele A, choisi parmi 4 propositions : carte bleue, bouton gris a repere
blanc) dont on tourne le bouton a la souris (butees a 0 et 300 deg), plus un curseur dessous (clavier, reglage fin) ;
valeur et angle affiches ; substitut
_grove_potentiometre dans index.html. Aide du bloc, exemple « Angle du potentiometre », reconstruction a l'import d'un .py.

39. GROVE : PREMIER LOT DE MODULES (oct. 2026)
Six modules ajoutes au menu Grove, chacun dans sa sous-categorie, avec aide (clic droit), exemple, section du panneau
Grove du simulateur et reconstruction en blocs a l'import d'un .py :
- Bouton poussoir (numerique) : « bouton poussoir sur Px appuye » et « lorsque le bouton poussoir sur Px est appuye »
  (une fois par appui, front montant : _grove_bouton_front, scrute a chaque tour comme les autres « lorsque »).
  Simulateur : bouton rouge « Appuyer » (enfonce tant qu'on le maintient) et case « maintenu enfonce ».
- Capteur de lumiere (analogique, P0/P1/P2) : valeur 0 a 1023 ou pourcentage. Simulateur : curseur.
- Detecteur de mouvement PIR (numerique) : « mouvement detecte sur Px ». Simulateur : module Grove dessine (dome blanc,
  voyant rouge), un clic ou Entree simule un mouvement ; la case « mouvement detecte » reste dessous.
- Buzzer (actif, numerique) : marche / arret, et « bip pendant ... ms ». Simulateur : pastille orange qui vibre et bip
  de 2,3 kHz a faible volume ; le buzzer se tait a l'arret de la simulation.
- Relais (numerique) : ferme (marche) / ouvert (arret). Simulateur : un module Grove dessine par broche (boitier
  RELAY bleu, bornier vert), voyant rouge allume quand le contact est ferme.
- Ecran OLED 0,96" 128 x 64 (I2C 0x3C, SSD1315 / SSD1306) : initialiser, afficher un texte en colonne (0 a 20) et ligne
  (0 a 7), effacer. Mode texte sans memoire d'image (compatible V1) : police 5 x 7 (ASCII 32 a 126) envoyee caractere
  par caractere ; accents ramenes a la lettre simple. Le simulateur dessine l'ecran avec la meme police (POLICE_OLED).
A verifier avec le materiel : niveaux logiques des modules reels (bouton et PIR actifs a l'etat haut, buzzer actif),
et l'ecran OLED (sequence d'initialisation SSD1306 ; la version SSD1308 plus ancienne n'a pas ete testee).

40. GROVE : DEUXIEME LOT DE MODULES (oct. 2026)
Cinq modules, meme organisation que le premier lot (sous-categorie, aide, exemple, panneau Grove, reconstruction .py) :
- Barre de LED (Grove LED Bar v2.0, MY9221) : niveau 0 a 10, LED n allumee / eteinte. Branchee sur un port Grove a deux
  broches (P0/P14, P1/P15, P2/P16, P8/P12) : broche jaune = donnees, blanche = horloge (bibliotheque Seeed).
  Simulateur : barre dessinee (LED 1 rouge, 2 orange, 3 a 10 vertes).
- Pression BMP280 (I2C 0x77) : pression (hPa), temperature (C), altitude (m, par rapport a 1013,25 hPa). Formules de
  compensation Bosch en virgule flottante. Simulateur : curseur « Pression » (+ curseur de temperature existant).
- Qualite de l'air SGP30 (I2C 0x58) : eCO2 (ppm), COV totaux (ppb) ; 400 ppm / 0 ppb pendant les 15 premieres secondes.
  Simulateur : curseur « COV totaux » (+ curseur CO2 existant pour l'eCO2).
- Horloge temps reel DS1307 / DS3231 (I2C 0x68) : regler date et heure, lire heure / minute / seconde / jour / mois /
  annee, heure en texte « hh:mm:ss ». Simulateur : heure du PC decalee de ce que le programme a regle, afficheur
  qui avance chaque seconde.
- Pilote 16 servos PCA9685 (I2C 0x7F pour le module Grove, 0x40 pour les autres cartes) : angle (0 a 180) ou rotation
  continue (-100 a 100 %) du servo de la voie 0 a 15, a 50 Hz. Simulateur : servos S0 a S15 dans la zone « Servomoteurs ».
DHT20 : deja pris en charge par « Temperature & humidite » (meme puce que l'AHT20, adresse 0x38).
A verifier avec le materiel : sens des broches de la barre de LED, adresses I2C reelles des modules, et chaque pilote
(aucun n'a pu etre essaye sur une carte).

41. CAPTEURS A CURSEUR : MODULES ET AFFICHEURS (oct. 2026)
Modele C (choisi parmi 3 propositions) pour tous les capteurs reglables du panneau Grove : ultrason, temperature et
humidite, CO2, lumiere, pression, COV. Chaque section montre un petit module Grove dessine (composant propre a chaque
capteur), un afficheur numerique vert sur fond noir avec la valeur et son unite, et le curseur dessous. Les id des
curseurs et des valeurs (grove-temp, grove-temp-val...) sont inchanges : un.js n'a pas eu a changer.

42. SEANCES POUR GROUPES D'ELEVES : DISTRIBUER, RENDRE, RAMASSER (oct. 2026)
Tout passe par des fichiers, deposes la ou l'enseignant depose deja ses documents (ENT, Moodle, dossier partage, cle USB) :
aucun serveur, aucun compte, aucune donnee envoyee par l'application. Fichiers : seances.js (fenetres) et exercices.js
(« mode seance » du moteur d'exercices). Menu Fichier, rubrique « Seance ».

ENSEIGNANT — Fichier > Espace enseignant > Preparer une seance
- Titre, classe, mode : entrainement (indices, solution, etoiles) ou evaluation (sans aide, 3 essais, note sur 20, duree
  maximale facultative).
- Groupes : une ligne par groupe, « Groupe 1 : Lea, Tom » (prenoms facultatifs ; prenoms ou initiales seulement).
- Exercices : cases a cocher dans la banque (exercices.json, bouton « tout » par niveau), et/ou « Ajouter un exercice a
  partir du programme ouvert » : titre, consigne, indices, points, et le programme de l'editeur sert de
    * solution avec controle automatique (l'eleve doit utiliser au moins autant de blocs de chaque type, hors
      au demarrage, repeter, nombres et textes ; les valeurs ne sont pas comparees),
    * solution corrigee par l'enseignant (l'eleve clique « J'ai termine »),
    * point de depart pour l'eleve (corrige par l'enseignant).
- « Telecharger la seance » : fichier seance_<classe>_<titre>.json, a deposer sur l'ENT. « Ouvrir une seance a
  modifier » la recharge ; retelechargee, elle garde son identifiant (les eleves retrouvent leur travail).
  La seance en preparation est gardee sur le poste (brouillon).

ELEVE — Fichier > Ouvrir une seance
- Choisir le fichier, son groupe, cocher ou ecrire son prenom (ou ceux du binome). Entrainement : liste des exercices
  de la seance (tous ouverts) ; evaluation : elle demarre aussitot.
- Le programme de chaque exercice est memorise automatiquement (reprise en revenant sur l'exercice, et apres un
  rechargement de la page : la seance reste ouverte).
- « Rendre mon travail » (menu Fichier, liste des exercices, panneau Mission, rapport d'evaluation) : telecharge
  <classe>_<groupe>_<prenoms>_<titre>.rendu.json, a deposer sur l'ENT. On peut rendre plusieurs fois.
- « Quitter la seance » (menu Fichier) : retour aux exercices habituels ; le travail reste sur le poste.

ENSEIGNANT — Fichier > Espace enseignant > Ramasser les travaux
- Glisser les fichiers .rendu.json sur la fenetre (ou les choisir, plusieurs a la fois). Un groupe qui a rendu plusieurs
  fois : seul le fichier le plus recent est garde. Les fichiers qui ne sont pas des rendus sont signales.
- Un tableau par seance : groupe, eleves, chaque exercice (✔ reussi et etoiles, ✎ a corriger, … commence, ↷ passe,
  ✘ echec, · non fait), reussis, note sur 20 en evaluation (* = provisoire : les exercices a corriger comptent 0).
- Clic sur une case : le programme de l'eleve s'ouvre dans l'editeur (simulateur, code, telechargement .hex).
- Export CSV (une ligne par eleve : un binome donne deux lignes), impression.
Limite : un poste partage par plusieurs classes garde le travail de chacun separement (par seance), mais tout eleve du
poste peut ouvrir la meme seance avec un autre prenom : la confiance reste de mise (pas d'authentification).

43. MODE CLASSE : LA SEANCE SERVIE PAR LE PC DU PROFESSEUR (solution 2, oct. 2026)
Dossier : blockly_ts_mode_classe (copie Git du projet blockly_ts_adacraft_vilain, qui reste sans mode classe).
Le PC du professeur fait tourner l'application (lancer_projet.bat, ou l'exe) et sert la seance aux postes de la salle :
plus de fichier a deposer sur l'ENT, les travaux arrivent tout seuls. Fichiers : classe.py (serveur), app.py (branchement),
seances.js (fenetres). La solution 1 (fichiers par l'ENT) reste disponible a l'identique.

PROFESSEUR (sur son PC) — Fichier > Espace enseignant > Mode classe
- Choisir la seance : celle en preparation (onglet « Preparer une seance ») ou un fichier de seance ; « Demarrer le mode classe ».
- L'ecran affiche l'adresse a ouvrir sur les postes eleves (http://<adresse du PC>:8000), un code de 5 caracteres (a ecrire
  au tableau) et un QR code de l'adresse (tablettes).
- Suivi en direct (toutes les 3 s) : connecte (vert) ou non, groupe, eleves, exercice en cours, etat de chaque exercice,
  reussis, note (evaluation), rendu definitif et son heure. Un clic sur une case ouvre le programme de l'eleve.
- Les travaux sont enregistres sur le PC dans Documents\MicrobitBlockly\travaux\<date>_<classe>_<titre>\ : un fichier
  .rendu.json par groupe (meme format que la solution 1 : « Ramasser les travaux » sait les relire), toujours le plus recent.
  Boutons : ouvrir ce dossier, export CSV (une ligne par eleve), imprimer, arreter le mode classe.
- Tant que le mode classe est actif, l'exe ne s'arrete pas tout seul quand la page du professeur se ferme.

ELEVE (autre poste de la salle) — ouvrir l'adresse affichee
- La fenetre « Rejoindre » s'ouvre toute seule (sinon Fichier > Rejoindre la seance de la classe) : code, puis groupe et
  prenom(s), comme en solution 1.
- Le travail est envoye au PC du professeur toutes les 20 secondes ; « Rendre mon travail » l'envoie comme rendu definitif
  (« Travail envoye ✔ hh:mm »). Si le reseau ne repond pas, le travail est telecharge dans un fichier, a donner au professeur.

SECURITE ET RESEAU
- Les fonctions du professeur (demarrer, suivre, ouvrir les travaux, arreter) ne repondent qu'au PC lui-meme (127.0.0.1) :
  un poste eleve recoit « reserve au poste de l'enseignant ». Les eleves doivent donner le code ; un travail d'une autre seance,
  mal forme ou trop gros (plus de 3 Mo) est refuse. Aucun mot de passe : le code suffit pour la duree de la seance.
- Le PC et les postes eleves doivent etre sur le meme reseau. A la premiere diffusion, Windows peut demander d'autoriser
  Python (ou l'exe) sur le reseau : accepter pour les reseaux prives. Si les eleves n'arrivent pas a se connecter : pare-feu
  (port 8000), isolement des clients sur le Wi-Fi, ou reseau eleves separe du reseau professeurs -> administrateur reseau.
- Le serveur accepte 128 connexions en attente (au lieu de 5) : une classe entiere charge la page en meme temps.
- Une trentaine de postes chargent chacun environ 5 Mo au demarrage (Blockly, Brython) : quelques secondes sur le reseau
  de la salle. MediaPipe (27 Mo) ne se charge que si l'eleve utilise l'apprentissage immediat.
A verifier en classe : le pare-feu et le reseau de l'etablissement, et la charge avec 30 postes reels.

44. PLATEFORME EN LIGNE AVEC COMPTES (solution 3, oct. 2026)
Dossier : blockly_ts_plateforme (copie Git de blockly_ts_mode_classe : les solutions 1 et 2 restent disponibles).
Les eleves se connectent avec un compte, depuis la classe ou la maison ; le travail est enregistre en ligne.
Fichiers : plateforme/serveur.py (serveur, Python standard + SQLite), plateforme.js (fenetres), plateforme/LISEZMOI.md
(essai, utilisation, installation), plateforme/RGPD.md (modeles : registre, information des familles, liste de controle),
plateforme/deploiement/ (Caddy, systemd, Docker, sauvegarde).
RIEN N'EST EN LIGNE tant que la plateforme n'est pas installee sur un serveur heberge dans l'UE ; la validation RGPD
(chef d'etablissement, DPD) est a faire avant toute utilisation avec des eleves.

ESSAI LOCAL
  python plateforme/serveur.py --creer-enseignant prof@exemple.fr "M. Essai"
  python plateforme/serveur.py            -> http://localhost:8080   (base dans plateforme/donnees/, hors Git)

ENSEIGNANT — Fichier > Plateforme : mes classes
- Classes ; comptes eleves crees en lot a partir des prenoms (identifiant 4eb-lea-01, mot de passe pomme-47-robot) ; fiche
  des identifiants a imprimer ou exporter tout de suite (les mots de passe ne sont plus affiches) ; nouveau mot de passe.
- Seances : la seance preparee dans l'Espace enseignant est publiee dans une classe (republier = mettre a jour) ; ouvrir,
  fermer, supprimer ; suivi en direct (toutes les 5 s), programme d'un eleve dans l'editeur, export CSV.
- Fin d'annee : export complet de la classe (JSON) puis suppression (comptes, seances, travaux).

ELEVE — connexion proposee a l'ouverture
- Fichier > Mes seances en ligne : Commencer / Reprendre ; envoi automatique toutes les 20 s ; « Rendre mon travail ».
- Sur un autre poste ou a la maison, « Reprendre » rapporte les programmes (exercicesSeance.reprendre).
- Se deconnecter efface la seance et le travail du navigateur (poste partage) ; cookie de session efface a la fermeture
  du navigateur ; session eleve de 4 h au plus.
- Eleve connecte : pas d'Espace enseignant (bouton masque, fenetre refusee) ; professeur et visiteur le gardent.

SECURITE : mots de passe haches (scrypt), 10 essais en 10 min, cookie HttpOnly / SameSite / Secure, en-tete X-Plateforme
exige pour toute modification, cloisonnement par enseignant et par classe, identite du travail imposee par le compte,
3 Mo maximum, seuls les fichiers de l'application sont servis.
EVALUATION : la seance envoyee a l'eleve (/api/mes-seances) n'a ni solutions ni indices (serveur.seance_pour_eleve) ;
exercices.json (la banque, avec ses solutions) est refuse (403) aux eleves d'une classe qui a une evaluation ouverte ;
le professeur garde la seance complete (export). En ligne : derriere Caddy (HTTPS), PLATEFORME_COOKIE_SECURE=1
et PLATEFORME_PROXY=1. Sur la plateforme, le signe de vie de l'exe (/_vie) et le mode classe (/_classe/) recoivent 410 :
la page arrete aussitot ses signes de vie.
A verifier : installation reelle (Docker ou systemd, non essayes ici), charge avec plusieurs classes, audit de securite.
