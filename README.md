# HFG Radio

Static HTML pages using Arial Narrow/Arial and three small PHP endpoints. Serve the repository root with PHP 8.2+ and the curl, exif, and fileinfo extensions. No database is required for the website.

## Local website

```sh
php -n -S 127.0.0.1:8765 router.php
```

Open http://127.0.0.1:8765. In Herd, link this folder and use its PHP site URL. The router is for PHP's development server only. For nginx, deny access to `/azuracast/`, dotfiles, and executable files in the gallery folder; Apache rules are included. Do not publish the AzuraCast folder with the public website.

## Local AzuraCast

Docker Desktop (or another Docker runtime with Compose) must be installed and running. It is not installed by this repository. Allow at least 2 GB RAM and 20 GB disk; 4 GB RAM is recommended by AzuraCast.

```sh
sh azuracast/start.sh
```

1. Open http://localhost:8080 and create the administrator account.
2. Create HFG Radio with short code `hfg_radio` (or set the actual station ID in `api/config.php`). Use Icecast, Liquidsoap, and a default MP3 mount. Enable the public page/API.
3. Set the station base port to 8000. Enable streamers/DJs, create a DJ account, and use AzuraCast's displayed connection settings in your broadcasting software. Ports 8000, 8005, and 8006 are forwarded locally.
4. Enable the station's web proxy if you want playback through port 8080. Upload music and enable a playlist for AutoDJ, or connect a DJ.
5. Check `/api/nowplaying.php` on the website. Its station `listen_url` must be reachable from the listening browser.

The Compose file is adapted from https://github.com/AzuraCast/AzuraCast/blob/main/docker-compose.sample.yml. It uses the official stable image, persistent named volumes, one station, localhost-only port bindings, and no automatic updater. On this Mac, nothing is exposed to the LAN. For other computers/listeners, move AzuraCast to the radio host, configure its public HTTPS URL and networking, and update `api/config.php`; `localhost` addresses only work on the host itself. An HTTPS website needs HTTPS stream URLs.

Stop: `docker compose -f azuracast/docker-compose.yml --project-directory azuracast stop`.
Update: back up in AzuraCast first, then run `docker compose pull`, `docker compose down` (without `-v`), `docker compose run --rm web -- azuracast_update`, and `docker compose up -d` inside `azuracast`. Never remove volumes unless you intend to erase station data.

Reference: https://azuracast.com/docs/getting-started/installation/docker/

## Interface

The interface is built around a concentric HFG logo control, a full-width SVG clock, compact black status bars, and alternating archive rows. The clock uses SVG `textLength` with `lengthAdjust="spacingAndGlyphs"` so its digits always span the viewport.

## Live input: butt

Signal path: mixer/audio interface → butt → AzuraCast's Liquidsoap DJ input → Icecast → website player.

Use the existing butt installation. In butt's Audio settings, select the physical interface or loopback device carrying the programme audio. The website does not capture a microphone; butt encodes and sends the programme to AzuraCast.

After AzuraCast is running, enable Streamers/DJs and create a DJ account. In butt, choose Settings → Server Settings → ADD:

- Name: HFG Radio — AzuraCast
- Type: Icecast
- Address: `127.0.0.1` when butt and AzuraCast run on the same computer. Otherwise use the radio server's hostname/IP.
- Port: use the **Icecast clients** port from AzuraCast → Streamers/DJ Accounts → Connection Information. The local Compose setup forwards 8005 for the standard station-base-8000 DJ configuration; confirm the displayed value.
- Icecast user/password: the DJ account credentials, not the AzuraCast administrator account.
- Icecast mountpoint: copy Mount Name from Connection Information (usually `/`). Do not substitute the listener mount `/radio.mp3`.

Select the new server and the intended audio input in butt, then start streaming when ready. Confirm butt shows a connection and AzuraCast shows the DJ as live; the website's LIVE ON AIR banner follows that status. Keep the website player muted on the broadcast computer to avoid monitoring feedback.

The current Docker port bindings are localhost-only. A butt installation on a separate computer cannot connect until the radio host's network configuration is intentionally changed.

butt 1.47.0 is installed at `/Applications/butt.app` and its idle window was verified. AzuraCast is not running yet because Docker is not installed. No broadcaster credentials have been invented or stored in the website. The actual input device and DJ connection still need to be selected once the station is running.

Official connection guide: https://azuracast.com/docs/user-guide/streaming-software/#broadcast-using-this-tool-butt

## Live status / player

The PHP endpoint proxies the configured station's Now Playing API. The browser polls every 15 seconds. A live DJ produces the red LIVE ON AIR banner; AutoDJ produces the green ON AIR banner. Offline and unavailable are separate states. No live status is inferred from a calendar. PLAY/STOP and MUTE/UNMUTE control a native audio element; browser/network playback failures remain retryable.

## SoundCloud archive

`/archive/` reads the radio's official public SoundCloud RSS feed, following pagination. Each recording becomes its own dated post, newest first, with a text PLAY/PAUSE control embedding the SoundCloud-hosted RSS audio and a SoundCloud attribution link. Feed refresh runs every five minutes; the server caches successful results and keeps serving the last result if SoundCloud is unavailable. No API credentials are needed.

For each new SoundCloud upload, enable “Include in RSS feed” in its permissions. Only RSS-enabled public recordings appear. The source is https://feeds.soundcloud.com/users/soundcloud:users:1478398819/sounds.rss. SoundCloud's profile widget did not return recordings during verification, so the archive uses its public podcast feed and audio enclosures instead.

## Live in real life

Drop JPG/JPEG, PNG, WebP, or GIF files into `gallery-ATTENTION-autoupload/`. The gallery scans on page load and refreshes every 30 seconds. Files are served directly from this folder; no manual HTML entry or external upload is required. Copy complete files into place (for large files, copy under a temporary extension, then rename).

JPEG EXIF capture time is used when available; otherwise the file modification timestamp is used. Dates without an EXIF timezone are interpreted as Europe/Berlin. Entries sort newest first. The filename without extension is the subtitle. JPEG GPS metadata becomes a coordinate link to OpenStreetMap. No location is invented and no reverse-geocoding service receives the coordinates automatically. HEIC is not supported: export it as JPEG first. Original files, including their metadata, remain available to visitors.

## Imprint

`imprint/index.html` contains explicit placeholders for operator name, postal address, and contact email. Replace these with the station's supplied details before publication. Credits are in `/colophon/`.


### Website player sources
The website now uses only the AzuraCast audio stream. Twitch video and its source switching have been removed: Twitch's official embed does not support a hidden audio-only player. For simultaneous Twitch broadcasts, send the same source audio to AzuraCast using butt. Archive PLAY opens one SoundCloud visual embed at a time; desktop hover shows RSS artwork. Arial, Arial Narrow and Arial Rounded MT Bold are linked from local files in assets/fonts; Rounded is scoped to player controls.


Twitch broadcasting uses the Twitch channel's broadcast software/setup. butt is the encoder for the AzuraCast event input; it does not send an audio-only broadcast directly to Twitch. The local AzuraCast server must be running with the station and streamer credentials configured before event playback works.


### Google Drive gallery
The public gallery now embeds folder `1QO0CYPm5Px3qDIRHCsnimjfNS9DnGYLG` using Google Drive's grid view. Upload publicly viewable photos there; the folder contents load from Google whenever the gallery opens or is refreshed. This folder was empty when connected. The embed controls its own layout and order; custom EXIF/location/date captions and guaranteed newest-first sorting are not available in this mode. The local gallery remains active above the Drive section: files in gallery-ATTENTION-autoupload appear automatically with capture dates and EXIF locations, sorted newest first. Both sources are displayed independently. A Drive API integration is required to recover the custom metadata layout.

Archive artist extraction runs automatically during feed refresh (five-minute cache). It uses the feed author if different from HFG RADIO, or explicit supported title patterns, rather than AI guesses. Unclear credits stay blank.
