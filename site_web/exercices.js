// exercices.js — exercices pas a pas, progression enregistree et mode evaluation.
//
// Les exercices sont decrits dans exercices.json (a modifier avec un editeur de texte, voir « aide_enseignant »).
// Ce fichier ne contient que le moteur :
//   - un panneau « Mission » (consigne, indices progressifs, solution, validation automatique) ;
//   - une fenetre de liste (niveaux, etoiles, exercices verrouilles tant que le precedent n'est pas fait) ;
//   - la progression de chaque eleve, enregistree dans le navigateur (localStorage), exportable / importable ;
//   - le mode evaluation (sans indice ni solution, 3 essais, chronometre, note sur 20, rapport imprimable / CSV).
// Rien ici ne modifie les blocs, les generateurs ou la simulation : le moteur LIT les blocs du plan de travail
// (window.workspace) et ne les change que pour (re)poser l'espace de depart ou la solution d'un exercice.
//
// Mode SEANCE (seances.js) : l'enseignant distribue un fichier de seance (exercices choisis, groupes, mode).
// Le moteur prend alors ses exercices dans la seance au lieu de exercices.json, garde la progression a part
// (cle de stockage propre a la seance), memorise le programme de l'eleve pour chaque exercice, accepte des
// exercices sans controle automatique (« J'ai termine », correction par l'enseignant) et fabrique le fichier
// « rendu » (window.exercicesSeance.rendu()).

const CLE = 'exercices_progression_v1';
const NOM_DEFAUT = 'Élève';
const ESSAIS_MAX = 3;                       // evaluation : nombre d'essais de validation par exercice
const PART_POINTS = [1, 0.75, 0.5];         // evaluation : part des points selon le numero de l'essai reussi
const $ = (sel, racine = document) => racine.querySelector(sel);
const ws = () => window.workspace;
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const etoiles = n => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---------------------------------------------------------------- donnees (localStorage)
let seance = null;       // { def, eleves: [...], groupe } quand une seance est ouverte (seances.js)
const cleStockage = () => (seance ? CLE + ':seance:' + seance.def.id : CLE);
function lire() {
    try {
        const d = JSON.parse(localStorage.getItem(cleStockage()) || 'null');
        if (d && typeof d === 'object') return Object.assign({ profil: NOM_DEFAUT, libre: false, profils: {}, evaluations: [] }, d);
    } catch (erreur) { /* donnees illisibles : on repart de zero */ }
    return { profil: NOM_DEFAUT, libre: false, profils: {}, evaluations: [] };
}
let donnees = lire();
function sauver() { try { localStorage.setItem(cleStockage(), JSON.stringify(donnees)); } catch (erreur) { /* navigation privee */ } }
function profil(nom = donnees.profil) {
    if (!donnees.profils[nom]) donnees.profils[nom] = { faits: {} };
    return donnees.profils[nom];
}

// ---------------------------------------------------------------- exercices
let defs = null;          // contenu de exercices.json
let plat = [];            // tous les exercices, dans l'ordre, avec leur niveau
async function chargerExercices() {
    if (defs) return defs;
    if (seance) {
        defs = { titre: 'Séance « ' + seance.def.titre + ' »',
                 niveaux: [{ id: 'seance', titre: seance.def.titre, notion: seance.def.classe || '', exercices: seance.def.exercices || [] }] };
        plat = defs.niveaux[0].exercices.map(e => Object.assign({ niveau: defs.niveaux[0], points: 1 }, e));
        return defs;
    }
    try {
        const reponse = await fetch('exercices.json', { cache: 'no-store' });
        if (reponse.status === 403) {        // plateforme en ligne : banque refusee aux eleves pendant une evaluation
            alert('Les exercices d\'entraînement ne sont pas disponibles pendant une évaluation de ta classe.');
            return null;
        }
        if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
        defs = await reponse.json();
        plat = [];
        for (const n of defs.niveaux || []) for (const e of n.exercices || []) plat.push(Object.assign({ niveau: n, points: 1 }, e));
    } catch (erreur) {
        defs = null;
        alert('Les exercices n\'ont pas pu être chargés (fichier exercices.json introuvable ou invalide).\n' + erreur.message);
    }
    return defs;
}
const exo = id => plat.find(e => e.id === id);
const fait = id => profil().faits[id];
const accessible = i => donnees.libre || i === 0 || !!fait(plat[i - 1].id);

// ---------------------------------------------------------------- lecture des blocs (validation)
const blocs = () => (ws() ? ws().getAllBlocks(false) : []);
const descendants = b => b.getDescendants(false).filter(x => x !== b);
const textesDe = b => b.getDescendants(false).filter(x => x.type === 'text').map(x => String(x.getFieldValue('TEXT') || ''));

// Un bloc correspond-il a la description ? (voir « aide_enseignant » de exercices.json)
function correspond(b, s) {
    if (typeof s === 'string') s = { bloc: s };
    if (s.bloc && ![].concat(s.bloc).includes(b.type)) return false;
    if (s.champ) for (const [nom, valeur] of Object.entries(s.champ)) if (String(b.getFieldValue(nom)) !== String(valeur)) return false;
    if (s.dans && !s.dans.includes(b.getRootBlock().type)) return false;
    if (s.ancetre) {
        const types = [].concat(s.ancetre);
        let p = b.getParent(), trouve = false;
        while (p) { if (types.includes(p.type)) { trouve = true; break; } p = p.getParent(); }
        if (!trouve) return false;
    }
    if (s.leds_min != null) {
        const allumees = b.inputList.reduce((n, i) => n + i.fieldRow.filter(f => /^LED_/.test(f.name || '') && f.getValue() === 'TRUE').length, 0);
        if (allumees < s.leds_min) return false;
    }
    if (s.entrees) {
        for (const [nom, valeur] of Object.entries(s.entrees)) {
            const cible = b.getInputTargetBlock(nom);
            if (!cible || Number(cible.getFieldValue('NUM')) !== Number(valeur)) return false;
        }
    }
    if (s.texte_sauf != null && !textesDe(b).some(t => t.trim() && t.trim() !== s.texte_sauf)) return false;
    if (s.contient) {
        const fils = descendants(b);
        for (const sous of [].concat(s.contient)) if (!fils.some(d => correspond(d, sous))) return false;
    }
    return true;
}
function regleOk(r) {
    if (!r) return false;
    if (r.tous) return r.tous.every(regleOk);
    if (r.ou) return r.ou.some(regleOk);
    return blocs().filter(b => correspond(b, r)).length >= (r.min || 1);
}

// ---------------------------------------------------------------- espace de travail
const BLOCS_DEPART = [{ type: 'au_demarrage', x: 40, y: 40, next: { block: { type: 'boucle_infinie' } } }];
function charger(blocsJson, variables) {
    const etat = { blocks: { languageVersion: 0, blocks: blocsJson } };
    if (variables) etat.variables = variables;
    Blockly.serialization.workspaces.load(etat, ws());
}
const espaceVierge = () => !blocs().some(b => !['au_demarrage', 'boucle_infinie'].includes(b.type));
function reinitialiserEspace() { charger(BLOCS_DEPART); }
// Seance : on reprend le programme deja commence par l'eleve pour cet exercice, sinon ses blocs de depart.
function espaceDe(e, reprendre = true) {
    const p = profil().programmes && profil().programmes[e.id];
    if (seance && reprendre && p && p.blocs) { Blockly.serialization.workspaces.load(p.blocs, ws()); return; }
    if (e.depart && e.depart.blocks) { charger(e.depart.blocks, e.depart.variables); return; }
    reinitialiserEspace();
}
// Seance : programme de l'eleve memorise pour chaque exercice (blocs + code Python), pour le fichier rendu.
let memo = null;
function memoriserProgramme(id) {
    if (!seance || !id || !ws()) return;
    const p = profil();
    p.programmes = p.programmes || {};
    p.programmes[id] = { blocs: Blockly.serialization.workspaces.save(ws()),
                         python: window.genererCodeTest ? window.genererCodeTest(ws()) : '', date: new Date().toISOString() };
    sauver();
}
function idEnCours() {
    if (!session) return null;
    return session.mode === 'tp' ? session.id : (session.termine ? null : session.liste[session.idx]);
}

// ---------------------------------------------------------------- session en cours
let session = null;      // { mode:'tp'|'eval', ... }
let minuteur = null, verif = null;

function stopMinuteur() { if (minuteur) { clearInterval(minuteur); minuteur = null; } }

function confirmerRemplacement() {
    if (session || espaceVierge()) return true;
    return confirm('Les exercices démarrent sur un espace de travail vierge : votre programme actuel sera remplacé.\n' +
        '(Enregistrez-le d\'abord avec « Fichier » si vous voulez le garder.)\n\nContinuer ?');
}

async function lancerExercice(id) {
    if (!(await chargerExercices())) return;
    const e = exo(id);
    if (!e) return;
    if (session && session.mode === 'eval') return;
    if (!confirmerRemplacement()) return;
    if (session && session.mode === 'tp') memoriserProgramme(session.id);
    espaceDe(e);
    fermerFenetres();
    session = { mode: 'tp', id, debut: Date.now(), indices: 0, solution: false, essais: 0, valide: false };
    afficherPanneau();
}

function etoilesPour(s) { return s.solution ? 1 : s.indices === 0 ? 3 : s.indices <= 2 ? 2 : 1; }

function validerTp() {
    const s = session, e = exo(s.id);
    s.valide = true;
    const n = etoilesPour(s);
    const ancien = fait(e.id);
    profil().faits[e.id] = {
        etoiles: Math.max(n, ancien && ancien.etoiles || 0), indices: s.indices, solution: s.solution || (ancien && ancien.solution) || false,
        secondes: Math.round((Date.now() - s.debut) / 1000), date: new Date().toISOString(), manuel: !e.regle
    };
    sauver();
    memoriserProgramme(e.id);
    afficherPanneau();
}

function planifierVerification() {
    if (!session || session.mode !== 'tp' || session.valide) return;
    clearTimeout(verif);
    verif = setTimeout(() => {
        if (session && session.mode === 'tp' && !session.valide && regleOk(exo(session.id).regle)) validerTp();
    }, 400);
}

function indiceSuivant() {
    const e = exo(session.id);
    if (session.indices < (e.indices || []).length) { session.indices++; afficherPanneau(); }
}
function voirSolution() {
    const e = exo(session.id);
    if (!e.solution) return;
    if (!confirm('Afficher la solution remplace ton programme actuel et rapporte moins d\'étoiles. Continuer ?')) return;
    session.solution = true;
    charger(e.solution.blocks, e.solution.variables);
    planifierVerification();
    afficherPanneau();
}
function recommencer() { espaceDe(exo(session.id), false); session.valide = false; afficherPanneau(); }
function suivant() {
    memoriserProgramme(session.id);
    const i = plat.findIndex(e => e.id === session.id);
    const prochain = plat[i + 1];
    if (!prochain) { session = null; masquerPanneau(); ouvrirFenetre('exercices'); return; }
    espaceDe(prochain);
    session = { mode: 'tp', id: prochain.id, debut: Date.now(), indices: 0, solution: false, essais: 0, valide: false };
    afficherPanneau();
}
function passerTp() {
    // « Passer » memorise l'exercice comme passe (sans etoile) pour debloquer la suite.
    if (!fait(session.id)) { profil().faits[session.id] = { etoiles: 0, passe: true, date: new Date().toISOString() }; sauver(); }
    suivant();
}

// ---------------------------------------------------------------- mode evaluation
function demarrerEvaluation(ids, minutes) {
    if (!ids.length) return;
    if (!confirmerRemplacement()) return;
    espaceDe(exo(ids[0]), false);
    fermerFenetres();
    session = { mode: 'eval', nom: donnees.profil, liste: ids, idx: 0, debut: Date.now(), limiteMs: minutes ? minutes * 60000 : 0,
        resultats: [], essais: 0, debutExo: Date.now(), termine: false, etat: '' };
    stopMinuteur();
    minuteur = setInterval(tictac, 1000);
    afficherPanneau();
}
function tictac() {
    if (!session || session.mode !== 'eval') { stopMinuteur(); return; }
    if (session.limiteMs && Date.now() - session.debut >= session.limiteMs) { terminerEvaluation('Temps écoulé'); return; }
    const t = $('#ex-chrono');
    if (t) t.textContent = chronoEval();
}
function chronoEval() {
    const ecoule = (Date.now() - session.debut) / 1000;
    return session.limiteMs ? '⏱ reste ' + fmt(session.limiteMs / 1000 - ecoule) : '⏱ ' + fmt(ecoule);
}
function enregistrerResultat(ok, points) {
    const e = exo(session.liste[session.idx]);
    memoriserProgramme(e.id);
    session.resultats.push({ id: e.id, titre: e.titre, ok, essais: session.essais, points, sur: e.points,
        secondes: Math.round((Date.now() - session.debutExo) / 1000) });
}
function validerEval() {
    const s = session;
    if (!s || s.mode !== 'eval' || s.etat) return;
    const e = exo(s.liste[s.idx]);
    s.essais++;
    // Exercice sans controle automatique (cree par l'enseignant) : remis tel quel, a corriger.
    if (!e.regle) {
        enregistrerResultat(null, 0);
        s.resultats[s.resultats.length - 1].aCorriger = true;
        s.etat = 'remis';
        afficherPanneau();
        return;
    }
    if (regleOk(e.regle)) {
        enregistrerResultat(true, Math.round(e.points * PART_POINTS[Math.min(s.essais, ESSAIS_MAX) - 1] * 100) / 100);
        s.etat = 'reussi';
    } else if (s.essais >= ESSAIS_MAX) {
        enregistrerResultat(false, 0);
        s.etat = 'echec';
    } else {
        s.etat = 'retente';
    }
    afficherPanneau();
    if (s.etat === 'retente') setTimeout(() => { if (session === s && s.etat === 'retente') { s.etat = ''; afficherPanneau(); } }, 2500);
}
function passerEval() {
    const s = session;
    if (!s || s.mode !== 'eval') return;
    if (!s.etat || s.etat === 'retente') { enregistrerResultat(false, 0); }
    suivantEval();
}
function suivantEval() {
    const s = session;
    s.idx++;
    s.essais = 0; s.etat = ''; s.debutExo = Date.now();
    if (s.idx >= s.liste.length) { terminerEvaluation(''); return; }
    espaceDe(exo(s.liste[s.idx]), false);
    afficherPanneau();
}
function abandonner() {
    if (confirm('Arrêter l\'évaluation ? Les exercices non faits compteront 0.')) terminerEvaluation('Évaluation arrêtée');
}
function terminerEvaluation(motif) {
    const s = session;
    if (!s || s.mode !== 'eval' || s.termine) return;
    s.termine = true;
    stopMinuteur();
    // les exercices non traites comptent 0
    for (let i = s.resultats.length; i < s.liste.length; i++) {
        const e = exo(s.liste[i]);
        s.resultats.push({ id: e.id, titre: e.titre, ok: false, essais: 0, points: 0, sur: e.points, secondes: 0, nonFait: true });
    }
    const total = s.resultats.reduce((n, r) => n + r.sur, 0), obtenu = s.resultats.reduce((n, r) => n + r.points, 0);
    const rapport = { nom: s.nom, date: new Date().toISOString(), secondes: Math.round((Date.now() - s.debut) / 1000), motif,
        points: Math.round(obtenu * 100) / 100, total, note: total ? Math.round(obtenu / total * 200) / 10 : 0, details: s.resultats };
    donnees.evaluations.push(rapport);
    sauver();
    session = null;
    masquerPanneau();
    ouvrirRapport(rapport);
}

// ---------------------------------------------------------------- panneau « Mission »
function creerPanneau() {
    let p = $('#ex-panneau');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'ex-panneau';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Exercice');
    document.body.appendChild(p);
    // deplacement par l'en-tete
    let dec = null;
    p.addEventListener('pointerdown', ev => {
        const entete = ev.target.closest('#ex-entete');
        if (!entete || ev.target.closest('button')) return;
        const r = p.getBoundingClientRect();
        dec = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        entete.setPointerCapture(ev.pointerId);
    });
    p.addEventListener('pointermove', ev => {
        if (!dec) return;
        p.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dec.x)) + 'px';
        p.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dec.y)) + 'px';
        p.style.bottom = 'auto';
    });
    p.addEventListener('pointerup', () => { dec = null; });
    p.addEventListener('click', ev => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        const a = b.dataset.act;
        if (a === 'indice') indiceSuivant();
        else if (a === 'solution') voirSolution();
        else if (a === 'recommencer') recommencer();
        else if (a === 'suivant') suivant();
        else if (a === 'passer') passerTp();
        else if (a === 'liste') { ouvrirFenetre('exercices'); }
        else if (a === 'fermer') { session = null; masquerPanneau(); }
        else if (a === 'reduire') { p.classList.toggle('reduit'); }
        else if (a === 'valider') validerEval();
        else if (a === 'passer-eval') passerEval();
        else if (a === 'suivant-eval') suivantEval();
        else if (a === 'abandonner') abandonner();
        else if (a === 'termine') validerTp();
        else if (a === 'rendre' && window.seanceRendre) window.seanceRendre();
    });
    return p;
}
function masquerPanneau() { const p = $('#ex-panneau'); if (p) p.style.display = 'none'; }

function afficherPanneau() {
    const p = creerPanneau();
    p.style.display = 'block';
    if (!session) { p.style.display = 'none'; return; }
    const reduit = p.classList.contains('reduit');
    let html = '';
    if (session.mode === 'tp') {
        const e = exo(session.id), indices = e.indices || [];
        const enc = fait(e.id) && fait(e.id).etoiles ? ' · record ' + etoiles(fait(e.id).etoiles) : '';
        html += '<div id="ex-entete"><span class="ex-titre">' + esc(e.id) + ' · ' + esc(e.titre) + '</span>' +
            '<button data-act="reduire" title="Réduire / agrandir">–</button><button data-act="fermer" title="Fermer">✕</button></div>';
        html += '<div class="ex-corps">';
        html += '<div class="ex-niveau">' + esc(e.niveau.titre) + enc + '</div>';
        html += '<p class="ex-consigne">' + esc(e.consigne) + '</p>';
        if (session.indices) {
            html += '<ol class="ex-indices">' + indices.slice(0, session.indices).map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>';
        }
        if (session.valide) {
            html += '<p class="ex-ok">✔ Bien joué ! ' + etoiles(etoilesPour(session)) + (session.solution ? ' (solution vue)' : '') + '</p>';
            html += '<div class="ex-boutons"><button class="ex-primaire" data-act="suivant">' + (plat[plat.findIndex(x => x.id === e.id) + 1] ? 'Exercice suivant ▶' : 'Terminer 🎉') + '</button>' +
                '<button data-act="recommencer">Recommencer</button><button data-act="liste">Liste</button>' +
                (seance ? '<button data-act="rendre">📤 Rendre mon travail</button>' : '') + '</div>';
        } else if (!e.regle) {
            html += '<p class="ex-attente">Cet exercice sera corrigé par ton professeur : clique sur « J\'ai terminé » quand ton programme est prêt.</p>';
            html += '<div class="ex-boutons"><button class="ex-primaire" data-act="termine">✔ J\'ai terminé</button>' +
                (session.indices < indices.length ? '<button data-act="indice">💡 Indice (' + session.indices + '/' + indices.length + ')</button>' : '') +
                (e.solution ? '<button data-act="solution">Solution</button>' : '') +
                '<button data-act="recommencer">Recommencer</button><button data-act="passer">Passer</button><button data-act="liste">Liste</button></div>';
        } else {
            html += '<p class="ex-attente">Le contrôle se fait tout seul : pose tes blocs, la validation apparaît quand c\'est bon.</p>';
            html += '<div class="ex-boutons">' +
                (session.indices < indices.length ? '<button data-act="indice">💡 Indice (' + session.indices + '/' + indices.length + ')</button>' : '') +
                (e.solution ? '<button data-act="solution">Solution</button>' : '') +
                '<button data-act="recommencer">Recommencer</button><button data-act="passer">Passer</button><button data-act="liste">Liste</button></div>';
        }
        html += '</div>';
    } else {
        const e = exo(session.liste[session.idx]);
        const s = session;
        html += '<div id="ex-entete" class="ex-eval"><span class="ex-titre">📝 Évaluation — ' + esc(s.nom) + ' — ' + (s.idx + 1) + '/' + s.liste.length + '</span>' +
            '<span id="ex-chrono">' + esc(chronoEval()) + '</span><button data-act="reduire" title="Réduire / agrandir">–</button></div>';
        html += '<div class="ex-corps"><div class="ex-niveau">' + esc(e.id) + ' · ' + esc(e.titre) + ' · ' + e.points + ' pt' + (e.points > 1 ? 's' : '') + '</div>';
        html += '<p class="ex-consigne">' + esc(e.consigne) + '</p>';
        if (s.etat === 'remis') {
            html += '<p class="ex-ok">✔ Exercice remis : ton professeur le corrigera.</p><div class="ex-boutons"><button class="ex-primaire" data-act="suivant-eval">' +
                (s.idx + 1 >= s.liste.length ? 'Terminer ▶' : 'Exercice suivant ▶') + '</button></div>';
        } else if (s.etat === 'reussi') {
            html += '<p class="ex-ok">✔ Exercice validé.</p><div class="ex-boutons"><button class="ex-primaire" data-act="suivant-eval">' +
                (s.idx + 1 >= s.liste.length ? 'Terminer ▶' : 'Exercice suivant ▶') + '</button></div>';
        } else if (s.etat === 'echec') {
            html += '<p class="ex-ko">✘ Trois essais utilisés : l\'exercice est terminé.</p><div class="ex-boutons"><button class="ex-primaire" data-act="suivant-eval">' +
                (s.idx + 1 >= s.liste.length ? 'Terminer ▶' : 'Exercice suivant ▶') + '</button></div>';
        } else {
            html += (s.etat === 'retente' ? '<p class="ex-ko">✘ Ce n\'est pas encore ça. Relis la consigne.</p>' : '') +
                '<p class="ex-attente">Essai ' + (s.essais + 1) + ' sur ' + ESSAIS_MAX + '. Clique sur « Valider » quand ton programme est prêt.</p>' +
                '<div class="ex-boutons"><button class="ex-primaire" data-act="valider">Valider</button>' +
                '<button data-act="passer-eval">Passer</button><button data-act="abandonner">Arrêter</button></div>';
        }
        html += '</div>';
    }
    p.innerHTML = html;
    p.classList.toggle('reduit', reduit);
}

// ---------------------------------------------------------------- fenetres (liste, resultats, rapport)
function fermerFenetres() { const v = $('#ex-voile'); if (v) v.remove(); }
function voile(contenu, classe = '') {
    fermerFenetres();
    const v = document.createElement('div');
    v.id = 'ex-voile';
    v.innerHTML = '<div class="ex-fenetre ' + classe + '" role="dialog" aria-modal="true">' + contenu + '</div>';
    v.addEventListener('mousedown', ev => { if (ev.target === v) fermerFenetres(); });
    document.body.appendChild(v);
    return v;
}
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#ex-voile')) fermerFenetres(); });

async function ouvrirFenetre(onglet = 'exercices') {
    if (!(await chargerExercices())) return;
    if (session && session.mode === 'eval') return;
    const nomActuel = donnees.profil;
    const noms = Object.keys(donnees.profils);
    let contenu = '<div class="ex-haut"><h2>🎓 ' + esc(defs.titre || 'Exercices') + '</h2><button class="ex-x" data-f="fermer" title="Fermer">✕</button></div>';
    if (seance) {
        contenu += '<div class="ex-seance">' + esc(seance.def.classe ? seance.def.classe + ' · ' : '') + esc(seance.groupe) + ' · <b>' + esc(seance.eleves.join(', ')) + '</b>' +
            '<span class="ex-boutons"><button class="ex-primaire" data-a="rendre">📤 Rendre mon travail</button><button data-a="quitter-seance">Quitter la séance</button></span></div>';
    }
    contenu += '<div class="ex-profil"' + (seance ? ' hidden' : '') + '><label>Nom de l\'élève <input id="ex-nom" type="text" value="' + esc(nomActuel) + '" maxlength="40" list="ex-noms" autocomplete="off"></label>' +
        '<datalist id="ex-noms">' + noms.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>' +
        '<label class="ex-libre"><input id="ex-libre" type="checkbox"' + (donnees.libre ? ' checked' : '') + '> Accès libre (tout déverrouiller)</label></div>';
    contenu += '<div class="ex-onglets"><button data-onglet="exercices">Exercices</button><button data-onglet="evaluation">Évaluation</button><button data-onglet="resultats">Résultats</button></div>';
    contenu += '<div id="ex-contenu"></div>';
    const v = voile(contenu);
    const gerer = () => { // nom de profil : memorise des qu'il change
        const n = ($('#ex-nom', v).value || '').trim() || NOM_DEFAUT;
        if (n !== donnees.profil) { donnees.profil = n; profil(); sauver(); }
    };
    $('#ex-nom', v).addEventListener('change', () => { gerer(); montrer(courant); });
    $('#ex-libre', v).addEventListener('change', ev => { donnees.libre = ev.target.checked; sauver(); montrer(courant); });
    let courant = onglet;
    function montrer(o) {
        courant = o;
        gerer();
        v.querySelectorAll('.ex-onglets button').forEach(b => b.classList.toggle('actif', b.dataset.onglet === o));
        $('#ex-contenu', v).innerHTML = o === 'exercices' ? htmlExercices() : o === 'evaluation' ? htmlEvaluation() : htmlResultats();
        if (o === 'evaluation') { const m = $('#ex-eval-niveau', v); if (m) m.addEventListener('change', majEval); majEval(); }
    }
    function majEval() { /* rien a recalculer : la liste des exercices est lue au demarrage */ }
    v.addEventListener('click', async ev => {
        const o = ev.target.closest('[data-onglet]');
        if (o) { montrer(o.dataset.onglet); return; }
        if (ev.target.closest('[data-f="fermer"]')) { fermerFenetres(); return; }
        const ex = ev.target.closest('[data-exo]');
        if (ex && !ex.disabled) { gerer(); lancerExercice(ex.dataset.exo); return; }
        const a = ev.target.closest('[data-a]');
        if (!a) return;
        gerer();
        const act = a.dataset.a;
        if (act === 'eval') {
            const sel = $('#ex-eval-niveau', v).value;
            const ids = plat.filter(e => sel === 'tous' || e.niveau.id === sel).map(e => e.id);
            const minutes = Number($('#ex-eval-min', v).value) || 0;
            demarrerEvaluation(ids, minutes);
        } else if (act === 'export') exporterProgression();
        else if (act === 'import') $('#ex-import-fichier', v).click();
        else if (act === 'effacer') {
            if (confirm('Effacer toute la progression de « ' + donnees.profil + ' » (exercices et évaluations) ?')) {
                delete donnees.profils[donnees.profil];
                donnees.evaluations = donnees.evaluations.filter(r => r.nom !== donnees.profil);
                sauver(); montrer('resultats');
            }
        } else if (act === 'imprimer') window.print();
        else if (act === 'rapport') ouvrirRapport(donnees.evaluations[Number(a.dataset.i)]);
        else if (act === 'csv-classe') telecharger('classe.csv', csvClasse(), 'text/csv');
        else if (act === 'rendre' && window.seanceRendre) window.seanceRendre();
        else if (act === 'quitter-seance' && window.seanceQuitter) window.seanceQuitter();
    });
    v.addEventListener('change', ev => {
        if (ev.target.id === 'ex-import-fichier') importerProgression(ev.target.files, () => montrer('resultats'));
    });
    montrer(onglet);
}

function htmlExercices() {
    let h = '';
    let i = 0;
    for (const n of defs.niveaux) {
        const faitsNiveau = n.exercices.filter(e => fait(e.id) && !fait(e.id).passe).length;
        h += '<h3>' + esc(n.titre) + ' <small>' + faitsNiveau + '/' + n.exercices.length + ' · ' + esc(n.notion || '') + '</small></h3><div class="ex-cartes">';
        for (const e of n.exercices) {
            const idx = i++;
            const f = fait(e.id), ouvert = accessible(idx);
            const marque = f ? (f.passe ? '↷ passé' : etoiles(f.etoiles)) : ouvert ? '▶ à faire' : '🔒';
            h += '<button class="ex-carte' + (f && !f.passe ? ' fait' : '') + '" data-exo="' + esc(e.id) + '"' + (ouvert ? '' : ' disabled') + '>' +
                '<b>' + esc(e.id) + '</b> ' + esc(e.titre) + '<span>' + marque + '</span></button>';
        }
        h += '</div>';
    }
    return h;
}
function htmlEvaluation() {
    return '<p>En évaluation, <b>aucun indice ni solution</b> : l\'élève a ' + ESSAIS_MAX + ' essais par exercice, validés avec le bouton « Valider ». ' +
        'Un exercice réussi du premier coup rapporte tous ses points, du deuxième 75 %, du troisième 50 %. ' +
        'Le résultat (note sur 20, temps, essais) est enregistré et un rapport imprimable est proposé à la fin.</p>' +
        '<div class="ex-eval-form"><label>Exercices <select id="ex-eval-niveau"><option value="tous">Tous les niveaux (' + plat.length + ' exercices)</option>' +
        defs.niveaux.map(n => '<option value="' + esc(n.id) + '">' + esc(n.titre) + ' (' + n.exercices.length + ')</option>').join('') + '</select></label>' +
        '<label>Durée maximale (minutes, 0 = illimitée) <input id="ex-eval-min" type="number" min="0" max="180" value="0"></label>' +
        '<button class="ex-primaire" data-a="eval">Démarrer l\'évaluation de « ' + esc(donnees.profil) + ' »</button></div>' +
        '<p class="ex-note">Le programme en cours sera remplacé par un espace vierge. L\'évaluation ne se quitte qu\'avec « Arrêter ».</p>';
}
function htmlResultats() {
    const p = profil();
    const nbFaits = plat.filter(e => p.faits[e.id] && !p.faits[e.id].passe).length;
    const etoilesTot = plat.reduce((n, e) => n + (p.faits[e.id] && p.faits[e.id].etoiles || 0), 0);
    let h = '<h3>' + esc(donnees.profil) + ' <small>' + nbFaits + '/' + plat.length + ' exercices · ' + etoilesTot + ' / ' + plat.length * 3 + ' étoiles</small></h3>';
    const evals = donnees.evaluations.map((r, i) => ({ r, i })).filter(x => x.r.nom === donnees.profil).reverse();
    h += '<h4>Évaluations</h4>';
    h += evals.length ? '<table class="ex-table"><tr><th>Date</th><th>Note</th><th>Points</th><th>Durée</th><th></th></tr>' +
        evals.map(({ r, i }) => '<tr><td>' + esc(new Date(r.date).toLocaleString('fr-FR')) + '</td><td><b>' + r.note + ' / 20</b></td><td>' + r.points + ' / ' + r.total +
            '</td><td>' + fmt(r.secondes) + '</td><td><button data-a="rapport" data-i="' + i + '">Rapport</button></td></tr>').join('') + '</table>'
        : '<p class="ex-note">Aucune évaluation pour cet élève.</p>';
    // tableau de classe
    const noms = Object.keys(donnees.profils);
    h += '<h4>Tableau de la classe <small>(étoiles par exercice, note de la dernière évaluation)</small></h4>';
    h += '<div class="ex-defile"><table class="ex-table ex-classe"><tr><th>Élève</th>' + plat.map(e => '<th title="' + esc(e.titre) + '">' + esc(e.id) + '</th>').join('') + '<th>Dernière éval.</th></tr>' +
        noms.map(n => {
            const f = donnees.profils[n].faits || {};
            const der = donnees.evaluations.filter(r => r.nom === n).slice(-1)[0];
            return '<tr><td>' + esc(n) + '</td>' + plat.map(e => '<td>' + (f[e.id] ? (f[e.id].passe ? '↷' : f[e.id].etoiles + '★') : '·') + '</td>').join('') + '<td>' + (der ? der.note + '/20' : '—') + '</td></tr>';
        }).join('') + '</table></div>';
    h += '<div class="ex-boutons ex-noprint"><button data-a="imprimer">🖨 Imprimer</button><button data-a="csv-classe">Exporter la classe (CSV)</button>' +
        '<button data-a="export">Exporter ma progression</button><button data-a="import">Importer des progressions…</button>' +
        '<input id="ex-import-fichier" type="file" accept=".json,application/json" multiple hidden>' +
        '<button class="ex-danger" data-a="effacer">Effacer cet élève</button></div>' +
        '<p class="ex-note ex-noprint">Pour regrouper une classe : chaque élève exporte sa progression, l\'enseignant les importe toutes sur son poste.</p>';
    return h;
}

function ouvrirRapport(r) {
    if (!r) return;
    const lignes = r.details.map(d => '<tr><td>' + esc(d.id) + '</td><td>' + esc(d.titre) + '</td><td>' + (d.nonFait ? 'non traité' : d.aCorriger ? '✎ à corriger' : d.ok ? '✔ réussi' : d.essais === 0 ? '↷ passé' : '✘ échec') +
        '</td><td>' + d.essais + '</td><td>' + fmt(d.secondes) + '</td><td>' + d.points + ' / ' + d.sur + '</td></tr>').join('');
    const v = voile('<div class="ex-haut"><h2>📝 Rapport d\'évaluation</h2><button class="ex-x ex-noprint" data-f="fermer" title="Fermer">✕</button></div>' +
        '<p><b>' + esc(r.nom) + '</b> — ' + esc(new Date(r.date).toLocaleString('fr-FR')) + ' — durée ' + fmt(r.secondes) + (r.motif ? ' (' + esc(r.motif) + ')' : '') + '</p>' +
        '<p class="ex-grand">Note : <b>' + r.note + ' / 20</b> <small>(' + r.points + ' point' + (r.points > 1 ? 's' : '') + ' sur ' + r.total + ')</small></p>' +
        '<table class="ex-table"><tr><th>N°</th><th>Exercice</th><th>Résultat</th><th>Essais</th><th>Temps</th><th>Points</th></tr>' + lignes + '</table>' +
        '<div class="ex-boutons ex-noprint">' + (seance ? '<button class="ex-primaire" data-a="rendre">📤 Rendre mon travail</button>' : '') +
        '<button' + (seance ? '' : ' class="ex-primaire"') + ' data-a="imprimer">🖨 Imprimer</button><button data-a="csv">Exporter (CSV)</button>' +
        '<button data-a="json">Exporter (JSON)</button><button data-f="fermer">Fermer</button></div>', 'ex-rapport');
    v.addEventListener('click', ev => {
        if (ev.target.closest('[data-f="fermer"]')) fermerFenetres();
        const a = ev.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'imprimer') window.print();
        else if (a.dataset.a === 'rendre' && window.seanceRendre) window.seanceRendre();
        else if (a.dataset.a === 'csv') telecharger('evaluation_' + r.nom + '.csv', csvRapport(r), 'text/csv');
        else if (a.dataset.a === 'json') telecharger('evaluation_' + r.nom + '.json', JSON.stringify(r, null, 2), 'application/json');
    });
}

// ---------------------------------------------------------------- export / import
function telecharger(nom, texte, type) {
    const blob = new Blob(['﻿' + texte], { type: type + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom.replace(/[\\/:*?"<>|]+/g, '_');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const cell = t => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"';
function csvRapport(r) {
    return ['Élève;' + cell(r.nom), 'Date;' + cell(r.date), 'Note /20;' + String(r.note).replace('.', ','), '',
        'N°;Exercice;Résultat;Essais;Secondes;Points;Sur'].concat(r.details.map(d =>
            [cell(d.id), cell(d.titre), d.nonFait ? 'non traité' : d.ok ? 'réussi' : d.essais === 0 ? 'passé' : 'échec', d.essais, d.secondes, String(d.points).replace('.', ','), d.sur].join(';'))).join('\r\n');
}
function csvClasse() {
    const tete = ['Élève'].concat(plat.map(e => cell(e.id)), ['Dernière éval. /20']).join(';');
    const lignes = Object.keys(donnees.profils).map(n => {
        const f = donnees.profils[n].faits || {};
        const der = donnees.evaluations.filter(r => r.nom === n).slice(-1)[0];
        return [cell(n)].concat(plat.map(e => f[e.id] ? (f[e.id].passe ? 'passé' : f[e.id].etoiles) : ''), [der ? String(der.note).replace('.', ',') : '']).join(';');
    });
    return [tete].concat(lignes).join('\r\n');
}
function exporterProgression() {
    const nom = donnees.profil;
    telecharger('progression_' + nom + '.json', JSON.stringify({ version: 1, profil: nom, faits: profil(nom).faits,
        evaluations: donnees.evaluations.filter(r => r.nom === nom) }, null, 2), 'application/json');
}
function importerProgression(fichiers, apres) {
    let restants = fichiers.length, ajoutes = 0;
    Array.from(fichiers).forEach(f => {
        const lecteur = new FileReader();
        lecteur.onload = () => {
            try {
                const d = JSON.parse(String(lecteur.result).replace(/^﻿/, ''));
                if (d && d.profil && d.faits) {
                    const p = profil(d.profil);
                    for (const [id, nv] of Object.entries(d.faits)) {
                        const ex = p.faits[id];
                        if (!ex || (nv.etoiles || 0) > (ex.etoiles || 0)) p.faits[id] = nv;
                    }
                    for (const r of d.evaluations || []) {
                        if (!donnees.evaluations.some(x => x.nom === r.nom && x.date === r.date)) donnees.evaluations.push(r);
                    }
                    ajoutes++;
                }
            } catch (erreur) { /* fichier ignore */ }
            if (--restants === 0) { sauver(); alert(ajoutes + ' progression(s) importée(s).'); apres(); }
        };
        lecteur.readAsText(f);
    });
}

// ---------------------------------------------------------------- style (injecte : le module est autonome)
const style = document.createElement('style');
style.textContent = `
#ex-panneau { display: none; position: fixed; left: 250px; bottom: 16px; width: 360px; max-width: calc(100vw - 24px); z-index: 8500;
  background: var(--fond-code, #1e1e1e); color: var(--texte-code, #d4d4d4); border: 2px solid #ff5501; border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.45); font-family: var(--font, 'Segoe UI', Arial, sans-serif); font-size: 13px; }
#ex-panneau.reduit .ex-corps { display: none; }
#ex-entete { display: flex; align-items: center; gap: 6px; padding: 7px 8px 7px 12px; background: #ff5501; color: #fff; border-radius: 7px 7px 0 0; cursor: move; touch-action: none; }
#ex-panneau.reduit #ex-entete { border-radius: 7px; }
#ex-entete.ex-eval { background: #b33a00; }
#ex-entete .ex-titre { flex: 1 1 auto; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ex-chrono { font-variant-numeric: tabular-nums; font-weight: 700; }
#ex-entete button { background: rgba(255,255,255,.2); color: #fff; border: none; border-radius: 4px; width: 24px; height: 24px; padding: 0; margin: 0; cursor: pointer; }
#ex-entete button:hover { background: rgba(255,255,255,.35); }
.ex-corps { padding: 10px 12px 12px; }
.ex-niveau { font-size: 11px; opacity: .75; text-transform: uppercase; letter-spacing: .04em; }
.ex-consigne { margin: 6px 0 8px; font-size: 14px; line-height: 1.4; font-weight: 600; }
.ex-indices { margin: 0 0 8px; padding-left: 20px; } .ex-indices li { margin: 3px 0; color: #ffb27a; }
:root[data-theme="light"] .ex-indices li { color: #a64000; }
.ex-ok { margin: 6px 0; padding: 6px 8px; border-radius: 6px; background: #1e8449; color: #fff; font-weight: 700; }
.ex-ko { margin: 6px 0; padding: 6px 8px; border-radius: 6px; background: #c0392b; color: #fff; font-weight: 700; }
.ex-attente, .ex-note { margin: 6px 0; font-size: 12px; opacity: .8; }
.ex-boutons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
#ex-panneau button:not(#ex-entete button), #ex-voile button { font-family: inherit; font-size: 12px; padding: 5px 10px; margin: 0; border-radius: 5px; border: 1px solid var(--bordure-chrome, #555);
  background: var(--fond-saisie, #202020); color: var(--texte-saisie, #e6e6e6); cursor: pointer; }
#ex-panneau button:not(#ex-entete button):hover, #ex-voile button:hover { filter: brightness(1.25); }
#ex-panneau .ex-primaire, #ex-voile .ex-primaire { background: #ff5501; border-color: #ff5501; color: #fff; font-weight: 700; }
#ex-voile .ex-danger { color: #e74c3c; border-color: #e74c3c; }
#ex-voile { position: fixed; inset: 0; z-index: 9100; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 12px; }
.ex-fenetre { width: min(900px, 100%); max-height: calc(100vh - 24px); overflow: auto; box-sizing: border-box; padding: 14px 18px 18px;
  background: var(--fond-code, #1e1e1e); color: var(--texte-code, #d4d4d4); border: 2px solid #ff5501; border-radius: 10px; font-family: var(--font, 'Segoe UI', Arial, sans-serif); font-size: 13px; }
.ex-haut { display: flex; align-items: center; justify-content: space-between; }
.ex-haut h2 { margin: 0; font-size: 18px; color: #ff7a33; }
.ex-x { width: 28px; height: 28px; padding: 0 !important; }
.ex-seance { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0; padding: 8px 10px;
  border-radius: 6px; background: rgba(255, 85, 1, .12); border: 1px solid #ff5501; }
.ex-seance .ex-boutons { margin: 0; }
.ex-profil { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; margin: 10px 0; }
.ex-profil input[type=text] { padding: 4px 8px; border-radius: 4px; border: 1px solid var(--bordure-chrome, #555); background: var(--fond-saisie, #202020); color: var(--texte-saisie, #e6e6e6); }
.ex-onglets { display: flex; gap: 4px; border-bottom: 2px solid #ff5501; margin-bottom: 10px; }
.ex-onglets button { border-radius: 6px 6px 0 0 !important; border-bottom: none !important; }
.ex-onglets button.actif { background: #ff5501 !important; color: #fff !important; border-color: #ff5501 !important; font-weight: 700; }
.ex-fenetre h3 { margin: 14px 0 6px; font-size: 15px; } .ex-fenetre h3 small, .ex-fenetre h4 small { font-weight: normal; opacity: .7; font-size: 12px; }
.ex-fenetre h4 { margin: 14px 0 6px; }
.ex-cartes { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
.ex-carte { display: flex !important; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; padding: 8px 10px !important; font-size: 13px !important; }
.ex-carte span { font-size: 12px; opacity: .85; color: #ffb27a; } .ex-carte.fait { border-color: #2ecc71 !important; } .ex-carte.fait span { color: #2ecc71; }
.ex-carte:disabled { opacity: .45; cursor: not-allowed; }
.ex-eval-form { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: end; margin: 10px 0; }
.ex-eval-form select, .ex-eval-form input { padding: 4px 6px; border-radius: 4px; border: 1px solid var(--bordure-chrome, #555); background: var(--fond-saisie, #202020); color: var(--texte-saisie, #e6e6e6); }
.ex-table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; } .ex-table th, .ex-table td { border: 1px solid var(--bordure-chrome, #555); padding: 4px 8px; text-align: left; }
.ex-classe td, .ex-classe th { text-align: center; } .ex-classe td:first-child, .ex-classe th:first-child { text-align: left; }
.ex-defile { overflow-x: auto; }
.ex-grand { font-size: 18px; }
@media print {
  body > *:not(#ex-voile) { display: none !important; }
  #ex-voile { position: static; background: #fff; padding: 0; display: block; }
  .ex-fenetre { max-height: none; overflow: visible; border: none; background: #fff; color: #000; }
  .ex-noprint, .ex-onglets, .ex-profil { display: none !important; }
  .ex-table th, .ex-table td { border-color: #000; }
  .ex-haut h2 { color: #000; }
}
`;
document.head.appendChild(style);

// ---------------------------------------------------------------- branchement
function brancher() {
    const aide = $('#ex-menu-btn'), evalu = $('#ex-eval-menu-btn');
    if (aide) aide.addEventListener('click', () => ouvrirFenetre('exercices'));
    if (evalu) evalu.addEventListener('click', () => ouvrirFenetre('evaluation'));
    if (ws()) ws().addChangeListener(ev => {
        if (ev.isUiEvent) return;
        planifierVerification();
        // Seance : le programme en cours est memorise (une seconde apres la derniere modification).
        if (seance && idEnCours()) { clearTimeout(memo); const id = idEnCours(); memo = setTimeout(() => memoriserProgramme(id), 1000); }
    });
    window.addEventListener('beforeunload', ev => { if (session && session.mode === 'eval') { ev.preventDefault(); ev.returnValue = ''; } });
}
brancher();

// ---------------------------------------------------------------- seance (appele par seances.js)
window.exercicesSeance = {
    /** Ouvre une seance : exercices, progression et programmes propres a cette seance et a ces eleves. */
    activer(def, eleves, groupe) {
        if (session && session.mode === 'eval') return false;
        session = null; masquerPanneau(); fermerFenetres();
        seance = { def, eleves, groupe };
        defs = null;
        donnees = lire();
        donnees.profil = eleves.join(' et ');
        donnees.libre = true;               // en seance, tous les exercices sont ouverts
        sauver();
        return true;
    },
    quitter() {
        if (session && session.mode === 'eval') return false;
        session = null; masquerPanneau(); fermerFenetres();
        seance = null; defs = null; donnees = lire();
        return true;
    },
    /** Plateforme : reprend un travail enregistre en ligne (autre poste, maison). Ce qui est plus recent sur ce poste est garde. */
    reprendre(r) {
        if (!seance || !r || !Array.isArray(r.exercices)) return 0;
        const p = profil();
        p.programmes = p.programmes || {};
        let n = 0;
        for (const e of r.exercices) {
            const local = p.programmes[e.id];
            if (e.blocs && (!local || (local.date || '') < (r.date || ''))) { p.programmes[e.id] = { blocs: e.blocs, python: e.python || '', date: r.date }; n++; }
            if (!p.faits[e.id] && seance.def.mode !== 'eval' && ['réussi', 'à corriger', 'passé'].includes(e.statut)) {
                p.faits[e.id] = { etoiles: e.etoiles || 0, indices: e.indices || 0, solution: !!e.solutionVue, secondes: e.secondes || 0,
                                  date: r.date, manuel: e.statut === 'à corriger', passe: e.statut === 'passé' };
                n++;
            }
        }
        sauver();
        return n;
    },
    active: () => seance,
    enEvaluation: () => !!(session && session.mode === 'eval'),
    async ouvrir() { await chargerExercices(); ouvrirFenetre('exercices'); },
    async evaluer() { await chargerExercices(); demarrerEvaluation(plat.map(e => e.id), Number(seance && seance.def.minutes) || 0); },
    /** Contenu du fichier rendu : chaque exercice avec son statut et le programme de l'eleve. */
    rendu() {
        if (!seance) return null;
        const id = idEnCours();
        if (id) memoriserProgramme(id);
        const p = profil(), prog = p.programmes || {};
        const evaluation = donnees.evaluations.filter(r => r.nom === donnees.profil).slice(-1)[0] || null;
        const exercices = (seance.def.exercices || []).map(e => {
            const f = p.faits[e.id], d = evaluation && evaluation.details.find(x => x.id === e.id);
            let statut = 'non fait';
            if (d) statut = d.nonFait ? 'non fait' : d.aCorriger ? 'à corriger' : d.ok ? 'réussi' : d.essais === 0 ? 'passé' : 'échec';
            else if (f) statut = f.passe ? 'passé' : f.manuel ? 'à corriger' : 'réussi';
            else if (prog[e.id]) statut = 'commencé';
            return { id: e.id, titre: e.titre, statut, etoiles: f && !f.passe ? f.etoiles : 0, indices: f ? f.indices || 0 : 0,
                     solutionVue: !!(f && f.solution), secondes: d ? d.secondes : f ? f.secondes || 0 : 0,
                     essais: d ? d.essais : null, points: d ? d.points : null, sur: d ? d.sur : (e.points || 1),
                     blocs: prog[e.id] ? prog[e.id].blocs : null, python: prog[e.id] ? prog[e.id].python : '' };
        });
        return { format: 'rendu-microbit', version: 1, date: new Date().toISOString(),
                 seance: { id: seance.def.id, titre: seance.def.titre, classe: seance.def.classe || '', mode: seance.def.mode || 'tp' },
                 groupe: seance.groupe, eleves: seance.eleves, exercices,
                 evaluation: evaluation ? { note: evaluation.note, points: evaluation.points, total: evaluation.total,
                                            secondes: evaluation.secondes, motif: evaluation.motif } : null };
    },
};

window.exercicesTest = { chargerExercices, regleOk, correspond, lancerExercice, ouvrirFenetre, demarrerEvaluation, validerEval,
    etat: () => ({ session, donnees }), plat: () => plat, reinitialiserEspace, charger, validerTp };
