# Muhammad Talha Khalid, portfolio

A static site: no build step and no external requests. Fonts, scripts and images are all in this folder.

## Publish

Copy everything in this folder to the root of the `m0talhakhalid.github.io` repository and push. GitHub Pages serves `index.html` as it is. The same folder works on Vercel as a static project.

## Where things live

| Path | What it is |
|---|---|
| `index.html` | All of the page content. Edit text here. |
| `css/site.css` | Colours, type and layout. The colour tokens for light and dark are at the top. |
| `js/site.js` | Navigation, theme switch, image viewer, contact helpers. |
| `js/sheets.js` | The cards and the pop-up detail sheets: opening, closing, the back button, stepping between sheets. |
| `js/hall.js` | The data-hall drawing in the hero. |
| `js/figures.js` | The interactive figures (cooling loops, cold plates, flags, cell sorter, bearing texture, stress-strain). |
| `assets/` | Photos, logos, the CV and the cooling-twins infographic. |
| `fonts/` | Archivo, IBM Plex Sans and IBM Plex Mono (SIL Open Font Licence). |

## Cards and detail sheets

Each section shows short cards. The full text, figures and photos for a card sit in an `<article class="sheet-src" id="s-…">` in the `sheet-store` at the end of the same section of `index.html`. Edit the long text there and the short text on the card itself.

- A card opens its sheet through its link, `href="#s-…"`. Any link on the page with that kind of address opens the sheet, so a sheet can be linked from anywhere, including from another sheet.
- `data-group` on a sheet sets which other sheets the arrows step through.
- A link straight to a sheet, such as `…/#s-twins`, opens that sheet when the page loads. The browser's back button closes it.
- With scripts off, the sheets show in place under their cards.

## Skills cards and the flow behind Current studies (original notes)

- Each unit in the skills rack opens to list where that tool shows up on the site. The list is kept as plain HTML in `index.html`: edit the links in each `unit-more` block.
- The flow behind Current studies is drawn in `js/figures.js` (search for "flow past a cylinder"). It is a point-vortex sketch, not CFD, and the note under its controls says so.

## Theme

The page opens in the day theme for every visitor, whatever their phone, computer or browser is set to. The sun and moon button in the top bar switches to the night theme, and the choice is remembered on that device.

## Things to update by hand

- `assets/Muhammad-Talha-Khalid-CV.pdf` still says "top 5%" and "Dean's Honours List in each of the last three semesters". The page now says "top 10%" and "Dean's Merit List".
- The canonical and social-preview addresses in the `<head>` of `index.html` point at `muhammadtalhakhalid-iota.vercel.app`. Change them if the site moves.

## Doodle version

The pictures are hand-drawn SVG doodles, written straight into `index.html`. The doodle layer lives in three files:

- `css/doodle.css`: handwriting font (Caveat, self-hosted in `fonts/`), doodle styles, the few animations, and the night-mode colours.
- `js/doodle.js`: draws each doodle in as it scrolls into view, the single-phase / two-phase switches, the label notes on the cooling drawings, the place notes on the map, the skill flip cards and the postcard.
- `js/kv.js`: the live von Kármán street under Current studies (flow-speed slider, dye, nudge the cylinder).

The cooling-twins infographic gets its doodles from `assets/ig-doodle.css` and a small script at the end of `assets/cooling-twins-infographic.html`.

Everything moving stops for visitors who ask their device to reduce motion, and pauses while it is off screen.

## Contact postcard

The postcard posts straight to talhakhalidraja692@gmail.com through FormSubmit (`data-endpoint` on `<form id="letter">` in `index.html`). Visitors do not need an email app, and the reply address is optional.

One-time step: after the site is live, send yourself a test postcard. FormSubmit emails you an "Activate Form" link; click it once and every postcard after that arrives in your inbox.

To use your own Google Apps Script instead (`Code.gs`), deploy it as a web app and paste its `/exec` URL into `data-endpoint`. The page detects which one it is talking to.
