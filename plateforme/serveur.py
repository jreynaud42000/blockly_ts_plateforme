"""Plateforme en ligne (solution 3) : comptes, classes, seances et travaux des eleves, depuis la classe ou la maison.

Python standard uniquement (http.server, sqlite3, hashlib) : rien a installer, Python 3.8 ou plus recent.
En production, le serveur tourne DERRIERE un relais HTTPS (Caddy, nginx, voir deploiement/) : il ne gere pas le
chiffrement lui-meme. Voir plateforme/LISEZMOI.md (installation) et plateforme/RGPD.md (donnees personnelles).

Lancement :
    python plateforme/serveur.py                       # sert l'application et l'API sur le port 8080
    python plateforme/serveur.py --creer-enseignant prof@college.fr "Jean Dupont"   # premier compte

Configuration (variables d'environnement) :
    PLATEFORME_PORT              port d'ecoute (8080)
    PLATEFORME_HOTE              adresse d'ecoute (127.0.0.1 : seul le relais HTTPS du meme serveur s'y connecte ;
                                 0.0.0.0 pour un essai sur le reseau local)
    PLATEFORME_DONNEES           dossier de la base (plateforme/donnees)
    PLATEFORME_COOKIE_SECURE     1 = cookie de session reserve a HTTPS (a mettre en production)
    PLATEFORME_PROXY             1 = derriere un relais : l'adresse du client est lue dans X-Forwarded-For
    PLATEFORME_CODE_INSCRIPTION  code d'etablissement exige pour creer un compte enseignant depuis le site
                                 (vide = inscription en ligne fermee, comptes crees en ligne de commande seulement)
    PLATEFORME_NOM               nom affiche (« Programmation micro:bit »)

Modele de donnees : enseignants (courriel, nom, mot de passe hache) ; classes d'un enseignant ; eleves d'une classe
(identifiant genere, PRENOM seulement, mot de passe hache, jamais de courriel) ; seances publiees dans une classe (meme
format « seance-microbit » que les solutions 1 et 2) ; travaux (un « rendu-microbit » par eleve et par seance, remplace a
chaque envoi). Mots de passe : scrypt avec sel. Sessions : jeton aleatoire en base, cookie HttpOnly SameSite=Lax.
Requetes de modification : en-tete X-Plateforme exige (un autre site ne peut pas l'envoyer sans autorisation CORS).
Evaluation : la seance envoyee a l'eleve n'a ni solutions ni indices (seance_pour_eleve), et la banque /exercices.json
(avec ses solutions) n'est plus servie aux eleves d'une classe qui a une evaluation ouverte. L'enseignant garde tout.
"""

import datetime
import getpass
import hashlib
import hmac
import http.server
import json
import os
import re
import secrets
import socketserver
import sqlite3
import sys
import threading
import time
import unicodedata
import urllib.parse

RACINE_APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PLATEFORME_PORT", "8080"))
HOTE = os.environ.get("PLATEFORME_HOTE", "127.0.0.1")
DONNEES = os.environ.get("PLATEFORME_DONNEES") or os.path.join(RACINE_APP, "plateforme", "donnees")
COOKIE_SECURE = os.environ.get("PLATEFORME_COOKIE_SECURE") == "1"
DERRIERE_PROXY = os.environ.get("PLATEFORME_PROXY") == "1"
CODE_INSCRIPTION = os.environ.get("PLATEFORME_CODE_INSCRIPTION", "")
NOM = os.environ.get("PLATEFORME_NOM", "Programmation micro:bit")

DUREE_SESSION_S = {"prof": 12 * 3600, "eleve": 4 * 3600}   # et cookie efface a la fermeture du navigateur (postes partages)
TAILLE_MAX = 3 * 1024 * 1024
ESSAIS_MAX, FENETRE_ESSAIS_S = 10, 600          # 10 essais de connexion par adresse et identifiant en 10 minutes
MOTS = ["lune", "pomme", "robot", "nuage", "plume", "sable", "foret", "pluie", "tigre", "olive", "cerise", "comete",
        "radar", "piano", "kiwi", "volcan", "ocean", "fusee", "banane", "cactus", "dragon", "orange", "zebre", "pirate"]

# ------------------------------------------------------------------ base de donnees
SCHEMA = """
CREATE TABLE IF NOT EXISTS enseignants (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, nom TEXT NOT NULL,
    hash TEXT NOT NULL, cree TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, enseignant_id INTEGER NOT NULL REFERENCES enseignants(id),
    nom TEXT NOT NULL, cree TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eleves (id INTEGER PRIMARY KEY, classe_id INTEGER NOT NULL REFERENCES classes(id),
    identifiant TEXT UNIQUE NOT NULL, prenom TEXT NOT NULL, hash TEXT NOT NULL, cree TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS seances (id TEXT PRIMARY KEY, classe_id INTEGER NOT NULL REFERENCES classes(id),
    def TEXT NOT NULL, ouverte INTEGER NOT NULL DEFAULT 1, cree TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS travaux (id INTEGER PRIMARY KEY, seance_id TEXT NOT NULL REFERENCES seances(id),
    eleve_id INTEGER NOT NULL REFERENCES eleves(id), rendu TEXT NOT NULL, final INTEGER NOT NULL DEFAULT 0,
    maj TEXT NOT NULL, rendu_le TEXT, UNIQUE (seance_id, eleve_id));
CREATE TABLE IF NOT EXISTS sessions (jeton TEXT PRIMARY KEY, role TEXT NOT NULL, uid INTEGER NOT NULL, expire REAL NOT NULL);
"""

_verrou_base = threading.Lock()


def base():
    os.makedirs(DONNEES, exist_ok=True)
    c = sqlite3.connect(os.path.join(DONNEES, "plateforme.sqlite3"), timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c


def initialiser_base():
    with base() as c:
        c.executescript(SCHEMA)


def maintenant():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ mots de passe et identifiants
def hacher(mot_de_passe):
    sel = secrets.token_bytes(16)
    h = hashlib.scrypt(mot_de_passe.encode("utf-8"), salt=sel, n=2 ** 14, r=8, p=1, dklen=32)
    return "scrypt$" + sel.hex() + "$" + h.hex()


def verifier(mot_de_passe, stocke):
    try:
        _, sel, h = stocke.split("$")
        calcule = hashlib.scrypt(mot_de_passe.encode("utf-8"), salt=bytes.fromhex(sel), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(calcule.hex(), h)
    except (ValueError, TypeError):
        return False


def mot_de_passe_facile():
    """Facile a recopier par un eleve : « pomme-47-robot » (environ 30 bits, suffisant avec la limite d'essais)."""
    return "%s-%02d-%s" % (secrets.choice(MOTS), secrets.randbelow(100), secrets.choice(MOTS))


def morceau(texte, longueur=20):
    t = unicodedata.normalize("NFD", str(texte or ""))
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "", t)[:longueur] or "x"


# ------------------------------------------------------------------ limite des essais de connexion
_essais = {}
_verrou_essais = threading.Lock()


def essai_permis(cle):
    with _verrou_essais:
        t = time.time()
        liste = [x for x in _essais.get(cle, []) if t - x < FENETRE_ESSAIS_S]
        _essais[cle] = liste
        return len(liste) < ESSAIS_MAX


def noter_echec(cle):
    with _verrou_essais:
        _essais.setdefault(cle, []).append(time.time())


# ------------------------------------------------------------------ erreurs
class Erreur(Exception):
    def __init__(self, statut, message):
        super().__init__(message)
        self.statut = statut


def exiger(condition, statut, message):
    if not condition:
        raise Erreur(statut, message)


# ------------------------------------------------------------------ sessions
def ouvrir_session(role, uid):
    jeton = secrets.token_urlsafe(32)
    with base() as c:
        c.execute("DELETE FROM sessions WHERE expire < ?", (time.time(),))
        c.execute("INSERT INTO sessions VALUES (?, ?, ?, ?)", (jeton, role, uid, time.time() + DUREE_SESSION_S[role]))
    return jeton


def lire_session(jeton):
    if not jeton:
        return None
    with base() as c:
        s = c.execute("SELECT role, uid FROM sessions WHERE jeton = ? AND expire > ?", (jeton, time.time())).fetchone()
    return dict(s) if s else None


# ------------------------------------------------------------------ verifications d'appartenance
def classe_du_prof(c, classe_id, prof_id):
    k = c.execute("SELECT * FROM classes WHERE id = ? AND enseignant_id = ?", (classe_id, prof_id)).fetchone()
    exiger(k, 404, "classe introuvable")
    return k


def seance_du_prof(c, seance_id, prof_id):
    s = c.execute("SELECT s.* FROM seances s JOIN classes k ON k.id = s.classe_id WHERE s.id = ? AND k.enseignant_id = ?",
                  (seance_id, prof_id)).fetchone()
    exiger(s, 404, "séance introuvable")
    return s


def eleve_du_prof(c, eleve_id, prof_id):
    e = c.execute("SELECT e.* FROM eleves e JOIN classes k ON k.id = e.classe_id WHERE e.id = ? AND k.enseignant_id = ?",
                  (eleve_id, prof_id)).fetchone()
    exiger(e, 404, "élève introuvable")
    return e


def seance_pour_eleve(d):
    """La seance telle que la recoit un eleve. En evaluation : ni solution ni indices. Le moteur d'exercices n'en a pas
    besoin (validation par la regle de l'exercice, ou correction par l'enseignant), et un eleve pourrait les lire avec les
    outils du navigateur. L'enseignant garde la seance complete (/api/export, base)."""
    if d.get("mode") != "eval":
        return d
    copie = dict(d)
    copie["exercices"] = [{k: v for k, v in e.items() if k not in ("solution", "indices")} for e in d.get("exercices", [])]
    return copie


def evaluation_ouverte(session):
    """Vrai si la session est celle d'un eleve dont la classe a une evaluation ouverte."""
    if not session or session["role"] != "eleve":
        return False
    with base() as c:
        lignes = c.execute("SELECT s.def FROM seances s JOIN eleves e ON e.classe_id = s.classe_id WHERE e.id = ? AND s.ouverte = 1",
                           (session["uid"],)).fetchall()
    return any(json.loads(l["def"]).get("mode") == "eval" for l in lignes)


def resume_travail(t):
    r = json.loads(t["rendu"])
    return {"maj": t["maj"], "final": bool(t["final"]), "rendu_le": t["rendu_le"],
            "exercices": [{k: x.get(k) for k in ("id", "titre", "statut", "etoiles", "points", "sur")} for x in r.get("exercices", [])],
            "evaluation": r.get("evaluation")}


# ------------------------------------------------------------------ API
def api(methode, chemin, requete, session, corps):
    """Renvoie (statut, objet, cookie) ; cookie = None, (jeton, -1) a poser (cookie de session du navigateur), ou ("", 0) a effacer."""
    role = session and session["role"]
    uid = session and session["uid"]

    if methode == "GET" and chemin == "/api/info":
        return 200, {"plateforme": True, "nom": NOM, "inscription": bool(CODE_INSCRIPTION)}, None

    if methode == "GET" and chemin == "/api/moi":
        if not session:
            return 200, {"role": None}, None
        with base() as c:
            if role == "prof":
                p = c.execute("SELECT id, email, nom FROM enseignants WHERE id = ?", (uid,)).fetchone()
                return 200, {"role": "prof", "id": p["id"], "email": p["email"], "nom": p["nom"]}, None
            e = c.execute("SELECT e.id, e.identifiant, e.prenom, k.nom AS classe FROM eleves e JOIN classes k ON k.id = e.classe_id "
                          "WHERE e.id = ?", (uid,)).fetchone()
            return 200, {"role": "eleve", "id": e["id"], "identifiant": e["identifiant"], "prenom": e["prenom"], "classe": e["classe"]}, None

    if methode == "POST" and chemin == "/api/connexion":
        ident = str(corps.get("identifiant", "")).strip().lower()
        mdp = str(corps.get("mot_de_passe", ""))
        cle = requete["ip"] + "|" + ident
        exiger(essai_permis(cle), 429, "trop d'essais : attendez quelques minutes")
        with base() as c:
            if "@" in ident:
                ligne = c.execute("SELECT id, hash FROM enseignants WHERE email = ?", (ident,)).fetchone()
                role_n = "prof"
            else:
                ligne = c.execute("SELECT id, hash FROM eleves WHERE identifiant = ?", (ident,)).fetchone()
                role_n = "eleve"
        if not ligne or not verifier(mdp, ligne["hash"]):
            noter_echec(cle)
            raise Erreur(401, "identifiant ou mot de passe incorrect")
        return 200, {"ok": True, "role": role_n}, (ouvrir_session(role_n, ligne["id"]), -1)

    if methode == "POST" and chemin == "/api/deconnexion":
        if requete["jeton"]:
            with base() as c:
                c.execute("DELETE FROM sessions WHERE jeton = ?", (requete["jeton"],))
        return 200, {"ok": True}, ("", 0)

    if methode == "POST" and chemin == "/api/inscription":
        exiger(CODE_INSCRIPTION, 403, "l'inscription en ligne est fermée : demandez un compte à l'administrateur")
        exiger(hmac.compare_digest(str(corps.get("code", "")), CODE_INSCRIPTION), 403, "code d'établissement incorrect")
        email = str(corps.get("email", "")).strip().lower()
        nom = str(corps.get("nom", "")).strip()[:60]
        mdp = str(corps.get("mot_de_passe", ""))
        exiger(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email), 400, "adresse électronique invalide")
        exiger(nom, 400, "indiquez votre nom")
        exiger(len(mdp) >= 10, 400, "le mot de passe doit faire au moins 10 caractères")
        with base() as c:
            exiger(not c.execute("SELECT 1 FROM enseignants WHERE email = ?", (email,)).fetchone(), 409, "un compte existe déjà avec cette adresse")
            pid = c.execute("INSERT INTO enseignants (email, nom, hash, cree) VALUES (?, ?, ?, ?)", (email, nom, hacher(mdp), maintenant())).lastrowid
        return 200, {"ok": True}, (ouvrir_session("prof", pid), -1)

    exiger(session, 401, "connectez-vous d'abord")

    if methode == "POST" and chemin == "/api/mot-de-passe":
        ancien, nouveau = str(corps.get("ancien", "")), str(corps.get("nouveau", ""))
        exiger(len(nouveau) >= (10 if role == "prof" else 8), 400, "nouveau mot de passe trop court")
        table = "enseignants" if role == "prof" else "eleves"
        with base() as c:
            ligne = c.execute("SELECT hash FROM %s WHERE id = ?" % table, (uid,)).fetchone()
            exiger(verifier(ancien, ligne["hash"]), 403, "mot de passe actuel incorrect")
            c.execute("UPDATE %s SET hash = ? WHERE id = ?" % table, (hacher(nouveau), uid))
        return 200, {"ok": True}, None

    # ---------------- eleve
    if role == "eleve":
        with base() as c:
            moi = c.execute("SELECT * FROM eleves WHERE id = ?", (uid,)).fetchone()
            if methode == "GET" and chemin == "/api/mes-seances":
                lignes = c.execute("SELECT s.id, s.def, t.final, t.maj FROM seances s LEFT JOIN travaux t ON t.seance_id = s.id AND t.eleve_id = ? "
                                   "WHERE s.classe_id = ? AND s.ouverte = 1 ORDER BY s.cree DESC", (uid, moi["classe_id"])).fetchall()
                return 200, {"seances": [{"id": l["id"], "def": seance_pour_eleve(json.loads(l["def"])), "final": bool(l["final"]), "maj": l["maj"]} for l in lignes]}, None
            if methode == "GET" and chemin == "/api/mon-travail":
                sid = requete["query"].get("seance", [""])[0]
                t = c.execute("SELECT rendu FROM travaux WHERE seance_id = ? AND eleve_id = ?", (sid, uid)).fetchone()
                return 200, {"rendu": json.loads(t["rendu"]) if t else None}, None
            if methode == "POST" and chemin == "/api/envoyer":
                sid = str(corps.get("seance", ""))
                s = c.execute("SELECT * FROM seances WHERE id = ? AND classe_id = ?", (sid, moi["classe_id"])).fetchone()
                exiger(s, 404, "séance introuvable")
                exiger(s["ouverte"], 403, "la séance est fermée : ton professeur ne reçoit plus les travaux")
                rendu = corps.get("rendu")
                exiger(isinstance(rendu, dict) and rendu.get("format") == "rendu-microbit" and isinstance(rendu.get("exercices"), list),
                       400, "travail invalide")
                exiger((rendu.get("seance") or {}).get("id") == sid, 400, "ce travail n'appartient pas à cette séance")
                rendu["eleves"] = [moi["prenom"]]           # l'identite vient du compte, pas du navigateur
                final = bool(corps.get("final"))
                ancien = c.execute("SELECT final, rendu_le FROM travaux WHERE seance_id = ? AND eleve_id = ?", (sid, uid)).fetchone()
                deja_final = bool(ancien and ancien["final"])
                c.execute("INSERT INTO travaux (seance_id, eleve_id, rendu, final, maj, rendu_le) VALUES (?, ?, ?, ?, ?, ?) "
                          "ON CONFLICT (seance_id, eleve_id) DO UPDATE SET rendu = excluded.rendu, final = excluded.final, "
                          "maj = excluded.maj, rendu_le = excluded.rendu_le",
                          (sid, uid, json.dumps(rendu, ensure_ascii=False), int(final or deja_final), maintenant(),
                           maintenant() if final else (ancien["rendu_le"] if ancien else None)))
                return 200, {"ok": True, "final": final, "heure": datetime.datetime.now().strftime("%H:%M")}, None
        raise Erreur(403, "réservé aux enseignants")

    # ---------------- enseignant
    exiger(role == "prof", 403, "réservé aux enseignants")
    q = requete["query"]
    with base() as c:
        if methode == "GET" and chemin == "/api/classes":
            lignes = c.execute("SELECT k.id, k.nom, (SELECT COUNT(*) FROM eleves e WHERE e.classe_id = k.id) AS eleves, "
                               "(SELECT COUNT(*) FROM seances s WHERE s.classe_id = k.id) AS seances FROM classes k "
                               "WHERE k.enseignant_id = ? ORDER BY k.nom", (uid,)).fetchall()
            return 200, {"classes": [dict(l) for l in lignes]}, None
        if methode == "POST" and chemin == "/api/classes":
            nom = str(corps.get("nom", "")).strip()[:40]
            exiger(nom, 400, "donnez un nom à la classe")
            kid = c.execute("INSERT INTO classes (enseignant_id, nom, cree) VALUES (?, ?, ?)", (uid, nom, maintenant())).lastrowid
            return 200, {"id": kid}, None
        if methode == "POST" and chemin == "/api/classes/supprimer":
            k = classe_du_prof(c, int(corps.get("id", 0)), uid)
            # Fin d'annee (RGPD) : la classe, ses eleves, ses seances et tous les travaux disparaissent.
            c.execute("DELETE FROM travaux WHERE seance_id IN (SELECT id FROM seances WHERE classe_id = ?)", (k["id"],))
            c.execute("DELETE FROM travaux WHERE eleve_id IN (SELECT id FROM eleves WHERE classe_id = ?)", (k["id"],))
            c.execute("DELETE FROM sessions WHERE role = 'eleve' AND uid IN (SELECT id FROM eleves WHERE classe_id = ?)", (k["id"],))
            c.execute("DELETE FROM seances WHERE classe_id = ?", (k["id"],))
            c.execute("DELETE FROM eleves WHERE classe_id = ?", (k["id"],))
            c.execute("DELETE FROM classes WHERE id = ?", (k["id"],))
            return 200, {"ok": True}, None
        if methode == "GET" and chemin == "/api/eleves":
            k = classe_du_prof(c, int(q.get("classe", ["0"])[0]), uid)
            lignes = c.execute("SELECT id, identifiant, prenom FROM eleves WHERE classe_id = ? ORDER BY prenom", (k["id"],)).fetchall()
            return 200, {"eleves": [dict(l) for l in lignes]}, None
        if methode == "POST" and chemin == "/api/eleves/creer":
            k = classe_du_prof(c, int(corps.get("classe", 0)), uid)
            prenoms = [str(p).strip()[:30] for p in corps.get("prenoms", []) if str(p).strip()][:60]
            exiger(prenoms, 400, "indiquez au moins un prénom")
            crees = []
            for p in prenoms:
                base_id = morceau(k["nom"], 8) + "-" + morceau(p, 12)
                n = 1
                while c.execute("SELECT 1 FROM eleves WHERE identifiant = ?", ("%s-%02d" % (base_id, n),)).fetchone():
                    n += 1
                ident, mdp = "%s-%02d" % (base_id, n), mot_de_passe_facile()
                c.execute("INSERT INTO eleves (classe_id, identifiant, prenom, hash, cree) VALUES (?, ?, ?, ?, ?)",
                          (k["id"], ident, p, hacher(mdp), maintenant()))
                crees.append({"prenom": p, "identifiant": ident, "mot_de_passe": mdp})
            return 200, {"eleves": crees}, None
        if methode == "POST" and chemin == "/api/eleves/reinitialiser":
            e = eleve_du_prof(c, int(corps.get("id", 0)), uid)
            mdp = mot_de_passe_facile()
            c.execute("UPDATE eleves SET hash = ? WHERE id = ?", (hacher(mdp), e["id"]))
            c.execute("DELETE FROM sessions WHERE role = 'eleve' AND uid = ?", (e["id"],))
            return 200, {"prenom": e["prenom"], "identifiant": e["identifiant"], "mot_de_passe": mdp}, None
        if methode == "POST" and chemin == "/api/eleves/supprimer":
            e = eleve_du_prof(c, int(corps.get("id", 0)), uid)
            c.execute("DELETE FROM travaux WHERE eleve_id = ?", (e["id"],))
            c.execute("DELETE FROM sessions WHERE role = 'eleve' AND uid = ?", (e["id"],))
            c.execute("DELETE FROM eleves WHERE id = ?", (e["id"],))
            return 200, {"ok": True}, None
        if methode == "GET" and chemin == "/api/seances":
            k = classe_du_prof(c, int(q.get("classe", ["0"])[0]), uid)
            lignes = c.execute("SELECT s.id, s.def, s.ouverte, s.cree, (SELECT COUNT(*) FROM travaux t WHERE t.seance_id = s.id) AS travaux, "
                               "(SELECT COUNT(*) FROM travaux t WHERE t.seance_id = s.id AND t.final = 1) AS rendus "
                               "FROM seances s WHERE s.classe_id = ? ORDER BY s.cree DESC", (k["id"],)).fetchall()
            sortie = []
            for l in lignes:
                d = json.loads(l["def"])
                sortie.append({"id": l["id"], "titre": d.get("titre"), "mode": d.get("mode", "tp"), "exercices": len(d.get("exercices", [])),
                               "ouverte": bool(l["ouverte"]), "cree": l["cree"], "travaux": l["travaux"], "rendus": l["rendus"]})
            return 200, {"seances": sortie}, None
        if methode == "POST" and chemin == "/api/seances/publier":
            k = classe_du_prof(c, int(corps.get("classe", 0)), uid)
            d = corps.get("seance")
            exiger(isinstance(d, dict) and d.get("format") == "seance-microbit" and d.get("exercices") and d.get("id"), 400, "séance invalide")
            d["classe"] = k["nom"]
            d["groupes"] = [{"nom": k["nom"], "eleves": []}]        # sur la plateforme, chaque eleve a son compte
            sid = str(d["id"])[:40]
            existe = c.execute("SELECT classe_id FROM seances WHERE id = ?", (sid,)).fetchone()
            if existe:
                exiger(existe["classe_id"] == k["id"], 409, "cette séance est déjà publiée dans une autre classe : "
                       "faites « Nouvelle séance » dans l'onglet Préparer pour en créer une copie")
                c.execute("UPDATE seances SET def = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), sid))
            else:
                c.execute("INSERT INTO seances (id, classe_id, def, ouverte, cree) VALUES (?, ?, ?, 1, ?)",
                          (sid, k["id"], json.dumps(d, ensure_ascii=False), maintenant()))
            return 200, {"id": sid, "mise_a_jour": bool(existe)}, None
        if methode == "POST" and chemin == "/api/seances/etat":
            s = seance_du_prof(c, str(corps.get("id", "")), uid)
            c.execute("UPDATE seances SET ouverte = ? WHERE id = ?", (1 if corps.get("ouverte") else 0, s["id"]))
            return 200, {"ok": True}, None
        if methode == "POST" and chemin == "/api/seances/supprimer":
            s = seance_du_prof(c, str(corps.get("id", "")), uid)
            c.execute("DELETE FROM travaux WHERE seance_id = ?", (s["id"],))
            c.execute("DELETE FROM seances WHERE id = ?", (s["id"],))
            return 200, {"ok": True}, None
        if methode == "GET" and chemin == "/api/suivi":
            s = seance_du_prof(c, q.get("seance", [""])[0], uid)
            d = json.loads(s["def"])
            lignes = c.execute("SELECT e.id, e.prenom, e.identifiant, t.rendu, t.final, t.maj, t.rendu_le FROM eleves e "
                               "LEFT JOIN travaux t ON t.eleve_id = e.id AND t.seance_id = ? WHERE e.classe_id = ? ORDER BY e.prenom",
                               (s["id"], s["classe_id"])).fetchall()
            eleves = []
            for l in lignes:
                ligne = {"id": l["id"], "prenom": l["prenom"], "identifiant": l["identifiant"]}
                if l["rendu"]:
                    ligne.update(resume_travail(l))
                eleves.append(ligne)
            return 200, {"seance": {"id": s["id"], "titre": d.get("titre"), "classe": d.get("classe"), "mode": d.get("mode", "tp"),
                                    "ouverte": bool(s["ouverte"]),
                                    "exercices": [{"id": x.get("id"), "titre": x.get("titre")} for x in d.get("exercices", [])]},
                         "eleves": eleves}, None
        if methode == "GET" and chemin == "/api/travail":
            s = seance_du_prof(c, q.get("seance", [""])[0], uid)
            e = eleve_du_prof(c, int(q.get("eleve", ["0"])[0]), uid)
            t = c.execute("SELECT rendu FROM travaux WHERE seance_id = ? AND eleve_id = ?", (s["id"], e["id"])).fetchone()
            exiger(t, 404, "pas encore de travail pour cet élève")
            return 200, {"rendu": json.loads(t["rendu"])}, None
        if methode == "GET" and chemin == "/api/export":
            # Droit d'acces / portabilite (RGPD) : tout ce que la plateforme garde pour une classe, en un fichier.
            k = classe_du_prof(c, int(q.get("classe", ["0"])[0]), uid)
            eleves = [dict(l) for l in c.execute("SELECT id, identifiant, prenom, cree FROM eleves WHERE classe_id = ?", (k["id"],))]
            seances = [{"id": l["id"], "def": json.loads(l["def"]), "ouverte": bool(l["ouverte"]), "cree": l["cree"]}
                       for l in c.execute("SELECT * FROM seances WHERE classe_id = ?", (k["id"],))]
            travaux = [{"seance": l["seance_id"], "eleve": l["eleve_id"], "final": bool(l["final"]), "maj": l["maj"], "rendu": json.loads(l["rendu"])}
                       for l in c.execute("SELECT t.* FROM travaux t JOIN seances s ON s.id = t.seance_id WHERE s.classe_id = ?", (k["id"],))]
            return 200, {"format": "export-plateforme-microbit", "date": maintenant(), "classe": {"id": k["id"], "nom": k["nom"]},
                         "eleves": eleves, "seances": seances, "travaux": travaux}, None
    raise Erreur(404, "adresse inconnue")


# ------------------------------------------------------------------ serveur HTTP
# Banque d'exercices AVEC solutions : refusee aux eleves tant qu'une evaluation de leur classe est ouverte (elle leur
# sert sinon pour s'entrainer, panneau « Exercices »). Visiteur non connecte : servie (preparation, site public).
FICHIERS_AVEC_SOLUTIONS = {"/exercices.json"}
FICHIERS_RACINE = re.compile(r"^/[A-Za-z0-9_.-]+\.(?:js|png|hex|txt)$")
TYPES = {".mjs": "text/javascript", ".wasm": "application/wasm", ".js": "text/javascript", ".json": "application/json"}


def fichier_autorise(chemin):
    """Seuls les fichiers de l'application sont servis (jamais la base, plateforme/, .git, les sources Python)."""
    if chemin in ("/", "/index.html", "/exercices.json"):
        return True
    if "/." in chemin or ".." in chemin:
        return False
    if chemin.startswith("/lib/"):
        return True
    return bool(FICHIERS_RACINE.match(chemin))


class Serveur(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    request_queue_size = 128
    allow_reuse_address = os.name != "nt"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RACINE_APP, **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        super().end_headers()

    def _ip(self):
        if DERRIERE_PROXY and self.headers.get("X-Forwarded-For"):
            # La derniere adresse est celle que le relais a vue ; les precedentes viennent du client et peuvent etre inventees.
            return self.headers["X-Forwarded-For"].split(",")[-1].strip()
        return self.client_address[0]

    def _jeton(self):
        for morceau_cookie in (self.headers.get("Cookie") or "").split(";"):
            nom, _, valeur = morceau_cookie.strip().partition("=")
            if nom == "session":
                return valeur
        return ""

    def _repondre(self, statut, objet, cookie=None):
        corps = json.dumps(objet, ensure_ascii=False).encode("utf-8")
        self.send_response(statut)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        if cookie is not None:
            jeton, duree = cookie
            self.send_header("Set-Cookie", "session=%s; Path=/; HttpOnly; SameSite=Lax%s%s" %
                             (jeton, "; Max-Age=0" if duree == 0 else "", "; Secure" if COOKIE_SECURE else ""))
        self.end_headers()
        self.wfile.write(corps)

    def _api(self, methode):
        analyse = urllib.parse.urlparse(self.path)
        corps = {}
        try:
            if methode == "POST":
                exiger(self.headers.get("X-Plateforme") == "1", 403, "requête refusée")
                taille = int(self.headers.get("Content-Length") or 0)
                exiger(taille <= TAILLE_MAX, 413, "envoi trop volumineux")
                if taille:
                    corps = json.loads(self.rfile.read(taille).decode("utf-8"))
                    exiger(isinstance(corps, dict), 400, "requête invalide")
            jeton = self._jeton()
            requete = {"ip": self._ip(), "jeton": jeton, "query": urllib.parse.parse_qs(analyse.query)}
            statut, objet, cookie = api(methode, analyse.path, requete, lire_session(jeton), corps)
            self._repondre(statut, objet, cookie)
        except Erreur as e:
            self._repondre(e.statut, {"erreur": str(e)})
        except (ValueError, json.JSONDecodeError):
            self._repondre(400, {"erreur": "requête invalide"})
        except sqlite3.Error as e:
            self.log_error("base : %s", e)
            self._repondre(500, {"erreur": "erreur de la base de données"})

    def _vide(self, statut):
        self.send_response(statut)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_request(self, code="-", size="-"):     # journal : l'API et les erreurs seulement (pas chaque fichier)
        if "/api/" in self.path or str(getattr(code, "value", code))[:1] == "5":
            super().log_request(code, size)

    def do_GET(self):
        chemin = urllib.parse.urlparse(self.path).path
        if chemin.startswith("/api/"):
            return self._api("GET")
        if chemin in ("/_vie", "/_ferme", "/_app") or chemin.startswith("/_classe/"):
            return self._vide(410)        # adresses de app.py (exe, mode classe) : sans objet en ligne
        if not fichier_autorise(chemin):
            return self.send_error(404)
        if self._refuse_pendant_evaluation(chemin):
            return self._repondre(403, {"erreur": "indisponible pendant une évaluation"})
        return super().do_GET()

    def do_HEAD(self):
        chemin = urllib.parse.urlparse(self.path).path
        if not fichier_autorise(chemin):
            return self.send_error(404)
        if self._refuse_pendant_evaluation(chemin):
            return self._vide(403)
        return super().do_HEAD()

    def _refuse_pendant_evaluation(self, chemin):
        if chemin not in FICHIERS_AVEC_SOLUTIONS:
            return False
        try:
            return evaluation_ouverte(lire_session(self._jeton()))
        except sqlite3.Error as e:
            self.log_error("base : %s", e)
            return True

    def do_POST(self):
        chemin = urllib.parse.urlparse(self.path).path
        if chemin.startswith("/api/"):
            return self._api("POST")
        if chemin == "/_ferme" or chemin.startswith("/_classe/"):
            return self._vide(410)
        self.send_error(405)

    def list_directory(self, path):          # jamais de liste de dossier
        self.send_error(404)
        return None


def creer_enseignant(email, nom):
    mdp = os.environ.get("PLATEFORME_MDP") or getpass.getpass("Mot de passe (10 caractères au moins) : ")
    if len(mdp) < 10:
        sys.exit("Mot de passe trop court.")
    initialiser_base()
    with base() as c:
        c.execute("INSERT INTO enseignants (email, nom, hash, cree) VALUES (?, ?, ?, ?)", (email.strip().lower(), nom, hacher(mdp), maintenant()))
    print("Compte enseignant créé :", email)


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "--creer-enseignant":
        creer_enseignant(sys.argv[2], " ".join(sys.argv[3:]))
        sys.exit(0)
    initialiser_base()
    serveur = Serveur((HOTE, PORT), Handler)
    print("%s : http://%s:%d  (données : %s)" % (NOM, HOTE, PORT, DONNEES))
    if not COOKIE_SECURE:
        print("Attention : PLATEFORME_COOKIE_SECURE n'est pas à 1 (normal en essai local, obligatoire en ligne derrière HTTPS).")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
