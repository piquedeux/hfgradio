# HFG Radio website

## Structure

- `index.php`: single PHP entry point, route handling, and all backend endpoints.
- `router.php`: development-server adapter that forwards to `index.php`.
- `assets/`: JavaScript, CSS, locally linked fonts, and station-ident audio.
- `material/`: logos, icons, image assets, and `gallery-ATTENTION-autoupload/`.
- `content.txt`: editable server-side text, links, font path, and favicon path for the site, including the imprint and colophon. Values use `key=value`; write `\n` for line breaks.
- `snippets/`: shared header, footer, persistent player, page content, and chat document.
