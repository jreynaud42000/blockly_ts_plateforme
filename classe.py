"""Mode classe : le PC de l'enseignant sert la seance aux eleves de la salle et recoit leurs travaux.

Le serveur de app.py ecoute deja sur toutes les interfaces : les eleves ouvrent http://<adresse du PC>:8000.
Ce module ajoute les adresses /_classe/... :

  Eleves (depuis la salle, avec le code affiche par l'enseignant) :
    GET  /_classe/info        seance en cours ? (titre, classe ; jamais le code)
    POST /_classe/rejoindre   {code} -> la seance (exercices, groupes)
    POST /_classe/envoyer     {code, rendu, final} -> enregistre le travail (envoi automatique toutes les
                              20 s, et « Rendre mon travail » avec final = true)

  Enseignant (UNIQUEMENT depuis le PC lui-meme, 127.0.0.1) :
    POST /_classe/demarrer    {seance} -> code, adresses, dossier des travaux
    POST /_classe/arreter
    GET  /_classe/etat        eleves connectes, exercice en cours, statuts, rendu final
    GET  /_classe/rendu?cle=  travail complet d'un groupe (blocs, Python)
    POST /_classe/dossier     ouvre le dossier des travaux dans l'Explorateur

Les travaux sont ecrits dans Documents\\MicrobitEasybloc\\travaux\\<date>_<classe>_<titre>\\, un fichier
« .rendu.json » par groupe d'eleves (le meme format que les fichiers rendus par l'ENT, seances.js), remplace a
chaque envoi : le dossier contient toujours le dernier etat de chaque groupe.
"""

import datetime
import json
import os
import re
import secrets
import socket
import threading
import time
import unicodedata
import urllib.parse

TAILLE_MAX = 3 * 1024 * 1024        # octets acceptes par requete (un rendu fait quelques dizaines de Ko)
ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # sans O/0, I/1/L : lisible au tableau
EN_LIGNE_S = 45                     # un eleve sans envoi depuis plus longtemps est affiche « deconnecte »

_verrou = threading.Lock()
ETAT = {"actif": False, "seance": None, "code": "", "dossier": "", "debut": 0, "groupes": {}}


# ------------------------------------------------------------------ outils
def _morceau(texte):
    t = unicodedata.normalize("NFD", str(texte or ""))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^A-Za-z0-9]+", "-", t).strip("-")
    return t[:30] or "x"


def _cle(groupe, eleves):
    return str(groupe) + "|" + ",".join(sorted(str(e).strip().lower() for e in eleves))


def dossier_racine():
    documents = os.path.join(os.path.expanduser("~"), "Documents")
    nouveau, ancien = os.path.join(documents, "MicrobitEasybloc"), os.path.join(documents, "MicrobitBlockly")
    # Nom Easybloc (31 oct. 2026) : le dossier des travaux deja rendus est deplace une fois sous le nouveau nom ;
    # s'il est occupe (ouvert dans l'Explorateur), on continue dans l'ancien.
    if os.path.isdir(ancien) and not os.path.exists(nouveau):
        try:
            os.rename(ancien, nouveau)
        except OSError:
            return os.path.join(ancien, "travaux")
    return os.path.join(nouveau, "travaux")


def adresses_locales():
    """Adresses IPv4 du PC sur le reseau (sans 127.x). La premiere est celle de la route par defaut."""
    trouvees = []
    try:
        # Aucune donnee n'est envoyee : connect() sur UDP choisit seulement l'interface de sortie.
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        trouvees.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for a in socket.gethostbyname_ex(socket.gethostname())[2]:
            if a not in trouvees:
                trouvees.append(a)
    except OSError:
        pass
    return [a for a in trouvees if not a.startswith("127.") and not a.startswith("169.254.")]


# ------------------------------------------------------------------ actions
def demarrer(seance):
    if not isinstance(seance, dict) or seance.get("format") != "seance-microbit" or not seance.get("exercices"):
        raise ValueError("séance invalide")
    code = "".join(secrets.choice(ALPHABET_CODE) for _ in range(5))
    horodatage = datetime.datetime.now().strftime("%Y-%m-%d_%Hh%M")
    dossier = os.path.join(dossier_racine(), "_".join([horodatage, _morceau(seance.get("classe")), _morceau(seance.get("titre"))]))
    os.makedirs(dossier, exist_ok=True)
    with open(os.path.join(dossier, "seance.json"), "w", encoding="utf-8") as f:
        json.dump(seance, f, ensure_ascii=False, indent=1)
    with _verrou:
        ETAT.update({"actif": True, "seance": seance, "code": code, "dossier": dossier, "debut": time.time(), "groupes": {}})
    return {"code": code, "dossier": dossier, "adresses": adresses_locales()}


def arreter():
    with _verrou:
        ETAT.update({"actif": False, "seance": None, "code": ""})
    return {"ok": True}


def info():
    with _verrou:
        if not ETAT["actif"]:
            return {"actif": False}
        s = ETAT["seance"]
        return {"actif": True, "titre": s.get("titre", ""), "classe": s.get("classe", ""), "mode": s.get("mode", "tp")}


def _code_ok(code):
    return ETAT["actif"] and str(code or "").strip().upper() == ETAT["code"]


def rejoindre(donnees):
    with _verrou:
        if not ETAT["actif"]:
            raise PermissionError("aucune séance en cours")
        if not _code_ok(donnees.get("code")):
            raise PermissionError("code incorrect")
        return {"seance": ETAT["seance"], "code": ETAT["code"]}


def envoyer(donnees):
    rendu = donnees.get("rendu")
    if not isinstance(rendu, dict) or rendu.get("format") != "rendu-microbit" or not isinstance(rendu.get("eleves"), list) \
            or not rendu["eleves"] or not isinstance(rendu.get("exercices"), list):
        raise ValueError("travail invalide")
    final = bool(donnees.get("final"))
    with _verrou:
        if not _code_ok(donnees.get("code")):
            raise PermissionError("code incorrect ou séance terminée")
        if (rendu.get("seance") or {}).get("id") != ETAT["seance"].get("id"):
            raise PermissionError("ce travail n'appartient pas à la séance en cours")
        cle = _cle(rendu.get("groupe", ""), rendu["eleves"])
        precedent = ETAT["groupes"].get(cle, {})
        nom = "_".join([_morceau(rendu.get("groupe")), "-".join(_morceau(e) for e in rendu["eleves"])]) + ".rendu.json"
        chemin = os.path.join(ETAT["dossier"], nom)
        rendu["final"] = final or precedent.get("final", False)
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(rendu, f, ensure_ascii=False)
        ETAT["groupes"][cle] = {
            "groupe": rendu.get("groupe", ""), "eleves": rendu["eleves"], "vu": time.time(), "fichier": chemin,
            "exercice": donnees.get("exercice") or precedent.get("exercice", ""), "final": rendu["final"],
            "rendu_le": time.time() if final else precedent.get("rendu_le"),
            "exercices": [{k: e.get(k) for k in ("id", "titre", "statut", "etoiles", "points", "sur")} for e in rendu["exercices"]],
            "evaluation": rendu.get("evaluation"),
        }
    return {"ok": True, "final": final, "heure": datetime.datetime.now().strftime("%H:%M")}


def etat():
    maintenant = time.time()
    with _verrou:
        if not ETAT["actif"]:
            return {"actif": False}
        groupes = []
        for cle, g in ETAT["groupes"].items():
            d = dict(g)
            d["cle"] = cle
            d["en_ligne"] = maintenant - g["vu"] < EN_LIGNE_S
            d["depuis_s"] = int(maintenant - g["vu"])
            d.pop("fichier", None)
            groupes.append(d)
        s = ETAT["seance"]
        return {"actif": True, "code": ETAT["code"], "dossier": ETAT["dossier"], "adresses": adresses_locales(),
                "seance": {"id": s.get("id"), "titre": s.get("titre"), "classe": s.get("classe"), "mode": s.get("mode", "tp"),
                           "exercices": [{"id": e.get("id"), "titre": e.get("titre")} for e in s.get("exercices", [])]},
                "groupes": sorted(groupes, key=lambda g: (g["groupe"], ",".join(g["eleves"])))}


def rendu_complet(cle):
    with _verrou:
        g = ETAT["groupes"].get(cle)
        chemin = g and g.get("fichier")
    if not chemin or not os.path.exists(chemin):
        raise LookupError("travail introuvable")
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def ouvrir_dossier():
    with _verrou:
        dossier = ETAT["dossier"] or dossier_racine()
    os.makedirs(dossier, exist_ok=True)
    if os.name == "nt":
        os.startfile(dossier)
    return {"ok": True, "dossier": dossier}


# ------------------------------------------------------------------ aiguillage HTTP (appele par app.py)
RESERVEES_ENSEIGNANT = {"/_classe/demarrer", "/_classe/arreter", "/_classe/etat", "/_classe/rendu", "/_classe/dossier"}


def _depuis_ce_pc(handler):
    return handler.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")


def _repondre(handler, statut, objet):
    corps = json.dumps(objet, ensure_ascii=False).encode("utf-8")
    handler.send_response(statut)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(corps)))
    handler.end_headers()
    handler.wfile.write(corps)


def _lire_json(handler):
    taille = int(handler.headers.get("Content-Length") or 0)
    if taille <= 0:
        return {}
    if taille > TAILLE_MAX:
        raise ValueError("envoi trop volumineux")
    return json.loads(handler.rfile.read(taille).decode("utf-8"))


def traiter(handler, methode):
    """Traite une adresse /_classe/... ; renvoie False si ce n'en est pas une."""
    analyse = urllib.parse.urlparse(handler.path)
    chemin = analyse.path
    if not chemin.startswith("/_classe/"):
        return False
    if chemin in RESERVEES_ENSEIGNANT and not _depuis_ce_pc(handler):
        _repondre(handler, 403, {"erreur": "réservé au poste de l'enseignant"})
        return True
    try:
        if methode == "GET" and chemin == "/_classe/info":
            _repondre(handler, 200, info())
        elif methode == "GET" and chemin == "/_classe/etat":
            _repondre(handler, 200, etat())
        elif methode == "GET" and chemin == "/_classe/rendu":
            cle = urllib.parse.parse_qs(analyse.query).get("cle", [""])[0]
            _repondre(handler, 200, rendu_complet(cle))
        elif methode == "POST" and chemin == "/_classe/demarrer":
            _repondre(handler, 200, demarrer(_lire_json(handler).get("seance")))
        elif methode == "POST" and chemin == "/_classe/arreter":
            _repondre(handler, 200, arreter())
        elif methode == "POST" and chemin == "/_classe/dossier":
            _repondre(handler, 200, ouvrir_dossier())
        elif methode == "POST" and chemin == "/_classe/rejoindre":
            _repondre(handler, 200, rejoindre(_lire_json(handler)))
        elif methode == "POST" and chemin == "/_classe/envoyer":
            _repondre(handler, 200, envoyer(_lire_json(handler)))
        else:
            _repondre(handler, 404, {"erreur": "adresse inconnue"})
    except PermissionError as e:
        _repondre(handler, 403, {"erreur": str(e)})
    except LookupError as e:
        _repondre(handler, 404, {"erreur": str(e)})
    except (ValueError, json.JSONDecodeError) as e:
        _repondre(handler, 400, {"erreur": str(e)})
    except OSError as e:
        _repondre(handler, 500, {"erreur": "écriture impossible : " + str(e)})
    return True


def actif():
    with _verrou:
        return ETAT["actif"]
