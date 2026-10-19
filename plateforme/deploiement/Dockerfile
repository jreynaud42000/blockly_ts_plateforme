# Image de la plateforme (Python standard, aucune dependance). Construire depuis la RACINE du projet :
#   docker build -f plateforme/deploiement/Dockerfile -t plateforme-microbit .
FROM python:3.12-slim
RUN useradd --system --uid 1000 microbit && mkdir -p /donnees && chown microbit /donnees
WORKDIR /app
# Seuls les fichiers de l'application (pas site_web, pas les sources de l'exe, pas .git)
COPY index.html exercices.json firmware.hex logo.png logo_ts.png *.js ./
COPY lib ./lib
COPY plateforme/serveur.py ./plateforme/serveur.py
USER microbit
ENV PLATEFORME_HOTE=0.0.0.0 PLATEFORME_PORT=8080 PLATEFORME_DONNEES=/donnees PLATEFORME_COOKIE_SECURE=1 PLATEFORME_PROXY=1
VOLUME /donnees
EXPOSE 8080
CMD ["python", "plateforme/serveur.py"]
