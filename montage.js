// montage.js — vue « montage » du simulateur : la micro:bit enfichee dans sa carte d'extension
// (Grove Shield v2.0 de Seeed, ou carte moteurs DFRobot DFR0548), les modules du programme
// disposes autour et relies par leurs cables.
//
// Le montage est un dessin statique : il montre OU chaque module est branche, d'apres les blocs
// poses. L'etat des modules (LED, curseurs, moteurs qui tournent) reste dans la liste
// « Peripheriques » du simulateur. La carte micro:bit n'est pas copiee : #microbit-board est
// deplace dans le montage a l'ouverture et remis a sa place a la fermeture, avec ses
// identifiants et ses ecouteurs (broches, logo, boutons A et B, LED).
//
// Proportions : la micro:bit (52 mm) fait 280 unites, soit 5,4 unites par mm ; la carte Grove
// (72 mm x 72 mm) en fait 388. La Grove Shield v2.0 suit les photos du fabricant (ports, pastilles,
// connecteur) ; la DFR0548 et la disposition de ses connecteurs sont stylisees.

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const LARGEUR = 1000;                                   // largeur de la scene, en unites
const CARTE = { x: 360, y: 20, l: 280, h: 230 };        // place de la micro:bit dans la scene
const FENTE = { x: 340, y: 228, l: 320, h: 34 };        // fente noire du connecteur de la carte d'extension (DFR0548)
const FENTE_GROVE = { x: 344, y: 226, l: 312, h: 58 };  // connecteur de la Grove Shield v2.0 (35 a 46 mm du haut)
const MODULE = { l: 170, h: 74 };                       // zone de dessin d'un module (hors libelles)

// ---------- Couleurs des fils ----------
const GROVE = ['#f2c230', '#f4f4f4', '#d63a2f', '#1b1b1b'];   // jaune SIG1, blanc SIG2, rouge VCC, noir GND
const F = { jaune: '#f2c230', blanc: '#f4f4f4', rouge: '#d63a2f', noir: '#1b1b1b',
            orange: '#f08a24', marron: '#6d4026', bleu: '#3a7bd5', rose: '#e58fb5', vert: '#2e9b4f' };

// ---------- Modules reconnus dans le programme ----------
// champs : listes deroulantes de broches du bloc ; i2c : module branche sur le bus I2C.
const MODULES = [
    { motif: /^grove_led_(etat|luminosite)$/,  nom: 'LED',                   champs: ['BROCHE'], picto: 'led' },
    { motif: /^grove_ruban_definir$/,         nom: 'Ruban RGB',             champs: ['BROCHE'], picto: 'ruban', large: true },
    { motif: /^grove_4d_definir$/,            nom: 'Afficheur 4 digits',    champs: ['CLK', 'DIO'], picto: '4d', large: true },
    { motif: /^grove_ultrason_/,              nom: 'Ultrason',              champs: ['BROCHE'], picto: 'ultrason', large: true },
    { motif: /^grove_joystick_(valeur|bouton)$/, nom: 'Joystick',           champs: ['BROCHE'], picto: 'joystick' },
    { motif: /^grove_joystick_direction$/,    nom: 'Joystick',              champs: ['X', 'Y'], picto: 'joystick' },
    { motif: /^grove_potentiometre$/,         nom: 'Potentiomètre',         champs: ['BROCHE'], picto: 'pot' },
    { motif: /^grove_bouton_/,                nom: 'Bouton poussoir',       champs: ['BROCHE'], picto: 'bouton' },
    { motif: /^grove_lumiere$/,               nom: 'Capteur de lumière',    champs: ['BROCHE'], picto: 'lumiere' },
    { motif: /^grove_pir$/,                   nom: 'Détecteur de mouvement', champs: ['BROCHE'], picto: 'pir' },
    { motif: /^grove_buzzer_/,                nom: 'Buzzer',                champs: ['BROCHE'], picto: 'buzzer' },
    { motif: /^grove_relais$/,                nom: 'Relais',                champs: ['BROCHE'], picto: 'relais' },
    { motif: /^grove_dht11_definir$/,         nom: 'DHT11',                 champs: ['BROCHE'], picto: 'dht' },
    { motif: /^grove_dht22_definir$/,         nom: 'DHT22',                 champs: ['BROCHE'], picto: 'dht' },
    { motif: /^grove_barre_/,                 nom: 'Barre de LED',          champs: ['PORT'], picto: 'barre', large: true },
    { motif: /^servo_/,                       nom: 'Servomoteur',           champs: ['BROCHE'], picto: 'servo', servo: true },
    { motif: /^grove_oled_/,                  nom: 'Écran OLED',            i2c: true, picto: 'oled', large: true },
    { motif: /^grove_lcd_/,                   nom: 'Écran LCD 16×2',        i2c: true, picto: 'lcd', large: true },
    { motif: /^grove_lcdrgb_/,                nom: 'Écran LCD RGB',         i2c: true, picto: 'lcdrgb', large: true },
    { motif: /^grove_bmp280$/,                nom: 'Capteur de pression',   i2c: true, picto: 'puce' },
    { motif: /^grove_sgp30$/,                 nom: 'Capteur COV',           i2c: true, picto: 'puce' },
    { motif: /^grove_rtc_/,                   nom: 'Horloge RTC',           i2c: true, picto: 'rtc' },
    { motif: /^grove_pca_/,                   nom: 'Carte servos PCA9685',  i2c: true, picto: 'pca', large: true },
    { motif: /^grove_gestes_/,                nom: 'Capteur de gestes',     i2c: true, picto: 'puce' },
    { motif: /^grove_th_/,                    nom: 'Température, humidité', i2c: true, picto: 'puce' },
    { motif: /^grove_couleur_/,               nom: 'Capteur de couleur',    i2c: true, picto: 'couleur' },
    { motif: /^grove_moteur_/,                nom: 'Pilote de moteurs I2C', i2c: true, picto: 'pilote' },
    { motif: /^grove_scd30_/,                 nom: 'Capteur CO₂ SCD30',     i2c: true, picto: 'puce', large: true },
    { motif: /^grove_scd41_/,                 nom: 'Capteur CO₂ SCD41',     i2c: true, picto: 'puce' },
];
const BLOC_EXTENSION = /^(grove_|servo_|dfr_)/;

// ---------- Cartes d'extension ----------
// Chaque point de branchement donne l'origine des fils (x, y), leur direction de sortie (d)
// et l'ecart entre fils voisins le long du connecteur (pas, dans le sens perpendiculaire).
// Grove Shield v2.0 relevee sur les photos du fabricant : carte noire 72 x 72 mm (x 306 a 694, y 39 a 427)
// echancree en haut entre deux oreilles, micro:bit couchee sur la moitie haute et enfichee dans le connecteur
// du milieu, 4 ports Grove alignes en bas et ouverts vers le bas, 8 pastilles pour pinces crocodile sur les bords.
const GROVE_PCB = { x: 306, y: 39, l: 388, oreille: 58, encoche: 65 };
const PORTS_GROVE = {
    'I2C':    { x: 388, y: 404, d: [0, 1] }, 'P0/P14': { x: 462, y: 404, d: [0, 1] },
    'P1/P15': { x: 536, y: 404, d: [0, 1] }, 'P2/P16': { x: 611, y: 404, d: [0, 1] },
};
const PORT_DE_BROCHE = { pin0: 'P0/P14', pin14: 'P0/P14', pin1: 'P1/P15', pin15: 'P1/P15', pin2: 'P2/P16', pin16: 'P2/P16' };
// Pastilles (pinces crocodile ou fiches banane 4 mm) : GND, P8, P12, P13 a gauche ; 3V3, P0, P1, P2 a droite.
const PASTILLES_GROVE = {
    GND: { x: 322, y: 57, d: [-1, 0] },  P8: { x: 322, y: 115, d: [-1, 0] },
    P12: { x: 322, y: 355, d: [-1, 0] }, P13: { x: 322, y: 406, d: [-1, 0] },
    '3V3': { x: 678, y: 57, d: [1, 0] }, P0: { x: 678, y: 115, d: [1, 0] },
    P1: { x: 678, y: 355, d: [1, 0] },   P2: { x: 678, y: 406, d: [1, 0] },
};
const Y_SOUS_GROVE = 446;   // passage du fil 3V3 sous la carte, vers les modules de gauche

const GPIO_DFR = { P0: 340, P1: 380, P2: 420, P8: 460, P12: 500, P13: 340, P14: 380, P15: 420, P16: 460 };
const GAUCHE_DFR = ['P0', 'P1', 'P2', 'P8', 'P12'];
const MOTEURS_DFR = { 1: [280, 236, -1], 2: [280, 290, -1], 3: [720, 236, 1], 4: [720, 290, 1] };
const Y_SERVOS_DFR = 680;
const xServoDfr = n => 340 + (n - 1) * 40;

// ---------- Lecture du programme ----------
function broches(bloc, champs) {
    const res = [];
    for (const c of champs || []) {
        const v = bloc.getFieldValue(c);
        if (v) for (const p of String(v).split(/\s*,\s*/)) if (!res.includes(p)) res.push(p);
    }
    return res;
}

/** Modules a dessiner, chacun avec ses fils : [{ nom, picto, large, etiquette, note, fils: [{x, y, d, c}] }]. */
function lireMontage() {
    const blocs = window.workspace ? window.workspace.getAllBlocks(false) : [];
    const types = blocs.map(b => b.type);
    const dfr = types.some(t => /^dfr_/.test(t));
    const utile = types.some(t => BLOC_EXTENSION.test(t));
    const modules = new Map();
    const ajouter = (cle, m) => { if (!modules.has(cle)) modules.set(cle, m); };

    for (const b of blocs) {
        if (dfr && /^dfr_(moteur|moteur_arreter)$/.test(b.type)) {
            const n = b.getFieldValue('MOTEUR');
            if (!MOTEURS_DFR[n]) continue;
            const [x, y, s] = MOTEURS_DFR[n];
            ajouter('M' + n, { nom: 'Moteur C.C.', picto: 'moteur', large: true, etiquette: 'M' + n, occupe: ['M' + n],
                fils: [{ x, y: y - 10, d: [s, 0], c: F.rouge }, { x, y: y + 10, d: [s, 0], c: F.noir }] });
            continue;
        }
        if (dfr && b.type === 'dfr_pas_a_pas') {
            const paire = b.getFieldValue('PAIRE'), modele = b.getFieldValue('MODELE') === '42' ? '42BYGH' : '28BYJ-48';
            const [a, c] = paire === '2' ? [3, 4] : [1, 2];
            const couleurs = modele === '42BYGH' ? [F.noir, F.vert, F.rouge, F.bleu] : [F.orange, F.rose, F.jaune, F.bleu];
            const fils = [];
            [a, c].forEach((n, i) => { const [x, y, s] = MOTEURS_DFR[n];
                fils.push({ x, y: y - 10, d: [s, 0], c: couleurs[i * 2] }, { x, y: y + 10, d: [s, 0], c: couleurs[i * 2 + 1] }); });
            ajouter('PAS' + paire, { nom: 'Pas à pas ' + modele, picto: 'pas', modele, etiquette: 'M' + a + ' + M' + c, occupe: ['M' + a, 'M' + c], fils });
            continue;
        }
        if (dfr && b.type === 'dfr_servo') {
            const n = Number(b.getFieldValue('SERVO')), x = xServoDfr(n);
            ajouter('S' + n, { nom: 'Servomoteur', picto: 'servo', etiquette: 'S' + n, occupe: ['S' + n],
                fils: [{ x: x - 9, y: Y_SERVOS_DFR, d: [0, 1], c: F.orange }, { x, y: Y_SERVOS_DFR, d: [0, 1], c: F.rouge },
                       { x: x + 9, y: Y_SERVOS_DFR, d: [0, 1], c: F.marron }] });
            continue;
        }
        const def = MODULES.find(m => m.motif.test(b.type));
        if (!def) continue;
        if (def.i2c) {
            ajouter(def.nom, { nom: def.nom, picto: def.picto, large: def.large, etiquette: 'I2C', i2c: true,
                fils: dfr ? filsI2cDfr() : filsPort(PORTS_GROVE.I2C) });
            continue;
        }
        const pins = broches(b, def.champs);
        if (!pins.length) continue;
        const cle = def.nom + '|' + pins.join(',');
        if (modules.has(cle)) continue;
        ajouter(cle, Object.assign({ nom: def.nom, picto: def.picto, large: def.large, pins },
            dfr ? branchementDfr(pins, def.servo) : branchementGrove(pins)));
    }

    // Deux modules sur le meme port (ou la meme broche) : possible dans le programme, pas sur la table.
    const parPort = {};
    for (const m of modules.values()) for (const k of m.occupe || []) (parPort[k] = parPort[k] || []).push(m);
    for (const liste of Object.values(parPort)) if (liste.length > 1) liste.forEach(m => { m.alerte = '⚠ port partagé'; });
    const i2c = [...modules.values()].filter(m => m.i2c);
    if (i2c.length > 1) i2c.forEach(m => { m.note = 'bus I2C partagé'; });

    return { utile, carte: dfr ? 'dfr' : 'grove', modules: [...modules.values()] };
}

function filsPort(p) {
    // Les 4 fils sortent cote a cote du connecteur, perpendiculairement a la direction de sortie
    // (vers le bas sur la Grove v2.0 : GND, 3V3, signal 2, signal 1 de gauche a droite, comme sur la carte).
    return GROVE.map((c, i) => ({ x: p.x - p.d[1] * (i - 1.5) * 8, y: p.y + p.d[0] * (i - 1.5) * 8, d: p.d, c }));
}
function filsI2cDfr() {
    return GROVE.map((c, i) => ({ x: 720, y: 540 + (i - 1.5) * 8, d: [1, 0], c }));
}

function branchementGrove(pins) {
    const fils = [], etiquettes = [];
    let horsGrove = false;
    for (const port of [...new Set(pins.map(p => PORT_DE_BROCHE[p]).filter(Boolean))]) {
        fils.push(...filsPort(PORTS_GROVE[port]));
        etiquettes.push(port);
    }
    const autres = pins.filter(p => !PORT_DE_BROCHE[p]);
    if (autres.length) {
        // Pastilles du bord : un fil a pince crocodile par signal, plus GND (a gauche) et 3V3 (a droite, le fil
        // passe sous la carte pour rejoindre le module, range a gauche avec les pastilles P8, P12 et P13).
        horsGrove = true;
        const pince = nom => Object.assign({ pince: true }, PASTILLES_GROVE[nom]);
        autres.forEach((p, i) => { if (PASTILLES_GROVE['P' + p.slice(3)]) fils.push(Object.assign(pince('P' + p.slice(3)), { c: i ? F.blanc : F.jaune })); });
        const v = PASTILLES_GROVE['3V3'];
        fils.push(Object.assign(pince('GND'), { c: F.noir }),
                  Object.assign(pince('3V3'), { c: F.rouge, passage: [[v.x + 46, v.y], [v.x + 46, Y_SOUS_GROVE], [GROVE_PCB.x - 20, Y_SOUS_GROVE]] }));
        etiquettes.push(autres.map(p => 'P' + p.slice(3)).join('/'));
    }
    const occupe = [...new Set(pins.map(p => PORT_DE_BROCHE[p] || 'P' + p.slice(3)))];
    return { fils, etiquette: etiquettes.join(' + '), note: horsGrove ? 'hors port Grove' : '', occupe };
}

function branchementDfr(pins, servo) {
    // Connecteurs a 3 broches (signal, V, G) : cable complet sur le premier signal, fil seul pour les suivants.
    const fils = [];
    pins.forEach((p, i) => {
        const nom = 'P' + p.slice(3), y = GPIO_DFR[nom];
        if (y === undefined) return;
        const gauche = GAUCHE_DFR.includes(nom), x = gauche ? 280 : 720, d = [gauche ? -1 : 1, 0];
        const sig = servo ? F.orange : (i ? F.blanc : F.jaune);
        fils.push({ x, y: y - 9, d, c: sig });
        if (!i) fils.push({ x, y, d, c: F.rouge }, { x, y: y + 9, d, c: servo ? F.marron : F.noir });
    });
    const noms = pins.map(p => 'P' + p.slice(3));
    return { fils, etiquette: noms.join(' + '), occupe: noms };
}

// ---------- Disposition des modules autour de la carte ----------
function disposer(modules, basCarte) {
    const cotes = { g: [], d: [], b: [] };
    for (const m of modules) {
        if (!m.fils.length) continue;
        const [dx] = m.fils[0].d;
        m.cote = dx < 0 ? 'g' : dx > 0 ? 'd' : 'b';
        m.ancre = m.fils.reduce((s, f) => [s[0] + f.x / m.fils.length, s[1] + f.y / m.fils.length], [0, 0]);
        cotes[m.cote].push(m);
    }
    let bas = basCarte;
    for (const c of ['g', 'd']) {
        let y = 16;
        cotes[c].sort((a, b) => a.ancre[1] - b.ancre[1]).forEach(m => {
            m.y = Math.max(y, m.ancre[1] - 60);
            m.x = c === 'g' ? 30 : LARGEUR - 30 - MODULE.l;
            y = m.y + MODULE.h + 76;
            bas = Math.max(bas, y);
        });
    }
    // Rangee du bas (les ports Grove v2.0 sont tous en bas) : chaque module sous son port, a la ligne si elle deborde.
    // Chaque ligne est centree sous ses ports, sans sortir de la scene.
    const [xMin, xMax, pas] = [30, LARGEUR - 30, MODULE.l + 20];
    const parLigne = Math.floor((xMax - xMin + 20) / pas);
    const tries = cotes.b.sort((a, b) => a.ancre[0] - b.ancre[0]);
    for (let i = 0; i < tries.length; i += parLigne) {
        const ligne = tries.slice(i, i + parLigne), largeur = ligne.length * pas - 20;
        const centre = ligne.reduce((s, m) => s + m.ancre[0], 0) / ligne.length;
        const x0 = Math.max(xMin, Math.min(centre - largeur / 2, xMax - largeur));
        ligne.forEach((m, k) => {
            m.x = x0 + k * pas;
            m.y = basCarte + 90 + (i / parLigne) * (MODULE.h + 90);
            bas = Math.max(bas, m.y + MODULE.h + 76);
        });
    }
    return bas + 10;
}

/** Point d'arrivee du cable sur le module (cote tourne vers la carte) et direction d'arrivee. */
function arrivee(m) {
    if (m.cote === 'g') return { x: m.x + MODULE.l / 2 + largeurPcb(m) / 2 + 8, y: m.y + MODULE.h / 2, d: [-1, 0] };
    if (m.cote === 'd') return { x: m.x + MODULE.l / 2 - largeurPcb(m) / 2 - 8, y: m.y + MODULE.h / 2, d: [1, 0] };
    return { x: m.x + MODULE.l / 2, y: m.y - 6, d: [0, 1] };
}
const largeurPcb = m => (m.large ? 150 : 74);

// ---------- Dessin ----------
const r = (x, y, l, h, att) => `<rect x="${x}" y="${y}" width="${l}" height="${h}" ${att || ''}/>`;
const cercle = (x, y, rayon, att) => `<circle cx="${x}" cy="${y}" r="${rayon}" ${att || ''}/>`;
const texte = (x, y, t, att) => `<text x="${x}" y="${y}" ${att || ''}>${t}</text>`;
const echap = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function trou(x, y) { return cercle(x, y, 9, 'fill="#c9a54a"') + cercle(x, y, 5, 'fill="#0b0b0b"'); }

function dessinCarteGrove() {
    const { x, y, l, oreille, encoche } = GROVE_PCB, droite = x + l, bas = y + l;
    // Carte noire echancree en haut : la micro:bit couvre l'echancrure.
    let s = `<path d="M${x + 8} ${y} H${x + oreille} V${y + encoche} H${droite - oreille} V${y} H${droite - 8} Q${droite} ${y} ${droite} ${y + 8} ` +
            `V${bas - 8} Q${droite} ${bas} ${droite - 8} ${bas} H${x + 8} Q${x} ${bas} ${x} ${bas - 8} V${y + 8} Q${x} ${y} ${x + 8} ${y} Z" ` +
            'fill="#111214" stroke="#34383e" stroke-width="2"/>';
    // Prise micro USB et voyant PWR a gauche, connecteur plat a droite, quelques composants.
    s += r(x - 4, 166, 30, 30, 'rx="3" fill="#b9bec4" stroke="#7d838a"') + r(x + 2, 174, 18, 14, 'rx="2" fill="#5d636a"');
    // Textes verticaux, comme sur la carte : a l'horizontale, la micro:bit les cacherait.
    const vertical = (tx, ty, t) => texte(tx, ty, t, `class="montage-serigraphie petite" text-anchor="middle" dominant-baseline="central" transform="rotate(90 ${tx} ${ty})"`);
    s += vertical(x + 40, 181, 'USB');
    s += r(x + 14, 250, 10, 6, 'fill="#e8e8e8"') + vertical(x + 40, 253, 'PWR');
    s += r(droite - 30, 186, 18, 80, 'rx="2" fill="#e6dcc6" stroke="#9b917c"') + r(droite - 26, 192, 6, 68, 'fill="#3b3b3b"');
    [[372, 300], [398, 300], [600, 300], [626, 300]].forEach(([cx, cy]) => {
        s += r(cx, cy, 14, 8, 'fill="#c9a26a"') + r(cx + 4, cy, 6, 8, 'fill="#3a2f22"'); });
    // Pastilles pour pinces crocodile : cuivre au bord, nom sous forme verticale comme sur la carte.
    for (const [nom, p] of Object.entries(PASTILLES_GROVE)) {
        const g = p.d[0] < 0, bord = g ? x : droite - 34;
        s += r(bord, p.y - 17, 34, 34, 'rx="9" fill="#d9822b"') + cercle(p.x, p.y, 12, 'fill="#f0b45e"') +
             cercle(p.x, p.y, 7, 'style="fill: var(--fond-chrome)"');
        const tx = g ? p.x + 26 : p.x - 26;
        s += texte(tx, p.y, nom, `class="montage-serigraphie petite" text-anchor="middle" dominant-baseline="central" transform="rotate(${g ? 90 : -90} ${tx} ${p.y})"`);
    }
    // Ports Grove blancs, ouverts vers le bas ; leur nom est imprime dessous sur la carte, mais les cables le
    // cacheraient : il passe au-dessus, a la place des noms de fils (GND, 3V3...) trop petits a cette echelle.
    for (const [nom, p] of Object.entries(PORTS_GROVE)) {
        s += r(p.x - 27, p.y - 52, 54, 52, 'rx="3" fill="#f2f2f2" stroke="#b9b9b9"');
        s += r(p.x - 20, p.y - 32, 40, 30, 'rx="2" fill="#d6d6d6" stroke="#c2c2c2"') + r(p.x - 8, p.y - 40, 16, 8, 'fill="#d6d6d6"');
        [-12, -4, 4, 12].forEach(dx => { s += r(p.x + dx - 1.5, p.y - 26, 3, 14, 'fill="#c9a54a"'); });
        s += texte(p.x, p.y - 62, nom, 'class="montage-serigraphie" text-anchor="middle"');
    }
    return s;
}

function dessinCarteDfr() {
    let s = r(280, 200, 440, 500, 'rx="14" fill="#15171a" stroke="#3b414a" stroke-width="2"');
    s += trou(302, 680) + trou(698, 680) + trou(302, 222) + trou(698, 222);
    for (const [n, [x, y, sens]] of Object.entries(MOTEURS_DFR)) {
        const bx = sens < 0 ? x : x - 26;
        s += r(bx, y - 24, 26, 48, 'rx="3" fill="#2f9e5b" stroke="#1d6b3c"');
        s += cercle(bx + 13, y - 10, 7, 'fill="#c0c4c8" stroke="#6b7075"') + cercle(bx + 13, y + 10, 7, 'fill="#c0c4c8" stroke="#6b7075"');
        s += texte(sens < 0 ? bx + 36 : bx - 10, y + 6, 'M' + n, `class="montage-serigraphie" text-anchor="${sens < 0 ? 'start' : 'end'}"`);
    }
    for (const [nom, y] of Object.entries(GPIO_DFR)) {
        const g = GAUCHE_DFR.includes(nom), x = g ? 280 : 706;
        s += r(x, y - 15, 14, 30, 'fill="#0e0e0e"');
        [-9, 0, 9].forEach(dy => { s += r(x + 4, y + dy - 3, 6, 6, 'fill="#c9a54a"'); });
        s += texte(g ? x + 24 : x - 10, y + 5, nom, `class="montage-serigraphie petite" text-anchor="${g ? 'start' : 'end'}"`);
    }
    s += r(706, 522, 14, 36, 'fill="#0e0e0e"');
    [-12, -4, 4, 12].forEach(dy => { s += r(710, 540 + dy - 3, 6, 6, 'fill="#c9a54a"'); });
    s += texte(696, 545, 'I2C', 'class="montage-serigraphie petite" text-anchor="end"');
    for (let n = 1; n <= 8; n++) {
        const x = xServoDfr(n);
        s += r(x - 15, Y_SERVOS_DFR - 14, 30, 14, 'fill="#0e0e0e"');
        [['#f2c230', -9], ['#d63a2f', 0], ['#1b1b1b', 9]].forEach(([c, dx]) => {
            s += r(x + dx - 3, Y_SERVOS_DFR - 10, 6, 6, `fill="${c}" stroke="#c9a54a"`); });
        s += texte(x, Y_SERVOS_DFR - 22, 'S' + n, 'class="montage-serigraphie petite" text-anchor="middle"');
    }
    s += texte(500, 610, 'DFR0548 · carte moteurs', 'class="montage-serigraphie" text-anchor="middle"');
    return s;
}

/** Dessin d'un module, centre sur (cx, cy), connecteur tourne vers la carte. */
function dessinModule(m, cx, cy) {
    const dessins = window.dessinsMoteursDfr;
    const imbrique = (svg, l, h) => svg.replace('<svg ', `<svg x="${cx - l / 2}" y="${cy - h / 2}" width="${l}" height="${h}" `);
    if (m.picto === 'moteur' && dessins) return imbrique(dessins.tt, 150, 80);
    if (m.picto === 'pas' && dessins) return imbrique(dessins.pas[m.modele] || dessins.pas['28BYJ-48'], 80, 80);
    if (m.picto === 'servo') {
        return r(cx - 40, cy - 18, 80, 36, 'rx="4" fill="#2c64c4" stroke="#173f85"') + r(cx - 52, cy - 6, 104, 12, 'rx="3" fill="#2c64c4"') +
               cercle(cx + 18, cy, 12, 'fill="#e6e6e6"') + r(cx + 14, cy - 34, 8, 40, 'rx="4" fill="#f5f5f5" stroke="#bbb"');
    }
    const l = largeurPcb(m), h = 74;
    let s = r(cx - l / 2, cy - h / 2, l, h, 'rx="6" fill="#3d8f4a" stroke="#2a6534"');
    s += cercle(cx - l / 2 + 9, cy - h / 2 + 9, 4, 'fill="#c9a54a"') + cercle(cx + l / 2 - 9, cy + h / 2 - 9, 4, 'fill="#c9a54a"');
    // Connecteur Grove blanc, sur le bord tourne vers la carte.
    if (m.cote === 'g') s += r(cx + l / 2 - 2, cy - 14, 10, 28, 'rx="2" fill="#f2f2f2" stroke="#b9b9b9"');
    else if (m.cote === 'd') s += r(cx - l / 2 - 8, cy - 14, 10, 28, 'rx="2" fill="#f2f2f2" stroke="#b9b9b9"');
    else s += r(cx - 14, cy - h / 2 - 8, 28, 10, 'rx="2" fill="#f2f2f2" stroke="#b9b9b9"');
    switch (m.picto) {
        case 'led': s += cercle(cx, cy, 15, 'fill="#e53935" stroke="#8e1c1a"') + cercle(cx - 5, cy - 5, 4, 'fill="#ff9d9a"'); break;
        case 'bouton': s += r(cx - 18, cy - 18, 36, 36, 'rx="3" fill="#202020"') + cercle(cx, cy, 11, 'fill="#3a3a3a" stroke="#555"'); break;
        case 'pot': s += r(cx - 18, cy - 18, 36, 36, 'rx="3" fill="#2c64c4"') + cercle(cx, cy, 12, 'fill="#e6e6e6"') + r(cx - 2, cy - 12, 4, 10, 'fill="#555"'); break;
        case 'joystick': s += cercle(cx, cy, 24, 'fill="#262626"') + cercle(cx, cy, 13, 'fill="#4a4a4a" stroke="#777"'); break;
        case 'lumiere': s += cercle(cx, cy, 13, 'fill="#e8913a" stroke="#a65d18"') + `<path d="M${cx - 8} ${cy - 3} h4 v6 h4 v-6 h4 v6 h4" stroke="#7a3f0a" stroke-width="2" fill="none"/>`; break;
        case 'pir': s += cercle(cx, cy, 24, 'fill="#f4f4f4" stroke="#c9c9c9"') + cercle(cx, cy, 14, 'fill="none" stroke="#dcdcdc"'); break;
        case 'buzzer': s += cercle(cx, cy, 20, 'fill="#1e1e1e"') + cercle(cx, cy, 4, 'fill="#555"'); break;
        case 'relais': s += r(cx - 24, cy - 20, 48, 40, 'rx="3" fill="#2c64c4"') + texte(cx, cy + 5, 'RELAIS', 'class="montage-puce" text-anchor="middle"'); break;
        case 'dht': s += r(cx - 18, cy - 24, 36, 48, 'rx="3" fill="#7fb3e6"') + [0, 1, 2, 3].map(i => r(cx - 12, cy - 18 + i * 10, 24, 4, 'fill="#4a7fb8"')).join(''); break;
        case 'ultrason': s += cercle(cx - 32, cy, 24, 'fill="#c9cfd6" stroke="#7f8790"') + cercle(cx + 32, cy, 24, 'fill="#c9cfd6" stroke="#7f8790"') +
                              cercle(cx - 32, cy, 15, 'fill="#3a3f45"') + cercle(cx + 32, cy, 15, 'fill="#3a3f45"'); break;
        case 'ruban': s += r(cx - 66, cy - 10, 132, 20, 'fill="#151515"') +
                           ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff'].map((c, i) => r(cx - 58 + i * 25, cy - 6, 16, 12, `fill="${c}"`)).join(''); break;
        case 'barre': s += r(cx - 64, cy - 14, 128, 28, 'fill="#151515"') + Array.from({ length: 10 }, (_, i) =>
                           r(cx - 58 + i * 12, cy - 9, 8, 18, `fill="${i < 8 ? '#e53935' : i < 9 ? '#ffb300' : '#43a047'}"`)).join(''); break;
        case '4d': s += r(cx - 58, cy - 22, 116, 44, 'fill="#111"') + texte(cx, cy + 12, '88:88', 'class="montage-segments" text-anchor="middle"'); break;
        case 'oled': s += r(cx - 50, cy - 26, 100, 52, 'fill="#05070a" stroke="#333"') + [0, 1, 2].map(i => r(cx - 40, cy - 16 + i * 12, 60 - i * 14, 5, 'fill="#5ab0ff"')).join(''); break;
        case 'lcd': s += r(cx - 64, cy - 22, 128, 44, 'fill="#9ccc3c" stroke="#5e7d1f"') + r(cx - 56, cy - 12, 80, 8, 'fill="#3b4f12"'); break;
        case 'lcdrgb': s += r(cx - 64, cy - 22, 128, 44, 'fill="#3c8de0" stroke="#1d5aa0"') + r(cx - 56, cy - 12, 80, 8, 'fill="#e8f1fb"'); break;
        case 'rtc': s += cercle(cx + 14, cy, 20, 'fill="#c0c4c8" stroke="#6b7075"') + r(cx - 28, cy - 10, 20, 20, 'fill="#111"'); break;
        case 'couleur': s += r(cx - 12, cy - 12, 24, 24, 'fill="#111"') + cercle(cx - 24, cy, 6, 'fill="#fffbe6" stroke="#ccc"') + cercle(cx + 24, cy, 6, 'fill="#fffbe6" stroke="#ccc"'); break;
        case 'pca': s += r(cx - 14, cy - 14, 28, 28, 'fill="#111"') + Array.from({ length: 8 }, (_, i) => r(cx - 66 + i * 8, cy + 20, 6, 10, 'fill="#c9a54a"')).join(''); break;
        case 'pilote': s += r(cx - 16, cy - 16, 32, 32, 'fill="#111"') + r(cx - 30, cy - 30, 14, 14, 'fill="#2f9e5b"') + r(cx + 16, cy - 30, 14, 14, 'fill="#2f9e5b"'); break;
        default: s += r(cx - 14, cy - 14, 28, 28, 'fill="#111"') + r(cx - 10, cy - 10, 20, 20, 'fill="none" stroke="#444"');
    }
    return s;
}

function dessinFil(f, fin, o) {
    // Courbe de Bezier : chaque extremite part dans sa direction de sortie, decalee le long du connecteur.
    // Un fil peut d'abord suivre des points de passage (le 3V3 de la Grove contourne la carte par le bas).
    const e = { x: fin.x - fin.d[1] * o, y: fin.y + fin.d[0] * o };
    let d = `M${f.x} ${f.y}`, depart = f, dir = f.d;
    for (const [px, py] of f.passage || []) {
        d += ` L${px} ${py}`;
        const n = Math.hypot(px - depart.x, py - depart.y) || 1;
        dir = [(px - depart.x) / n, (py - depart.y) / n];
        depart = { x: px, y: py };
    }
    const long = Math.max(50, Math.hypot(e.x - depart.x, e.y - depart.y) * 0.45);
    d += ` C${depart.x + dir[0] * long} ${depart.y + dir[1] * long} ${e.x - fin.d[0] * long} ${e.y - fin.d[1] * long} ${e.x} ${e.y}`;
    let s = `<path d="${d}" class="montage-fil-ombre" stroke-linejoin="round"/><path d="${d}" stroke="${f.c}" class="montage-fil" stroke-linejoin="round"/>`;
    if (f.pince) {
        // Pince crocodile serree sur la pastille, dans l'axe du fil.
        const a = Math.atan2(f.d[1], f.d[0]) * 180 / Math.PI;
        s += `<g transform="translate(${f.x} ${f.y}) rotate(${a})">` + r(-4, -6, 30, 12, `rx="5" fill="${f.c}" stroke="#555"`) +
             r(-8, -4, 10, 8, 'rx="2" fill="#c0c4c8" stroke="#6b7075"') + '</g>';
    }
    return s;
}

function dessinerScene(etat) {
    const basCarte = etat.carte === 'dfr' ? 700 : GROVE_PCB.y + GROVE_PCB.l;
    const hauteur = disposer(etat.modules, basCarte);
    let bas = etat.carte === 'dfr' ? dessinCarteDfr() : dessinCarteGrove();
    for (const m of etat.modules) {
        if (m.x === undefined) continue;
        const fin = arrivee(m), n = m.fils.length;
        m.fils.forEach((f, i) => { bas += dessinFil(f, fin, (i - (n - 1) / 2) * 6); });
    }
    for (const m of etat.modules) {
        if (m.x === undefined) continue;
        const cx = m.x + MODULE.l / 2, cy = m.y + MODULE.h / 2;
        bas += `<g class="montage-module">${dessinModule(m, cx, cy)}` +
               texte(cx, m.y + MODULE.h + 22, echap(m.nom), 'class="montage-libelle" text-anchor="middle"') +
               texte(cx, m.y + MODULE.h + 42, echap(m.etiquette), 'class="montage-note" text-anchor="middle"');
        const note = [m.alerte, m.note].filter(Boolean).join(' · ');
        if (note) bas += texte(cx, m.y + MODULE.h + 62, echap(note), `class="montage-note${m.alerte ? ' alerte' : ''}" text-anchor="middle"`);
        bas += '</g>';
    }
    return { bas, hauteur };
}

// ---------- Panneau ----------
const panneau = $('montage-panneau'), scene = $('montage-scene'), bouton = $('btn-montage');
const svgBas = $('montage-svg-bas'), svgHaut = $('montage-svg-haut'), place = $('montage-carte');
const titre = $('montage-sous-titre'), resume = $('montage-resume'), fermer = $('montage-fermer');
let ouvert = false, hauteurScene = 600, emplacement = null, attente = null;

function ajusterEchelle() {
    if (!ouvert) return;
    // La scene garde ses unites (1000 de large) ; le cadre porte la place reellement occupee.
    const cadre = scene.parentElement, zone = cadre.parentElement;
    // Ajuste a la largeur (defilement vertical si besoin) : ajuster aussi a la hauteur rendait tout illisible.
    const k = Math.max(0.35, Math.min(1.1, (zone.clientWidth - 24) / LARGEUR));
    scene.style.transform = 'scale(' + k + ')';
    cadre.style.width = Math.round(LARGEUR * k) + 'px';
    cadre.style.height = Math.round(hauteurScene * k) + 'px';
}

function redessiner() {
    const etat = lireMontage();
    if (bouton) bouton.hidden = !etat.utile;
    if (!etat.utile && ouvert) basculer(false);
    if (!ouvert) return;
    const { bas, hauteur } = dessinerScene(etat);
    hauteurScene = hauteur;
    scene.style.height = hauteur + 'px';
    for (const svg of [svgBas, svgHaut]) svg.setAttribute('viewBox', `0 0 ${LARGEUR} ${hauteur}`);
    svgBas.innerHTML = bas;
    const fente = etat.carte === 'dfr' ? FENTE : FENTE_GROVE;
    svgHaut.innerHTML = r(fente.x, fente.y, fente.l, fente.h, 'rx="4" fill="#0b0b0b" stroke="#2b2b2b" stroke-width="2"') +
                        r(fente.x + 6, fente.y + 4, fente.l - 12, 3, 'fill="#2a2a2a"') +
                        // Pattes cuivrees du connecteur, visibles sous le boitier sur la Grove v2.0.
                        (etat.carte === 'dfr' ? '' : Array.from({ length: 40 }, (_, i) =>
                            r(fente.x + 10 + i * 7.3, fente.y + fente.h - 2, 3, 7, 'fill="#b87333"')).join(''));
    titre.textContent = etat.carte === 'dfr' ? 'Carte moteurs DFRobot DFR0548' : 'Carte Grove Shield for micro:bit v2.0 (Seeed)';
    resume.innerHTML = etat.modules.length
        ? etat.modules.map(m => '<li>' + echap(m.nom) + ' : ' + echap(m.etiquette) + (m.note ? ' (' + echap(m.note) + ')' : '') +
                                (m.alerte ? ' — port partagé avec un autre module' : '') + '</li>').join('')
        : '<li>Aucun module branché pour l\'instant.</li>';
    ajusterEchelle();
}

function basculer(ouvrir) {
    const carte = $('microbit-board'), cadre = $('carte-cadre');
    if (!carte || ouvrir === ouvert) return;
    ouvert = ouvrir;
    panneau.hidden = !ouvrir;
    bouton.setAttribute('aria-expanded', String(ouvrir));
    bouton.textContent = ouvrir ? '🔌 Fermer le montage' : '🔌 Voir le montage';
    if (ouvrir) {
        // La carte change de parent : ses ecouteurs et identifiants la suivent.
        emplacement = { parent: carte.parentNode, suivant: carte.nextSibling };
        place.appendChild(carte);
        cadre.classList.add('montage-carte-absente');
        redessiner();
        fermer.focus();
    } else {
        emplacement.parent.insertBefore(carte, emplacement.suivant);
        cadre.classList.remove('montage-carte-absente');
        bouton.focus();
    }
}

function installer() {
    if (!panneau || !bouton || !window.workspace) return false;
    bouton.addEventListener('click', () => basculer(!ouvert));
    fermer.addEventListener('click', () => basculer(false));
    document.addEventListener('keydown', e => { if (ouvert && e.key === 'Escape') { e.preventDefault(); basculer(false); } });
    window.workspace.addChangeListener(e => {
        if (e.isUiEvent) return;
        clearTimeout(attente);
        attente = setTimeout(redessiner, 150);
    });
    new ResizeObserver(ajusterEchelle).observe(scene.parentElement.parentElement);
    redessiner();
    return true;
}

// un.js cree l'espace de travail : on attend qu'il existe (quelques images au plus).
(function attendre(essais) {
    if (!installer() && essais > 0) requestAnimationFrame(() => attendre(essais - 1));
})(600);
