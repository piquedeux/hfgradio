# HFG Radio website

## Structure

- `index.php`: single PHP entry point, route handling, and all backend endpoints.
- `router.php`: development-server adapter that forwards to `index.php`.
- `assets/`: JavaScript, CSS, locally linked fonts, and station-ident audio.
- `material/`: logos, icons, image assets, and `gallery-ATTENTION-autoupload/`.
- `content/content.txt`: editable server-side text and link values for the site, including the imprint and colophon. Values use `key=value`; write `\n` for line breaks.
- `snippets/`: shared header, footer, persistent player, page content, and chat document.

Hidden Git/editor metadata is development tooling, not a public content folder.

## Run locally

```sh
php -n -S 127.0.0.1:8766 router.php
```

PHP requires cURL, DOM, SimpleXML, and EXIF for the corresponding integrations. On Apache, enable `mod_rewrite` and allow the supplied `.htaccess`. Other servers must route page URLs to `index.php` and deny direct access to `snippets` and hidden files.

## Navigation and playback

All page panels are rendered once by `index.php`. Internal navigation updates the URL, title, active navigation, and visible panel without reloading the document. Browser Back/Forward works the same way. The audio element and Twitch engine remain mounted, as do expanded SoundCloud embeds, so ordinary internal navigation does not restart playback. Refreshing, closing the tab, following an external link in the same tab, or a stream/network failure can still interrupt audio.

The shared player appears as a circle on the home page and compact controls elsewhere. The round DWD webcam image is another play/pause button. CHAT is green; an open desktop chat makes its button white on green. Desktop chat expands above the introduction. Mobile CHAT opens Chatango directly in a separate tab.

## Media and feeds

Backend routes use `index.php?api=archive`, `gallery`, `drive-image&id=...`, `nowplaying`, `twitch`, and `press`. Legacy `/api/name.php` URLs are also dispatched without redirects.

Local gallery uploads now belong in **`material/gallery-ATTENTION-autoupload/`**. The existing files were moved intact. The gallery combines these with the public Drive folder, extracting capture dates and GPS where available and sorting newest first. Drive originals are validated and stored in a private temporary cache. The public Drive HTML adapter is refreshed every five minutes and depends on Google's markup; up to four uncached/expired images are refreshed per request. Undated images have no invented dates.

SoundCloud recordings, artwork, and artist credits refresh every five minutes. Explicit artist credits come from metadata or recognizable title patterns; unclear credits remain blank. Offline PLAY runs `assets/audio/station-ident.mp3`, then a shuffled queue without repeats until exhausted. The recording card expands and the banner reads NOT LIVE in neon green.

Twitch `hfgradio` is preferred when the public DecAPI uptime service reports it live; DecAPI supplies its title. AzuraCast is configured inside the `nowplaying` case in `index.php` (currently `http://127.0.0.1:8080`, station `hfg_radio`). Per the user's request, the Twitch embed is visually hidden. This is outside Twitch's supported visible-embed setup and may be blocked. Live autoplay is attempted; browsers can require PLAY. Twitch live audio still requires verification during a broadcast.

Press reads the public Google Sheet columns A (title), B (HTTP/HTTPS URL), C (publication date), refreshed every five minutes. Invalid links and header/empty rows are skipped. The cooperation contact is `hfgradio@gmail.com`.

## Restructure backup

A pre-restructure backup was saved outside this website at `/tmp/hfgradio-before-restructure-1790005638.tar.gz`. Temporary backups are not permanent storage.
