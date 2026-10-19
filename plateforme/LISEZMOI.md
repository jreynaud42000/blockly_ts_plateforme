# Plateforme en ligne micro:bit (solution 3)

Les élèves se connectent avec un compte, **depuis la classe ou depuis chez eux**. Leur travail est enregistré en ligne :
l'enseignant suit sa classe et ouvre le programme de chaque élève de n'importe où.

| | Solution 1 (fichiers par l'ENT) | Solution 2 (mode classe) | **Solution 3 (plateforme)** |
|---|---|---|---|
| Où travaille l'élève | partout | dans la salle seulement | partout |
| Comptes | aucun | aucun (code de séance) | un compte par élève |
| Serveur | aucun | le PC du professeur | un serveur en ligne à héberger |
| Données d'élèves | dans l'ENT | sur le PC du professeur | chez l'hébergeur choisi |
| Démarches RGPD | les plus légères | légères | **registre, information, contrat d'hébergement** (voir [RGPD.md](RGPD.md)) |

**Important : rien n'est en ligne tant que vous n'avez pas installé la plateforme sur un serveur.** L'hébergement, sa
maintenance et la validation RGPD par le chef d'établissement et le délégué à la protection des données (DPD) restent à
faire avant toute utilisation avec des élèves.

## 1. Essai sur votre PC (5 minutes, sans élèves)

Python 3.8 ou plus récent, rien d'autre à installer. Dans le dossier du projet :

```
python plateforme/serveur.py --creer-enseignant prof@exemple.fr "M. Essai"
python plateforme/serveur.py
```

Ouvrir http://localhost:8080 : la fenêtre de connexion s'ouvre. Se connecter avec l'adresse et le mot de passe choisis, puis
**Fichier > Plateforme : mes classes**. La base d'essai est dans `plateforme/donnees/` (jamais versionnée dans Git) : la
supprimer efface tout.

## 2. Utilisation

**Enseignant** (adresse électronique + mot de passe) — *Fichier > Plateforme : mes classes*

1. Créer une classe (« 4e B 2026-2027 »), puis les comptes : un prénom par ligne. La plateforme fabrique un identifiant
   (`4eb-lea-01`) et un mot de passe facile à recopier (`pomme-47-robot`). **Imprimez la fiche tout de suite** (ou exportez-la
   en CSV) : les mots de passe ne sont plus affichés ensuite. Mot de passe oublié : bouton « Nouveau mot de passe ».
2. Préparer la séance comme d'habitude (*Fichier > Espace enseignant > Préparer une séance* : titre, mode, exercices), puis
   onglet **Séances > Publier dans …**. Publier à nouveau la même séance la met à jour sans perdre le travail des élèves.
3. **Suivi** : un élève par ligne, état de chaque exercice, note en évaluation, dernier envoi, rendu. Un clic sur une case
   ouvre le programme de l'élève dans l'éditeur. Export CSV des résultats, impression.
4. **Fermer** une séance : les élèves ne la voient plus et ne peuvent plus envoyer (rouvrir est possible).
5. Fin d'année : *Élèves > Données de la classe (RGPD)* : exporter la classe (archive JSON), puis **supprimer la classe** :
   comptes, séances et travaux sont effacés de la base (et des sauvegardes au bout de 14 jours).

**Élève** (identifiant + mot de passe de la fiche) — la connexion est proposée à l'ouverture

- *Fichier > Mes séances en ligne* : Commencer / Reprendre. Le travail est enregistré en ligne toutes les 20 secondes ;
  *Rendre mon travail* indique au professeur que c'est terminé (on peut encore l'améliorer ensuite).
- Depuis un autre ordinateur ou depuis la maison : se connecter, *Reprendre* : les programmes reviennent.
- Sur un ordinateur partagé : *Fichier > (compte) > Se déconnecter* ferme la séance et efface le travail **du navigateur**
  (il reste en ligne). Le cookie de connexion disparaît aussi quand le navigateur est fermé, et la session d'un élève expire
  au bout de 4 heures.

## 3. Installation sur un serveur

Il faut : un serveur Linux **hébergé dans l'Union européenne** (petit serveur privé virtuel : 1 processeur, 1 Go de mémoire
suffisent pour un établissement), un nom de domaine (par exemple `microbit.mon-college.fr`, à demander au gestionnaire du
domaine de l'établissement ou de la collectivité), et une personne responsable des mises à jour.

### Avec Docker (le plus simple)

```
git clone <dépôt> /opt/microbit && cd /opt/microbit
# remplacer microbit.mon-college.fr dans plateforme/deploiement/Caddyfile.docker
docker compose -f plateforme/deploiement/docker-compose.yml up -d --build
docker compose -f plateforme/deploiement/docker-compose.yml exec plateforme python plateforme/serveur.py --creer-enseignant prof@mon-college.fr "Nom affiché"
```

### Sans Docker (Debian / Ubuntu)

```
sudo apt install python3 caddy
sudo useradd --system microbit && sudo mkdir -p /var/lib/microbit && sudo chown microbit /var/lib/microbit
sudo git clone <dépôt> /opt/microbit
sudo cp /opt/microbit/plateforme/deploiement/plateforme.service /etc/systemd/system/
sudo cp /opt/microbit/plateforme/deploiement/Caddyfile /etc/caddy/Caddyfile     # puis y mettre le vrai nom de domaine
sudo systemctl enable --now plateforme && sudo systemctl reload caddy
sudo -u microbit PLATEFORME_DONNEES=/var/lib/microbit python3 /opt/microbit/plateforme/serveur.py --creer-enseignant prof@mon-college.fr "Nom affiché"
```

Sauvegarde quotidienne : `plateforme/deploiement/sauvegarde.sh` dans la crontab de root (14 jours gardés). Tester une
restauration au moins une fois.

### Réglages (variables d'environnement)

| Variable | Rôle | En ligne |
|---|---|---|
| `PLATEFORME_COOKIE_SECURE` | cookie de connexion réservé à HTTPS | **1** |
| `PLATEFORME_PROXY` | adresse du client lue dans `X-Forwarded-For` (dernière adresse, ajoutée par Caddy) | **1** |
| `PLATEFORME_HOTE` / `PLATEFORME_PORT` | écoute du serveur Python | `127.0.0.1` / `8080` (jamais exposé directement) |
| `PLATEFORME_DONNEES` | dossier de la base SQLite | `/var/lib/microbit` |
| `PLATEFORME_CODE_INSCRIPTION` | code pour qu'un enseignant crée son compte depuis le site | vide (fermé) ou un code long |
| `PLATEFORME_NOM` | nom affiché | au choix |

## 4. Sécurité : ce qui est fait, ce qui reste à votre charge

Fait dans le code :
- mots de passe hachés (scrypt avec sel), jamais stockés ni journalisés en clair ;
- 10 essais de connexion par adresse et identifiant en 10 minutes, puis attente ;
- cookie `HttpOnly`, `SameSite=Lax`, `Secure` en ligne ; toute modification exige l'en-tête `X-Plateforme` (protection
  contre les requêtes envoyées par un autre site) ;
- chaque enseignant ne voit que ses classes ; un élève ne voit que les séances ouvertes de sa classe et son propre travail ;
  l'identité d'un travail vient du compte, pas du navigateur ;
- envois limités à 3 Mo ; seuls les fichiers de l'application sont servis (ni la base, ni les sources Python, ni `.git`) ;
- journal du serveur réduit aux appels de l'API et aux erreurs (adresse IP, date, adresse appelée ; jamais de mot de
  passe : ils ne passent que dans le corps des requêtes). Durée de conservation à fixer (voir RGPD.md).

À votre charge :
- mises à jour de sécurité du système (`unattended-upgrades`), pare-feu (ports 22, 80, 443 seulement) ;
- accès SSH par clé, comptes d'administration nominatifs ;
- sauvegardes chiffrées ou stockées dans l'UE, restauration testée ;
- surveillance (le service tourne-t-il ? le certificat se renouvelle-t-il ?) ;
- un audit de sécurité avant l'ouverture aux élèves est recommandé.

Limites connues : base SQLite (adaptée à un établissement, quelques centaines d'élèves connectés en même temps ; pour une
académie entière, prévoir PostgreSQL et un serveur d'application) ; pas de connexion par l'ENT ou ÉduConnect (les comptes
sont propres à la plateforme) ; pas de récupération de mot de passe par courriel (l'enseignant en donne un nouveau).
