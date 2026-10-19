# Plateforme micro:bit — dossier RGPD (modèles à compléter)

> **Ces documents sont des modèles.** Ils ne remplacent ni l'avis du délégué à la protection des données (DPD) de
> l'établissement ou de l'académie, ni la décision du chef d'établissement, responsable du traitement. Les passages
> `[entre crochets]` sont à compléter. Ne pas ouvrir la plateforme aux élèves avant leur validation.

## 1. Ce que la plateforme enregistre

| Donnée | Qui | Pourquoi | Durée |
|---|---|---|---|
| Prénom (ou initiale) | élève | reconnaître son travail | année scolaire, jusqu'à la suppression de la classe |
| Identifiant généré (`4eb-lea-01`) | élève | connexion | idem |
| Mot de passe **haché** (scrypt) | élève, enseignant | connexion | idem / tant que le compte existe |
| Nom de la classe | enseignant | regrouper les élèves | idem |
| Travaux : programmes (blocs, Python), statut, étoiles, indices utilisés, temps passé, nombre d'essais, note d'évaluation | élève | suivi pédagogique, évaluation | idem |
| Date du dernier envoi et du rendu | élève | suivi | idem |
| Nom affiché et adresse électronique professionnelle | enseignant | connexion | tant que le compte existe |
| Jeton de session (cookie technique) | tous | rester connecté | fermeture du navigateur ; 4 h (élève), 12 h (enseignant) au plus |
| Adresse IP et identifiant tentés | tous | limiter les essais de mot de passe | 10 minutes, en mémoire seulement |
| Journal du serveur (adresse IP, date, adresse appelée) | tous | sécurité, diagnostic | `[à fixer avec le DPD, par exemple 6 mois au plus ; rotation par journald ou logrotate]` |

**Jamais demandé ni enregistré** : nom de famille, date de naissance, adresse électronique ou téléphone d'élève, photo, son,
image de la caméra (l'intelligence artificielle de l'application fonctionne entièrement dans le navigateur : les images et
les sons ne quittent pas l'ordinateur ; seuls les **programmes** sont envoyés).

**Un seul échange avec un service extérieur**, et seulement si l'élève l'utilise : charger un modèle Teachable Machine
par son adresse (`https://teachablemachine.withgoogle.com/models/…`) télécharge ce modèle depuis les serveurs de Google
(qui voient alors l'adresse IP du poste, comme pour toute page web). Aucune image ni aucun son n'est envoyé à cette
occasion. L'apprentissage immédiat, les codes QR et le reste de l'application n'appellent aucun service extérieur.
`[À mentionner dans l'information des familles si les modèles Teachable Machine sont utilisés.]`

Pas de publicité, pas de mesure d'audience, pas de traceur tiers : le seul cookie est le cookie de session, strictement
nécessaire, qui ne demande pas de consentement.

## 2. Fiche du registre des activités de traitement (modèle)

- **Nom du traitement** : Plateforme d'apprentissage de la programmation micro:bit
- **Responsable du traitement** : `[nom de l'établissement]`, représenté par `[chef d'établissement]`
- **Délégué à la protection des données** : `[nom et contact du DPD]`
- **Finalités** : permettre aux élèves de réaliser des exercices de programmation en classe et à la maison ; permettre aux
  enseignants de distribuer des séances, suivre la progression, consulter et évaluer les travaux.
- **Base légale** : mission d'intérêt public (article 6-1-e du RGPD) — enseignement. `[à confirmer par le DPD]`
- **Personnes concernées** : élèves de `[classes / niveaux]`, enseignants de `[discipline(s)]`.
- **Données** : voir le tableau du §1.
- **Destinataires** : l'enseignant de la classe ; l'administrateur technique de la plateforme `[nom]` pour la maintenance ;
  l'hébergeur `[nom]` en tant que sous-traitant.
- **Sous-traitant(s)** : hébergeur `[nom, adresse]`, contrat conforme à l'article 28 du RGPD `[référence du contrat]`.
- **Transferts hors Union européenne** : aucun (serveur et sauvegardes hébergés dans l'UE `[pays, ville du centre de données]`).
- **Durées de conservation** : jusqu'à la fin de l'année scolaire ; suppression de la classe au plus tard le `[date, par
  exemple 15 juillet]` ; sauvegardes effacées 14 jours après.
- **Mesures de sécurité** : HTTPS ; mots de passe hachés (scrypt) ; limitation des essais de connexion ; cloisonnement par
  enseignant et par classe ; cookie HttpOnly / Secure / SameSite ; serveur à jour, pare-feu, accès d'administration par clé ;
  sauvegardes quotidiennes `[chiffrées / lieu]` ; données minimisées (prénom seulement).
- **Analyse d'impact (AIPD)** : `[le DPD indique si elle est nécessaire ; les élèves étant mineurs, poser la question]`.

## 3. Information des élèves et des familles (modèle)

> **Programmation micro:bit en ligne — information sur vos données**
>
> Cette année, en `[discipline]`, votre enfant utilise une plateforme en ligne pour programmer une carte micro:bit, en
> classe et, s'il le souhaite, à la maison. Le professeur lui remet un identifiant et un mot de passe.
>
> **Ce qui est enregistré** : le prénom de l'élève, sa classe, ses programmes et ses résultats aux exercices (réussite,
> temps passé, note des évaluations). Aucun nom de famille, aucune adresse, aucune photo. La caméra et le microphone,
> utilisés dans certains exercices d'intelligence artificielle, fonctionnent uniquement sur l'ordinateur : rien n'est envoyé.
>
> **Pourquoi** : pour que l'élève retrouve son travail et que le professeur puisse le suivre et l'évaluer.
>
> **Qui y a accès** : le professeur de la classe et l'administrateur technique. Les données sont hébergées par `[hébergeur]`
> en `[pays de l'UE]`.
>
> **Combien de temps** : jusqu'à la fin de l'année scolaire ; tout est effacé au plus tard le `[date]`.
>
> **Vos droits** : vous pouvez demander à consulter, corriger ou effacer les données de votre enfant, ou vous opposer au
> traitement, auprès de `[chef d'établissement / adresse]` ou du délégué à la protection des données `[contact]`. Vous
> pouvez aussi adresser une réclamation à la CNIL (www.cnil.fr).

## 4. Répondre à une demande

| Demande | Comment |
|---|---|
| Accès / copie des données d'un élève | *Élèves > Données de la classe (RGPD) > Exporter toute la classe* ; extraire la partie de l'élève |
| Rectification du prénom | supprimer le compte et le recréer (le travail n'est pas transféré) `[ou à faire en base par l'administrateur]` |
| Effacement | *Élèves > Supprimer* (le compte et tous ses travaux) |
| Fin d'année | exporter si besoin, puis *Supprimer la classe* |

## 5. Avant l'ouverture aux élèves — liste de contrôle

- [ ] Avis du DPD obtenu ; fiche ajoutée au registre de l'établissement
- [ ] Accord du chef d'établissement
- [ ] Hébergeur dans l'UE, contrat de sous-traitance (article 28) signé
- [ ] Information des familles distribuée (§3)
- [ ] HTTPS actif, `PLATEFORME_COOKIE_SECURE=1`, `PLATEFORME_PROXY=1`
- [ ] Sauvegardes en place et restauration testée ; durée du journal fixée
- [ ] Mises à jour automatiques du système ; administrateur et suppléant désignés
- [ ] Date de suppression des classes inscrite au calendrier
- [ ] Les enseignants savent : prénoms ou initiales seulement, fiches d'identifiants rangées, comptes supprimés en fin d'année
