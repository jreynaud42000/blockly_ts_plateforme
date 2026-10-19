#!/bin/sh
# Sauvegarde quotidienne de la base (a lancer par cron, par exemple : 15 2 * * * /opt/microbit/plateforme/deploiement/sauvegarde.sh)
# Copie coherente meme pendant l'utilisation (sqlite3 .backup), 14 jours gardes, fichiers lisibles par root seulement.
# Les sauvegardes contiennent des donnees d'eleves : meme duree de conservation et meme protection que la base (RGPD.md).
set -eu
DONNEES=${PLATEFORME_DONNEES:-/var/lib/microbit}
DEST=${SAUVEGARDES:-/var/backups/microbit}
umask 077
mkdir -p "$DEST"
python3 -c "import sqlite3, sys; s = sqlite3.connect(sys.argv[1]); d = sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()" \
    "$DONNEES/plateforme.sqlite3" "$DEST/plateforme_$(date +%F).sqlite3"
find "$DEST" -name 'plateforme_*.sqlite3' -mtime +14 -delete
