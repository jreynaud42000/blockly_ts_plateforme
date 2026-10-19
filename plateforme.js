// plateforme.js — solution 3 : plateforme en ligne avec comptes (serveur : plateforme/serveur.py).
//
// Seulement quand l'application est servie par la plateforme (/api/info repond { plateforme: true }) : sur le site
// statique, avec app.py ou l'exe, ce module ne fait rien et les boutons restent caches.
//
//   ELEVE : se connecte avec l'identifiant et le mot de passe donnes par son professeur (fiche imprimee), depuis la
//           classe ou la maison ; « Mes seances en ligne » liste les seances publiees dans sa classe ; son travail est
//           enregistre en ligne toutes les 20 secondes (meme mecanisme que le mode classe) et « Rendre mon travail »
//           marque le rendu definitif. En se reconnectant ailleurs, il retrouve ses programmes (exercicesSeance.reprendre).
//   ENSEIGNANT : se connecte avec son adresse electronique ; « Plateforme : mes classes » : classes, comptes eleves crees
//           en lot a partir des prenoms (fiche des identifiants a imprimer), nouveau mot de passe, publication de la seance
//           preparee dans l'Espace enseignant, ouverture / fermeture, suivi en direct, programme d'un eleve, export CSV,
//           export complet de la classe et suppression (fin d'annee, RGPD).
// Les fenetres, la seance en preparation et le tableau de resultats sont ceux de seances.js (window.seancesApi).

const $ = (sel, racine = document) => racine.querySelector(sel);
const S = () => window.seancesApi;
const moteur = () => window.exercicesSeance;
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CLE_SEANCES = 'pf_seances_v1';      // seances de la plateforme ouvertes sur ce poste (effacees a la deconnexion)
const EN_LIGNE_S = 45;

let info = null;      // reponse de /api/info
let moi = { role: null };

async function api(chemin, corps) {
    const r = await fetch(chemin, { method: corps === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
        headers: corps === undefined ? {} : { 'Content-Type': 'application/json', 'X-Plateforme': '1' },
        body: corps === undefined ? undefined : JSON.stringify(corps) });
    let d = {};
    try { d = await r.json(); } catch (e) { /* pas de JSON */ }
    if (!r.ok) {
        const err = new Error(d.erreur || ('erreur ' + r.status));
        err.statut = r.status;
        if (r.status === 401 && moi.role) { moi = { role: null }; majBoutons(); }
        throw err;
    }
    return d;
}
const fenetre = (titre, corps, classe = '') => S().voile('<div class="ex-haut"><h2>' + titre + '</h2><button class="ex-x" data-f="fermer" title="Fermer">✕</button></div>' + corps, classe);
const fermer = () => S().fermer();
function telecharger(nom, texte, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], { type }));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const csv = lignes => '﻿' + lignes.map(l => l.map(t => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"').join(';')).join('\r\n');
const heure = iso => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ---------------------------------------------------------------- menu Fichier
function majBoutons() {
    const compte = $('#pf-compte-btn'), seances = $('#pf-seances-btn'), prof = $('#pf-prof-btn');
    if (compte) {
        compte.hidden = false;
        compte.textContent = moi.role === 'prof' ? '🔑 ' + moi.nom + ' (compte)' : moi.role === 'eleve' ? '🔑 ' + moi.prenom + ' · ' + moi.classe + ' (compte)' : '🔑 Se connecter';
    }
    if (seances) seances.hidden = moi.role !== 'eleve';
    if (prof) prof.hidden = moi.role !== 'prof';
    // Sur la plateforme, les fichiers de seance et le mode classe restent possibles, mais au second plan pour l'eleve.
    const rejoindre = $('#seance-rejoindre-btn');
    if (rejoindre && moi.role === 'eleve') rejoindre.hidden = true;
}

// ---------------------------------------------------------------- connexion, compte
function fenetreConnexion(message = '') {
    const v = fenetre('🔑 Connexion · ' + esc(info.nom),
        (message ? '<p class="ex-note">' + esc(message) + '</p>' : '') +
        '<label class="se-libre">Identifiant (élève) ou adresse électronique (professeur) <input id="pf-ident" type="text" autocomplete="username" spellcheck="false" autocapitalize="off"></label>' +
        '<label class="se-libre">Mot de passe <input id="pf-mdp" type="password" autocomplete="current-password"></label>' +
        '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-a="connexion">Se connecter</button><button data-f="fermer">Plus tard</button></div>' +
        '<p class="ex-note">Élève : ton identifiant et ton mot de passe sont sur la fiche donnée par ton professeur. Mot de passe oublié : demande-lui un nouveau mot de passe.' +
        (info.inscription ? '<br>Professeur sans compte : <a href="#" data-a="inscription">créer un compte enseignant</a> (code de l\'établissement demandé).' : '') + '</p>');
    $('#pf-ident', v).focus();
    const valider = async () => {
        try {
            await api('/api/connexion', { identifiant: $('#pf-ident', v).value, mot_de_passe: $('#pf-mdp', v).value });
            await chargerMoi();
            fermer();
            if (moi.role === 'eleve') fenetreMesSeances(); else if (moi.role === 'prof') fenetreProf();
        } catch (e) { $('#se-erreur', v).textContent = e.message; }
    };
    v.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') valider(); });
    v.addEventListener('input', () => { $('#se-erreur', v).textContent = ''; });
    v.addEventListener('click', ev => {
        if (ev.target.closest('[data-f="fermer"]')) fermer();
        else if (ev.target.closest('[data-a="connexion"]')) valider();
        else if (ev.target.closest('[data-a="inscription"]')) { ev.preventDefault(); fenetreInscription(); }
    });
}

function fenetreInscription() {
    const v = fenetre('🧑‍🏫 Créer un compte enseignant',
        '<div class="se-form"><label>Nom affiché <input id="pf-nom" type="text" maxlength="60" placeholder="M. Dupont"></label>' +
        '<label>Adresse électronique professionnelle <input id="pf-email" type="email" autocomplete="email"></label></div>' +
        '<div class="se-form"><label>Mot de passe (10 caractères au moins) <input id="pf-mdp" type="password" autocomplete="new-password"></label>' +
        '<label>Code de l\'établissement <input id="pf-code" type="text" autocomplete="off"></label></div>' +
        '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-a="creer">Créer le compte</button><button data-a="retour">Retour</button></div>' +
        '<p class="ex-note">Le code de l\'établissement est donné par l\'administrateur de la plateforme.</p>');
    v.addEventListener('click', async ev => {
        if (ev.target.closest('[data-f="fermer"]')) { fermer(); return; }
        if (ev.target.closest('[data-a="retour"]')) { fenetreConnexion(); return; }
        if (!ev.target.closest('[data-a="creer"]')) return;
        try {
            await api('/api/inscription', { nom: $('#pf-nom', v).value, email: $('#pf-email', v).value, mot_de_passe: $('#pf-mdp', v).value, code: $('#pf-code', v).value });
            await chargerMoi();
            fenetreProf();
        } catch (e) { $('#se-erreur', v).textContent = e.message; }
    });
}

function fenetreCompte() {
    if (!moi.role) { fenetreConnexion(); return; }
    const v = fenetre('🔑 Mon compte',
        '<p>' + (moi.role === 'prof' ? 'Enseignant : <b>' + esc(moi.nom) + '</b> (' + esc(moi.email) + ')'
            : 'Élève : <b>' + esc(moi.prenom) + '</b> · classe ' + esc(moi.classe) + ' · identifiant <code>' + esc(moi.identifiant) + '</code>') + '</p>' +
        '<details class="se-nouveau"><summary>Changer mon mot de passe</summary><div class="se-form">' +
        '<label>Mot de passe actuel <input id="pf-ancien" type="password" autocomplete="current-password"></label>' +
        '<label>Nouveau (' + (moi.role === 'prof' ? 10 : 8) + ' caractères au moins) <input id="pf-nouveau" type="password" autocomplete="new-password"></label>' +
        '<button data-a="mdp">Enregistrer</button></div></details>' +
        '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-a="deconnexion">Se déconnecter</button><button data-f="fermer">Fermer</button></div>' +
        '<p class="ex-note">Sur un ordinateur partagé (salle, CDI), déconnecte-toi toujours à la fin : la séance est fermée et le travail effacé de ce poste ' +
        '(il reste enregistré en ligne).</p>');
    v.addEventListener('click', async ev => {
        if (ev.target.closest('[data-f="fermer"]')) { fermer(); return; }
        const a = ev.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'mdp') {
            try { await api('/api/mot-de-passe', { ancien: $('#pf-ancien', v).value, nouveau: $('#pf-nouveau', v).value }); $('#se-erreur', v).textContent = '✔ Mot de passe changé.'; }
            catch (e) { $('#se-erreur', v).textContent = e.message; }
        } else if (a.dataset.a === 'deconnexion') {
            await deconnecter();
            fermer();
        }
    });
}

async function deconnecter() {
    if (moi.role === 'eleve' && moteur().active()) {
        try { await window.seancesTest.envoyerAuProf(false); } catch (e) { /* dernier envoi impossible : deja enregistre il y a moins de 20 s */ }
    }
    try { await api('/api/deconnexion', {}); } catch (e) { /* session deja expiree */ }
    oublierSeancesDuPoste();
    moi = { role: null };
    majBoutons();
}

// Poste partage : rien de l'eleve precedent ne reste dans le navigateur (seance ouverte, programmes memorises).
function oublierSeancesDuPoste() {
    const active = S().seanceActive();
    if (active && active.classe && active.classe.plateforme) S().quitterSansDemander();
    try {
        const ids = JSON.parse(localStorage.getItem(CLE_SEANCES) || '[]');
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && ids.some(id => k.endsWith(':seance:' + id))) localStorage.removeItem(k);
        }
        localStorage.removeItem(CLE_SEANCES);
    } catch (e) { /* stockage indisponible */ }
}
function noterSeanceDuPoste(id) {
    try { const ids = JSON.parse(localStorage.getItem(CLE_SEANCES) || '[]'); if (!ids.includes(id)) ids.push(id); localStorage.setItem(CLE_SEANCES, JSON.stringify(ids)); } catch (e) { /* rien */ }
}

// ---------------------------------------------------------------- ELEVE
async function fenetreMesSeances() {
    let d;
    try { d = await api('/api/mes-seances'); } catch (e) { alert(e.message); return; }
    const active = moteur().active();
    const v = fenetre('📚 Mes séances · ' + esc(moi.prenom),
        (d.seances.length ? '<table class="ex-table"><tr><th>Séance</th><th>Exercices</th><th>Mode</th><th>Mon travail</th><th></th></tr>' +
            d.seances.map((s, i) => '<tr><td><b>' + esc(s.def.titre) + '</b></td><td>' + s.def.exercices.length + '</td><td>' +
                (s.def.mode === 'eval' ? 'évaluation' + (s.def.minutes ? ' (' + s.def.minutes + ' min)' : '') : 'entraînement') + '</td><td>' +
                (s.final ? '✔ rendu' : s.maj ? 'enregistré le ' + esc(heure(s.maj)) : '—') + '</td><td>' +
                (active && active.def.id === s.id ? '<i>ouverte</i>' : '<button class="ex-primaire se-petit" data-i="' + i + '">' + (s.maj ? 'Reprendre' : 'Commencer') + '</button>') +
                '</td></tr>').join('') + '</table>'
            : '<p>Ton professeur n\'a pas encore publié de séance pour ta classe.</p>') +
        '<p class="ex-note">Ton travail est enregistré en ligne toutes les 20 secondes : tu peux le continuer depuis un autre ordinateur ou depuis chez toi. ' +
        '« Rendre mon travail » (menu Fichier) indique à ton professeur que tu as terminé ; tu peux encore l\'améliorer ensuite.</p>' +
        '<div class="ex-boutons"><button data-f="fermer">Fermer</button></div>');
    v.addEventListener('click', async ev => {
        if (ev.target.closest('[data-f="fermer"]')) { fermer(); return; }
        const b = ev.target.closest('[data-i]');
        if (!b) return;
        const s = d.seances[Number(b.dataset.i)];
        if (moteur().enEvaluation()) { alert('Une évaluation est en cours : termine-la d\'abord.'); return; }
        if (s.def.mode === 'eval' && s.final) { alert('Tu as déjà rendu cette évaluation.'); return; }
        let reprise = null;
        try { reprise = (await api('/api/mon-travail?seance=' + encodeURIComponent(s.id))).rendu; } catch (e) { /* on commence sans */ }
        if (!S().espaceVierge() && !confirm('La séance démarre sur un espace vierge : ton programme actuel sera remplacé.\nContinuer ?')) return;
        if (moteur().active()) S().quitterSansDemander();
        noterSeanceDuPoste(s.id);
        S().demarrerSeance(s.def, [moi.prenom], s.def.classe || moi.classe, { plateforme: true, seance: s.id, eleve: moi.id }, reprise);
    });
}

async function envoyer(rendu, final) {
    if (!rendu) return null;
    return api('/api/envoyer', { seance: rendu.seance.id, rendu, final: !!final });
}

// ---------------------------------------------------------------- ENSEIGNANT
let vue = { classe: null, onglet: 'eleves', seance: null };
let suivi = null, dernierSuivi = null, identifiantsCrees = [];

async function fenetreProf() {
    if (moteur().active()) { alert('Une séance d\'élève est ouverte sur ce poste : quittez-la d\'abord (Fichier > Quitter la séance).'); return; }
    const v = fenetre('🌐 Plateforme · ' + esc(moi.nom), '<div id="pf-contenu"></div>', 'se-fenetre');
    v.addEventListener('click', ev => action(ev, v));
    v.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.id === 'pf-nouvelle-classe') action({ target: $('[data-a="creer-classe"]', v) }, v); });
    await afficher(v);
}

async function afficher(v) {
    clearInterval(suivi); suivi = null;
    const zone = $('#pf-contenu', v);
    if (!zone) return;
    try {
        if (!vue.classe) zone.innerHTML = await htmlClasses();
        else if (vue.seance) { zone.innerHTML = '<div id="pf-suivi"></div>'; await rafraichirSuivi(v); lancerSuivi(v); }
        else zone.innerHTML = await htmlClasse();
    } catch (e) {
        if (e.statut === 404) { vue = { classe: null, onglet: 'eleves', seance: null }; return afficher(v); }
        zone.innerHTML = '<p class="se-erreur">' + esc(e.message) + '</p>';
    }
}

async function htmlClasses() {
    const d = await api('/api/classes');
    return '<h3>Mes classes</h3>' + (d.classes.length ? '<table class="ex-table"><tr><th>Classe</th><th>Élèves</th><th>Séances</th><th></th></tr>' +
            d.classes.map(k => '<tr><td><b>' + esc(k.nom) + '</b></td><td>' + k.eleves + '</td><td>' + k.seances + '</td><td>' +
                '<button class="ex-primaire se-petit" data-a="ouvrir-classe" data-id="' + k.id + '" data-nom="' + esc(k.nom) + '">Ouvrir</button></td></tr>').join('') + '</table>'
            : '<p class="ex-note">Aucune classe pour l\'instant.</p>') +
        '<div class="se-form"><label>Nouvelle classe <input id="pf-nouvelle-classe" type="text" maxlength="40" placeholder="4e B 2026-2027"></label>' +
        '<button data-a="creer-classe">Créer la classe</button></div>' +
        '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<p class="ex-note">Une classe regroupe les comptes de vos élèves et les séances que vous y publiez. En fin d\'année, supprimez-la : comptes et travaux ' +
        'sont effacés (durée de conservation prévue au registre RGPD de l\'établissement).</p>';
}

async function htmlClasse() {
    const k = vue.classe;
    const onglets = '<div class="ex-onglets"><button data-a="retour-classes">← Classes</button>' +
        ['eleves', 'seances'].map(o => '<button data-a="onglet" data-o="' + o + '"' + (vue.onglet === o ? ' class="actif"' : '') + '>' +
            (o === 'eleves' ? '👥 Élèves' : '📚 Séances') + '</button>').join('') + '</div><h3>' + esc(k.nom) + '</h3>';
    if (vue.onglet === 'eleves') {
        const d = await api('/api/eleves?classe=' + k.id);
        let h = onglets;
        if (identifiantsCrees.length) {
            h += '<div class="pf-fiche"><h3>Identifiants à distribuer <small>notez-les ou imprimez-les maintenant : les mots de passe ne seront plus affichés</small></h3>' +
                '<table class="ex-table"><tr><th>Prénom</th><th>Identifiant</th><th>Mot de passe</th></tr>' +
                identifiantsCrees.map(e => '<tr><td>' + esc(e.prenom) + '</td><td><code>' + esc(e.identifiant) + '</code></td><td><code>' + esc(e.mot_de_passe) + '</code></td></tr>').join('') +
                '</table><p class="ex-note">Adresse de connexion : <b>' + esc(location.origin) + '</b></p>' +
                '<div class="ex-boutons ex-noprint"><button data-a="imprimer">🖨 Imprimer la fiche</button><button data-a="csv-identifiants">Exporter (CSV)</button>' +
                '<button data-a="masquer-identifiants">J\'ai noté, masquer</button></div></div>';
        }
        h += d.eleves.length ? '<table class="ex-table ex-noprint"><tr><th>Prénom</th><th>Identifiant</th><th></th></tr>' +
                d.eleves.map(e => '<tr><td>' + esc(e.prenom) + '</td><td><code>' + esc(e.identifiant) + '</code></td><td>' +
                    '<button class="se-petit" data-a="reinitialiser" data-id="' + e.id + '" data-nom="' + esc(e.prenom) + '">Nouveau mot de passe</button> ' +
                    '<button class="se-petit ex-danger" data-a="supprimer-eleve" data-id="' + e.id + '" data-nom="' + esc(e.prenom) + '">Supprimer</button></td></tr>').join('') + '</table>'
            : '<p class="ex-note">Aucun élève dans cette classe.</p>';
        h += '<div class="ex-noprint"><label class="se-libre">Ajouter des élèves : un prénom par ligne (ou une initiale ; jamais de nom de famille ni d\'adresse électronique)' +
            '<textarea id="pf-prenoms" rows="4" placeholder="Léa&#10;Tom&#10;Inès"></textarea></label>' +
            '<div class="ex-boutons"><button class="ex-primaire" data-a="creer-eleves">Créer les comptes</button></div>' +
            '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
            '<details class="se-nouveau"><summary>Données de la classe (RGPD)</summary><p class="ex-note">L\'export rassemble tout ce que la plateforme garde pour cette classe ' +
            '(comptes sans mot de passe, séances, travaux) : réponse à une demande d\'accès, archive avant suppression.</p>' +
            '<div class="ex-boutons"><button data-a="export-classe">⬇ Exporter toute la classe (JSON)</button>' +
            '<button class="ex-danger" data-a="supprimer-classe">Supprimer la classe, ses comptes et ses travaux</button></div></details></div>';
        return h;
    }
    const d = await api('/api/seances?classe=' + k.id);
    let def = null;
    try { def = await S().construireSeance(); } catch (e) { def = 'séance en préparation illisible'; }
    let h = onglets;
    h += d.seances.length ? '<table class="ex-table"><tr><th>Séance</th><th>Mode</th><th>Exercices</th><th>Travaux</th><th>Rendus</th><th>État</th><th></th></tr>' +
            d.seances.map(s => '<tr><td><b>' + esc(s.titre) + '</b><br><small>publiée le ' + esc(heure(s.cree)) + '</small></td><td>' + (s.mode === 'eval' ? 'évaluation' : 'entraînement') +
                '</td><td>' + s.exercices + '</td><td>' + s.travaux + '</td><td>' + s.rendus + '</td><td>' + (s.ouverte ? '🟢 ouverte' : '🔒 fermée') + '</td><td>' +
                '<button class="ex-primaire se-petit" data-a="suivre" data-id="' + esc(s.id) + '">Suivi</button> ' +
                '<button class="se-petit" data-a="etat-seance" data-id="' + esc(s.id) + '" data-ouverte="' + (s.ouverte ? 0 : 1) + '">' + (s.ouverte ? 'Fermer' : 'Rouvrir') + '</button> ' +
                '<button class="se-petit ex-danger" data-a="supprimer-seance" data-id="' + esc(s.id) + '" data-nom="' + esc(s.titre) + '">Supprimer</button></td></tr>').join('') + '</table>'
        : '<p class="ex-note">Aucune séance publiée dans cette classe.</p>';
    h += '<h3>Publier une séance</h3>' + (typeof def === 'string'
            ? '<p class="ex-note">La séance en préparation est incomplète (' + esc(def) + ').</p>'
            : '<p>Séance en préparation : <b>' + esc(def.titre) + '</b> (' + def.exercices.length + ' exercices, ' + (def.mode === 'eval' ? 'évaluation' : 'entraînement') + ')</p>') +
        '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-a="publier"' + (typeof def === 'string' ? ' disabled' : '') + '>📤 Publier dans ' + esc(k.nom) + '</button>' +
        '<button data-a="preparer">Préparer / modifier la séance…</button></div>' +
        '<p class="ex-note">La séance se prépare dans l\'Espace enseignant (titre, mode, exercices de la banque ou les vôtres ; les groupes ne servent pas ici : ' +
        'chaque élève a son compte). Publier à nouveau la même séance la met à jour ; les élèves gardent leur travail. Une séance fermée n\'accepte plus de travaux.</p>';
    return h;
}

function lancerSuivi(v) {
    suivi = setInterval(async () => {
        if (!document.body.contains(v) || !vue.seance) { clearInterval(suivi); suivi = null; return; }
        try { await rafraichirSuivi(v); } catch (e) { /* reseau occupe : on reessaie */ }
    }, 5000);
}

async function rafraichirSuivi(v) {
    const d = await api('/api/suivi?seance=' + encodeURIComponent(vue.seance));
    dernierSuivi = d;
    const zone = $('#pf-suivi', v);
    if (!zone) return;
    const s = d.seance, maintenant = Date.now();
    const enLigne = e => e.maj && (maintenant - new Date(e.maj).getTime()) / 1000 < EN_LIGNE_S;
    const actifs = d.eleves.filter(enLigne).length, rendus = d.eleves.filter(e => e.final).length, commences = d.eleves.filter(e => e.maj).length;
    let h = '<div class="ex-onglets ex-noprint"><button data-a="retour-seances">← Séances de ' + esc(vue.classe.nom) + '</button></div>' +
        '<h3>' + esc(s.titre) + ' <small>' + (s.mode === 'eval' ? 'évaluation' : 'entraînement') + ' · ' + (s.ouverte ? '🟢 ouverte' : '🔒 fermée') + ' · ' +
        d.eleves.length + ' élèves · ' + commences + ' ont commencé · ' + actifs + ' en ligne · ' + rendus + ' rendu' + (rendus > 1 ? 's' : '') + '</small></h3>';
    h += '<div class="ex-defile"><table class="ex-table ex-classe se-table"><tr><th></th><th>Élève</th>' + s.exercices.map(x => '<th title="' + esc(x.titre) + '">' + esc(x.id) + '</th>').join('') +
        '<th>Réussis</th>' + (s.mode === 'eval' ? '<th>Note /20</th>' : '') + '<th>Dernier envoi</th><th>Rendu</th></tr>';
    for (const e of d.eleves) {
        const exos = e.exercices || [];
        h += '<tr><td title="' + (enLigne(e) ? 'en ligne' : 'hors ligne') + '">' + (enLigne(e) ? '🟢' : '⚪') + '</td><td>' + esc(e.prenom) + '</td>' +
            s.exercices.map((x, j) => {
                const r = exos.find(y => y.id === x.id);
                return '<td>' + (r ? '<button class="se-cell" data-a="voir" data-eleve="' + e.id + '" data-e="' + esc(x.id) + '" title="Ouvrir le programme : ' + esc(x.titre) +
                    ' (' + esc(r.statut) + ')">' + esc(S().cellule(r)) + '</button>' : '·') + '</td>';
            }).join('') +
            '<td>' + (exos.length ? exos.filter(x => x.statut === 'réussi').length + '/' + s.exercices.length : '—') + '</td>' +
            (s.mode === 'eval' ? '<td><b>' + (e.evaluation ? e.evaluation.note : '—') + '</b></td>' : '') +
            '<td>' + esc(heure(e.maj)) + '</td><td>' + (e.final ? '✔ ' + esc(heure(e.rendu_le)) : '—') + '</td></tr>';
    }
    zone.innerHTML = h + '</table></div><p class="ex-note">🟢 envoi il y a moins de 45 s · ✔ réussi (★ étoiles) · ✎ à corriger · … commencé · ↷ passé · ✘ échec · · non fait. ' +
        'Le travail est enregistré toutes les 20 s, même sans « Rendre ». Un clic sur une case ouvre le programme de l\'élève.</p>' +
        '<div class="ex-boutons ex-noprint"><button data-a="csv-suivi">Exporter les résultats (CSV)</button><button data-a="imprimer">🖨 Imprimer</button>' +
        '<button data-a="etat-seance" data-id="' + esc(s.id) + '" data-ouverte="' + (s.ouverte ? 0 : 1) + '">' + (s.ouverte ? '🔒 Fermer la séance' : 'Rouvrir la séance') + '</button></div>';
}

async function action(ev, v) {
    if (ev.target.closest('[data-f="fermer"]')) { fermer(); return; }
    const a = ev.target.closest('[data-a]');
    if (!a) return;
    const erreur = t => { const e = $('#se-erreur', v); if (e) e.textContent = t; else alert(t); };
    const act = a.dataset.a;
    try {
        if (act === 'creer-classe') {
            const nom = $('#pf-nouvelle-classe', v).value.trim();
            if (!nom) { erreur('Donnez un nom à la classe.'); return; }
            const r = await api('/api/classes', { nom });
            vue = { classe: { id: r.id, nom }, onglet: 'eleves', seance: null };
        } else if (act === 'ouvrir-classe') {
            vue = { classe: { id: Number(a.dataset.id), nom: a.dataset.nom }, onglet: 'eleves', seance: null };
            identifiantsCrees = [];
        } else if (act === 'retour-classes') {
            vue = { classe: null, onglet: 'eleves', seance: null }; identifiantsCrees = [];
        } else if (act === 'onglet') {
            vue.onglet = a.dataset.o;
        } else if (act === 'retour-seances') {
            vue.seance = null; vue.onglet = 'seances';
        } else if (act === 'creer-eleves') {
            const prenoms = $('#pf-prenoms', v).value.split(/\r?\n|,/).map(t => t.trim()).filter(Boolean);
            if (!prenoms.length) { erreur('Écrivez au moins un prénom.'); return; }
            if (prenoms.some(p => /@|\d{3,}/.test(p)) || prenoms.some(p => p.split(/\s+/).length > 2)) {
                if (!confirm('Certaines lignes ressemblent à un nom complet, une adresse ou un numéro.\nPour protéger les élèves, n\'indiquez que le prénom (ou une initiale).\nCréer quand même ?')) return;
            }
            const r = await api('/api/eleves/creer', { classe: vue.classe.id, prenoms });
            identifiantsCrees = identifiantsCrees.concat(r.eleves);
        } else if (act === 'reinitialiser') {
            if (!confirm('Donner un nouveau mot de passe à ' + a.dataset.nom + ' ? L\'ancien ne fonctionnera plus.')) return;
            const r = await api('/api/eleves/reinitialiser', { id: Number(a.dataset.id) });
            identifiantsCrees = identifiantsCrees.filter(e => e.identifiant !== r.identifiant).concat([r]);
        } else if (act === 'supprimer-eleve') {
            if (!confirm('Supprimer le compte de ' + a.dataset.nom + ' et tous ses travaux ? C\'est définitif.')) return;
            await api('/api/eleves/supprimer', { id: Number(a.dataset.id) });
        } else if (act === 'masquer-identifiants') {
            identifiantsCrees = [];
        } else if (act === 'csv-identifiants') {
            telecharger('identifiants_' + S().morceau(vue.classe.nom) + '.csv',
                csv([['Classe', 'Prénom', 'Identifiant', 'Mot de passe', 'Adresse']].concat(identifiantsCrees.map(e => [vue.classe.nom, e.prenom, e.identifiant, e.mot_de_passe, location.origin]))),
                'text/csv;charset=utf-8');
            return;
        } else if (act === 'imprimer') {
            window.print(); return;
        } else if (act === 'export-classe') {
            const d = await api('/api/export?classe=' + vue.classe.id);
            telecharger('export_' + S().morceau(vue.classe.nom) + '.json', JSON.stringify(d, null, 1), 'application/json;charset=utf-8');
            return;
        } else if (act === 'supprimer-classe') {
            const saisie = prompt('Supprimer définitivement la classe « ' + vue.classe.nom + ' », les comptes de ses élèves, ses séances et tous les travaux ?\n' +
                'Pensez à exporter avant si vous voulez garder une archive.\nÉcrivez SUPPRIMER pour confirmer :');
            if (saisie !== 'SUPPRIMER') return;
            await api('/api/classes/supprimer', { id: vue.classe.id });
            vue = { classe: null, onglet: 'eleves', seance: null }; identifiantsCrees = [];
        } else if (act === 'publier') {
            const def = await S().construireSeance();
            if (typeof def === 'string') { erreur(def); return; }
            const r = await api('/api/seances/publier', { classe: vue.classe.id, seance: def });
            alert(r.mise_a_jour ? 'Séance mise à jour : les élèves voient la nouvelle version.' : 'Séance publiée : les élèves de ' + vue.classe.nom + ' la trouvent dans « Mes séances en ligne ».');
        } else if (act === 'preparer') {
            fermer(); S().fenetreEnseignant('creer'); return;
        } else if (act === 'suivre') {
            vue.seance = a.dataset.id;
        } else if (act === 'etat-seance') {
            await api('/api/seances/etat', { id: a.dataset.id, ouverte: a.dataset.ouverte === '1' });
        } else if (act === 'supprimer-seance') {
            if (!confirm('Supprimer la séance « ' + a.dataset.nom + ' » et tous les travaux des élèves pour cette séance ? C\'est définitif.')) return;
            await api('/api/seances/supprimer', { id: a.dataset.id });
        } else if (act === 'csv-suivi') {
            if (!dernierSuivi) return;
            const complets = [];
            for (const e of dernierSuivi.eleves.filter(x => x.maj)) {
                try { complets.push((await api('/api/travail?seance=' + encodeURIComponent(vue.seance) + '&eleve=' + e.id)).rendu); } catch (err) { /* ignore */ }
            }
            telecharger('resultats_' + S().morceau(vue.classe.nom) + '_' + S().morceau(dernierSuivi.seance.titre) + '.csv', S().csvDepuis(complets), 'text/csv;charset=utf-8');
            return;
        } else if (act === 'voir') {
            const r = (await api('/api/travail?seance=' + encodeURIComponent(vue.seance) + '&eleve=' + a.dataset.eleve)).rendu;
            const e = r.exercices.find(x => x.id === a.dataset.e);
            if (!e || !e.blocs) { alert('Pas encore de programme pour cet exercice.'); return; }
            if (!S().espaceVierge() && !confirm('Ouvrir le programme de ' + r.eleves.join(', ') + ' remplace le programme de l\'éditeur.\nContinuer ?')) return;
            Blockly.serialization.workspaces.load(e.blocs, window.workspace);
            const champ = $('#nom-fichier');
            if (champ) { champ.value = S().morceau(r.eleves.join('-')) + '_' + S().morceau(e.id); champ.dispatchEvent(new Event('input')); }
            fermer();
            return;
        } else return;
        await afficher(v);
    } catch (e) { erreur(e.message); }
}

// ---------------------------------------------------------------- demarrage
async function chargerMoi() {
    try { moi = await api('/api/moi'); } catch (e) { moi = { role: null }; }
    // Autre personne sur ce poste, ou session expiree : la seance en ligne de l'eleve precedent est fermee et effacee
    // du navigateur (son travail est deja en ligne, envoye il y a moins de 20 s).
    const active = S().seanceActive();
    if (active && active.classe && active.classe.plateforme && (moi.role !== 'eleve' || active.classe.eleve !== moi.id)) oublierSeancesDuPoste();
    majBoutons();
}

async function demarrer() {
    try { const r = await fetch('/api/info', { cache: 'no-store' }); info = r.ok ? await r.json() : null; } catch (e) { info = null; }
    if (!info || !info.plateforme || !S()) return;          // pas sur la plateforme : rien ne change
    window.plateforme = { envoyer, info: () => info, moi: () => moi, fenetreConnexion, fenetreProf, fenetreMesSeances };
    const lier = (id, f) => { const b = $('#' + id); if (b) b.addEventListener('click', f); };
    lier('pf-compte-btn', fenetreCompte);
    lier('pf-seances-btn', fenetreMesSeances);
    lier('pf-prof-btn', fenetreProf);
    await chargerMoi();
    if (!moi.role) fenetreConnexion('Bienvenue ! Connecte-toi pour retrouver tes séances.');
    else if (moi.role === 'eleve' && !moteur().active()) fenetreMesSeances();
}

const style = document.createElement('style');
style.textContent = `
.pf-fiche { border: 2px solid #ff5501; border-radius: 10px; padding: 8px 14px; margin: 10px 0; background: rgba(255, 85, 1, .06); }
@media print { .pf-fiche { border: none; } }
`;
document.head.appendChild(style);

demarrer();
