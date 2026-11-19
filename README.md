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
| `js/hall.js` | The data-hall drawing in the hero. |
| `js/figures.js` | The interactive figures (cooling loops, cold plates, flags, cell sorter, bearing texture, stress-strain). |
| `assets/` | Photos, logos, the CV and the cooling-twins infographic. |
| `fonts/` | Archivo, IBM Plex Sans and IBM Plex Mono (SIL Open Font Licence). |

## Theme

The page opens in the day theme for every visitor, whatever their phone, computer or browser is set to. The sun and moon button in the top bar switches to the night theme, and the choice is remembered on that device.

## Things to update by hand

- `assets/Muhammad-Talha-Khalid-CV.pdf` still says "top 5%" and "Dean's Honours List in each of the last three semesters". The page now says "top 10%" and "Dean's Merit List".
- The canonical and social-preview addresses in the `<head>` of `index.html` point at `muhammadtalhakhalid-iota.vercel.app`. Change them if the site moves.
