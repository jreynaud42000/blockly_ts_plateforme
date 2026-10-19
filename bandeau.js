// bandeau.js — comportement du bandeau du haut (apparence identique a la version Arduino R4).
//
// AUCUNE fonction existante du logiciel n'est modifiee ni dupliquee : ce fichier ne fait que
//  - relayer les nouveaux boutons du modele vers les boutons / fonctions qui existent deja
//    (#btn-theme, #btn-contraste, #btn-console-carte, #run-sim, #btn-reset...) ;
//  - mettre a jour les libelles variables (Afficher / Masquer la console...) et les coches ✓,
//    en observant l'etat deja tenu par le logiciel (classes, attributs data-theme / data-contrast,
//    window.simuEnCours).
// Les menus deroulants (ouverture / fermeture) restent geres par le code existant (un.js).

const $ = id => document.getElementById(id);
const racine = document.documentElement;

// ---------- Affichage : theme et contraste ----------
// #btn-theme et #btn-contraste (caches) basculent ; on ne les clique que si l'etat voulu differe.
const themeClair = () => racine.dataset.theme === 'light';
const contrasteEleve = () => racine.dataset.contrast === 'high';
function choisirTheme(clair) { if (themeClair() !== clair && $('btn-theme')) $('btn-theme').click(); }
function choisirContraste(eleve) { if (contrasteEleve() !== eleve && $('btn-contraste')) $('btn-contraste').click(); }

function majCoches() {
    const bascule = (id, vrai) => { const b = $(id); if (b) b.classList.toggle('choisi', !!vrai); };
    bascule('aff-theme-clair', themeClair());
    bascule('aff-theme-sombre', !themeClair());
    bascule('aff-contraste-normal', !contrasteEleve());
    bascule('aff-contraste-eleve', contrasteEleve());
}
if ($('aff-theme-clair')) $('aff-theme-clair').addEventListener('click', () => choisirTheme(true));
if ($('aff-theme-sombre')) $('aff-theme-sombre').addEventListener('click', () => choisirTheme(false));
if ($('aff-contraste-normal')) $('aff-contraste-normal').addEventListener('click', () => choisirContraste(false));
if ($('aff-contraste-eleve')) $('aff-contraste-eleve').addEventListener('click', () => choisirContraste(true));
new MutationObserver(majCoches).observe(racine, { attributes: true, attributeFilter: ['data-theme', 'data-contrast'] });
majCoches();

// ---------- Libelles Afficher / Masquer (l'etat « ferme » = classe .inactif, posee par le code existant) ----------
function suivreBascule(idBouton, idLibelle, quandOuvert, quandFerme) {
    const bouton = $(idBouton), libelle = $(idLibelle);
    if (!bouton || !libelle) return;
    const maj = () => { libelle.textContent = bouton.classList.contains('inactif') ? quandFerme : quandOuvert; };
    new MutationObserver(maj).observe(bouton, { attributes: true, attributeFilter: ['class'] });
    maj();
}
suivreBascule('btn-vue-console', 'lib-console', 'Masquer la console', 'Afficher la console');
suivreBascule('btn-vue-simu', 'lib-simulation', 'Masquer la simulation', 'Afficher la simulation');
suivreBascule('btn-vue-code', 'lib-code', 'Masquer le code', 'Afficher le code');

// ---------- Voyant de connexion de la carte (bouton Console) ----------
// Le bouton « Moniteur serie » du modele est fusionne dans « Console » : la console EST le moniteur.
// Le bouton « Console » affiche / masque le panneau ; la connexion se fait avec « Connecter » dans la
// console (#btn-console-carte, code existant). Le voyant reflete l'etat de ce bouton (classe .connecte).
const boutonCarte = $('btn-console-carte');
const voyant = $('voyant-carte');
if (boutonCarte && voyant) {
    const majVoyant = () => {
        const connecte = boutonCarte.classList.contains('connecte');
        voyant.classList.toggle('connecte', connecte);
        const texte = connecte ? 'Carte connectée' : 'Carte non connectée';
        voyant.title = texte;
        voyant.setAttribute('aria-label', texte);
    };
    new MutationObserver(majVoyant).observe(boutonCarte, { attributes: true, attributeFilter: ['class'] });
    majVoyant();
}

// ---------- Lancer la simulation / Arreter ----------
// Lancer = #run-sim ; Arreter = #btn-reset (« Reinitialiser la simulation », qui arrete le programme).
const lancer = $('tb-lancer');
if (lancer) {
    lancer.addEventListener('click', () => {
        const cible = window.simuEnCours === true ? $('btn-reset') : $('run-sim');
        if (cible) cible.click();
    });
    let enCours = null;
    setInterval(() => {
        const maintenant = window.simuEnCours === true;
        if (maintenant === enCours) return;
        enCours = maintenant;
        lancer.classList.toggle('running', maintenant);
        if ($('tb-lancer-label')) $('tb-lancer-label').textContent = maintenant ? 'Arrêter' : 'Lancer la simulation';
        const icone = $('tb-lancer-icone');
        if (icone) icone.innerHTML = maintenant ? '<rect x="5" y="5" width="14" height="14" rx="1"/>' : '<polygon points="5,3 19,12 5,21"/>';
    }, 250);
}

// ---------- Selecteur de carte (menu + « rechercher les cartes ») ----------
// Web Serial memorise les cartes deja autorisees (navigator.serial.getPorts). Le menu les liste ; ⟳ ouvre la
// fenetre de choix du navigateur pour en autoriser une nouvelle (requestPort). Le bouton « Connecter » de la
// console (code existant, un.js) appelle navigator.serial.requestPort a chaque clic : on y intercale un relais
// qui renvoie directement la carte choisie dans le menu, sans rouvrir la fenetre. Sans carte choisie, ou si le
// relais ne s'applique pas, la fenetre de choix habituelle s'ouvre (comportement d'origine).
// Le choix ne concerne que la connexion serie : « Televerser » garde son propre choix de lecteur MICROBIT.
const VENDEUR_MICROBIT = 0x0D28;
const choix = $('port-select'), rechercher = $('port-refresh');
let serialActif = null;           // objet navigator.serial utilise (parametrable pour les tests)
let cartes = [];                  // ports connus (SerialPort), dans l'ordre du menu
let appelInterne = false;         // vrai pendant NOTRE appel a requestPort (ne pas le detourner)
const dejaEnveloppe = new WeakSet();

const estMicrobit = port => { try { return port.getInfo().usbVendorId === VENDEUR_MICROBIT; } catch (e) { return false; } };
const carteChoisie = () => { const i = choix ? parseInt(choix.value, 10) : NaN; return Number.isInteger(i) ? cartes[i] || null : null; };

function remplirCartes(aSelectionner) {
    if (!choix) return;
    const ancienne = aSelectionner || carteChoisie();
    choix.textContent = '';
    if (!cartes.length) {
        const o = document.createElement('option'); o.value = ''; o.textContent = 'micro:bit'; choix.appendChild(o);
        choix.title = 'Aucune carte autorisée : cliquez ⟳ ou « Connecter » dans la console pour en choisir une';
        return;
    }
    cartes.forEach((port, i) => {
        const o = document.createElement('option');
        o.value = String(i); o.textContent = cartes.length > 1 ? 'micro:bit ' + (i + 1) : 'micro:bit';
        choix.appendChild(o);
    });
    const idx = ancienne ? cartes.indexOf(ancienne) : -1;
    choix.value = String(idx >= 0 ? idx : 0);
    choix.title = 'Carte à connecter (appliqué au prochain « Connecter ») — ' + cartes.length + ' carte(s) autorisée(s)';
}

async function chargerCartes(aSelectionner) {
    if (!serialActif) return;
    try { cartes = (await serialActif.getPorts()).filter(estMicrobit); } catch (e) { cartes = []; }
    remplirCartes(aSelectionner);
}

function demarrerCartes(serial) {
    serialActif = serial || null;
    if (!choix || !rechercher) return;
    if (!serialActif) {
        choix.disabled = true; rechercher.disabled = true;
        $('port-group').title = 'Cartes micro:bit : demande Chrome ou Edge (Web Serial)';
        return;
    }
    choix.disabled = false; rechercher.disabled = false;
    if (!dejaEnveloppe.has(serialActif)) {
        dejaEnveloppe.add(serialActif);
        const origine = serialActif.requestPort.bind(serialActif);
        serialActif.requestPort = async function (options) {
            if (!appelInterne) {
                const deja = carteChoisie();
                if (deja) return deja;                                   // carte choisie dans le menu : pas de fenetre
            }
            const port = await origine(options);                          // fenetre de choix du navigateur
            if (!appelInterne && estMicrobit(port)) chargerCartes(port); // la carte autorisee apparait dans le menu
            return port;
        };
        serialActif.addEventListener('connect', () => chargerCartes());
        serialActif.addEventListener('disconnect', () => chargerCartes());
    }
    chargerCartes();
}

if (rechercher) {
    rechercher.addEventListener('click', async () => {
        if (!serialActif || rechercher.classList.contains('occupe')) return;
        rechercher.classList.add('occupe');
        appelInterne = true;
        try {
            const port = await serialActif.requestPort({ filters: [{ usbVendorId: VENDEUR_MICROBIT }] });
            await chargerCartes(port);
        } catch (e) {
            /* fenetre fermee sans choix (NotFoundError) : rien a faire */
        } finally {
            appelInterne = false;
            rechercher.classList.remove('occupe');
        }
    });
}
demarrerCartes('serial' in navigator ? navigator.serial : null);
window.bandeauTest = { demarrerCartes, chargerCartes, cartes: () => cartes };

// ---------- Puces rondes de la colonne de categories ----------
// Blockly colore chaque categorie par la bordure gauche de sa ligne (rectangle). On recopie cette couleur dans
// --puce (variable CSS) pour dessiner une puce ronde a la place ; la bordure est supprimee par le CSS (index.html).
// La puce a EXACTEMENT la couleur des blocs de sa categorie (table PALETTE_CATEGORIES, un.js) ; une sous-categorie
// prend la couleur de sa categorie principale.
function colorerPuces() {
    document.querySelectorAll('.blocklyToolboxCategory .blocklyTreeRow').forEach(ligne => {
        const base = getComputedStyle(ligne).borderLeftColor;
        if (!base || ligne.dataset.puceBase === base) return;
        ligne.dataset.puceBase = base;
        ligne.style.setProperty('--puce', base);
    });
}
colorerPuces();
const boiteOutils = document.querySelector('.blocklyToolboxDiv');
if (boiteOutils) {
    // La boite a outils est reconstruite (panneau administrateur, changement de langue...) : on recolore.
    new MutationObserver(colorerPuces).observe(boiteOutils, { childList: true, subtree: true });
}

// ---------- Recherche de blocs (au-dessus de la premiere categorie) ----------
// Zone de saisie placee en haut de la colonne de categories. Elle cherche dans TOUS les blocs de la boite a outils
// d'origine (toutes categories, sous-categories comprises) et affiche les resultats dans le tiroir, comme une
// categorie : les blocs se prennent et se deposent normalement. Le texte cherche = ce qui s'affiche sur le bloc
// (« attendre ... secondes »), le nom de sa categorie et, en second rang, son texte d'aide.
// Variables et Fonctions (tiroirs generes a la volee) sont interroges a chaque recherche (voir blocsDynamiques).
const normaliser = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let indexBlocs = null;                 // [{ def, texte, aide, categorie }]

function parcourirBoite(contenus, chemin, sortie) {
    for (const e of contenus || []) {
        if (e.kind === 'category') parcourirBoite(e.contents, chemin.concat(e.name), sortie);
        else if (e.kind === 'block' && e.type) sortie.push({ def: e, chemin });
    }
}

function construireIndex() {
    const ws = window.workspace;
    const arbre = ws && ws.options && ws.options.languageTree;
    const brut = [];
    if (arbre) parcourirBoite(arbre.contents, [], brut);
    const aides = (window.aideBlocTest && window.aideBlocTest.AIDE_BLOCS) || {};
    const scratch = new Blockly.Workspace();
    const resultat = [];
    for (const { def, chemin } of brut) {
        let texte = '';
        try {
            const b = Blockly.serialization.blocks.append(def, scratch);
            texte = b.toString(200, '?');
            b.dispose(false);
        } catch (erreur) { texte = def.type; }
        const nomCategorie = chemin.map(c => c === 'Communication' ? 'Radio' : c).join(' ');
        resultat.push({ def, texte: normaliser(texte + ' ' + def.type.replace(/_/g, ' ')), aide: normaliser(aides[def.type] || ''), categorie: normaliser(nomCategorie) });
    }
    scratch.dispose();
    return resultat;
}

// Variables et Fonctions : tiroirs generes par Blockly a la volee (selon les variables et fonctions creees). On interroge
// les memes generateurs que la boite a outils a chaque recherche, pour que le bouton « Creer une variable… », les blocs
// de variables et les appels des fonctions deja definies soient trouvables.
// Mots que l'on pense a taper pour ces blocs mais qui ne figurent pas dans leur libelle francais (« definir x a », « incrementer »...).
const SYNONYMES_DYNAMIQUES = {
    variables_set: 'mettre definir affecter donner valeur variable',
    variables_get: 'variable valeur lire utiliser',
    math_change: 'changer ajouter augmenter incrementer variable',
    procedures_defnoreturn: 'creer definir nouvelle fonction procedure',
    procedures_defreturn: 'creer definir nouvelle fonction retour resultat renvoyer',
    procedures_ifreturn: 'retourner renvoyer si fonction',
    procedures_callnoreturn: 'appeler appel executer lancer fonction procedure',
    procedures_callreturn: 'appeler appel utiliser resultat fonction procedure',
};
function blocsDynamiques() {
    const ws = window.workspace;
    const liste = [];
    const ajouter = (generateur, categorie) => {
        let defs = [];
        try { defs = Blockly.utils.toolbox.convertFlyoutDefToJsonArray(generateur(ws)); } catch (erreur) { return; }
        const scratch = new Blockly.Workspace();
        try { ws.getAllVariables().forEach(v => scratch.createVariable(v.name, v.type, v.getId())); } catch (erreur) { /* variables absentes : texte de repli */ }
        for (const def of defs) {
            let texte = '';
            if (String(def.kind).toUpperCase() === 'BUTTON') {
                texte = String(def.text || '').replace(/%\{BKY_(\w+)\}/g, (m, cle) => (Blockly.Msg && Blockly.Msg[cle]) || '');   // %{BKY_NEW_VARIABLE} -> « Creer une variable… »
            } else {
                try {
                    const b = Blockly.Xml.domToBlock(def.blockxml, scratch);
                    texte = b.toString(200, '?');
                    b.dispose(false);
                } catch (erreur) { texte = ''; }
            }
            const synonymes = SYNONYMES_DYNAMIQUES[def.type] || (String(def.kind).toUpperCase() === 'BUTTON' ? 'nouvelle variable ajouter' : '');
            liste.push({ def, texte: normaliser(texte + ' ' + synonymes + ' ' + String(def.type || '').replace(/_/g, ' ')), aide: '', categorie: normaliser(categorie) });
        }
        scratch.dispose();
    };
    ajouter(Blockly.Variables.flyoutCategory, 'Variables');
    ajouter(Blockly.Procedures.flyoutCategory, 'Fonctions');
    return liste;
}

function chercherBlocs(requete) {
    const mots = normaliser(requete).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    if (!indexBlocs) indexBlocs = construireIndex();
    const premier = [], second = [];
    for (const e of indexBlocs.concat(blocsDynamiques())) {
        const base = e.texte + ' ' + e.categorie;
        if (mots.every(m => base.includes(m))) premier.push(e);
        else if (e.aide && mots.every(m => (base + ' ' + e.aide).includes(m))) second.push(e);
    }
    return premier.concat(second).slice(0, 40).map(e => e.def);
}

const zoneRecherche = document.createElement('div');
zoneRecherche.id = 'recherche-blocs';
zoneRecherche.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>' +
    '<input type="search" id="recherche-blocs-champ" placeholder="Rechercher un bloc…" autocomplete="off" spellcheck="false" ' +
    'aria-label="Rechercher un bloc" title="Tapez un mot (« attendre », « LED », « servo »…) : les blocs correspondants s\'affichent">';
const champRecherche = zoneRecherche.querySelector('input');

function installerRecherche() {
    const boite = document.querySelector('.blocklyToolboxDiv');
    if (!boite) return;
    if (zoneRecherche.parentElement !== boite) boite.insertBefore(zoneRecherche, boite.firstChild);
}

let minuterieRecherche = null;
function lancerRecherche() {
    const toolbox = window.workspace && window.workspace.getToolbox && window.workspace.getToolbox();
    if (!toolbox) return;
    const tiroir = toolbox.getFlyout && toolbox.getFlyout();
    if (!tiroir) return;
    const requete = champRecherche.value;
    if (!requete.trim()) {
        if (toolbox.clearSelection) toolbox.clearSelection();
        tiroir.autoClose = true;                 // comportement normal des categories
        tiroir.hide();
        return;
    }
    const blocs = chercherBlocs(requete);
    if (toolbox.clearSelection) toolbox.clearSelection();
    tiroir.autoClose = false;                    // le tiroir de resultats RESTE ouvert apres un depot (Echap ou effacer pour le fermer)
    tiroir.show(blocs.length ? blocs : [{ kind: 'label', text: 'Aucun bloc ne correspond à « ' + requete.trim() + ' »' }]);
}
champRecherche.addEventListener('input', () => { clearTimeout(minuterieRecherche); minuterieRecherche = setTimeout(lancerRecherche, 150); });
champRecherche.addEventListener('keydown', e => {
    if (e.key === 'Escape') { champRecherche.value = ''; lancerRecherche(); e.stopPropagation(); }
});
// Choisir une categorie vide la recherche (le tiroir montre alors cette categorie).
document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('.blocklyToolboxCategory')) {
        if (champRecherche.value) champRecherche.value = '';
        const toolbox = window.workspace && window.workspace.getToolbox && window.workspace.getToolbox();
        const tiroir = toolbox && toolbox.getFlyout && toolbox.getFlyout();
        if (tiroir) tiroir.autoClose = true;     // une categorie se referme apres un depot, comme avant
    }
}, true);

installerRecherche();
{
    const boite = document.querySelector('.blocklyToolboxDiv');
    // La boite a outils est reconstruite (panneau administrateur) : la zone de recherche doit rester en tete.
    if (boite) new MutationObserver(installerRecherche).observe(boite, { childList: true });
}
window.bandeauTest = Object.assign(window.bandeauTest || {}, { chercherBlocs, blocsDynamiques, construireIndex: () => (indexBlocs = construireIndex()) });
