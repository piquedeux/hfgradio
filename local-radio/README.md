# HFG Radio – lokaler AzuraCast-Test

Diese Konfiguration verwendet das offizielle stabile AzuraCast-Image und bindet
alle veröffentlichten Ports ausschließlich an `127.0.0.1`.

- Verwaltung und API: http://127.0.0.1:8080
- HTTPS: https://127.0.0.1:8443 (lokales Zertifikat)
- Erste Station: Ports 8000, 8005, 8006
- Stationskürzel für die bestehende Website: `hfg_radio`

Voraussetzung: laufendes Docker Desktop. Bei einer neuen Kopie zuerst
`python3 prepare-env.py` ausführen. Das erzeugt `.env` mit zufälligen
Datenbankpasswörtern und überschreibt keine bestehenden Zugangsdaten.

Im Verzeichnis `local-radio`:

```sh
docker compose pull
docker compose run --rm web -- azuracast_install
docker compose up -d
```

Danach die Ersteinrichtung unter http://127.0.0.1:8080 abschließen, die Station
`HFG Radio` anlegen und Streamers/DJs aktivieren. Die tatsächlichen
Einspeisedaten aus der Station in butt übernehmen; keine Airtime-Zugangsdaten
verwenden.

```sh
docker compose ps
docker compose logs --tail=100 web
docker compose stop
docker compose start
```

Die Daten liegen in Docker-Volumes und bleiben beim Stoppen erhalten.
`docker compose down -v` würde diese Daten löschen und ist kein normaler Stopp.
Der Mac muss für den Betrieb eingeschaltet bleiben. Diese Konfiguration ist
kein öffentlicher Hosting-Server.

Offizielle Installation: https://www.azuracast.com/docs/getting-started/installation/docker/
