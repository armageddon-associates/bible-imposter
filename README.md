# Bible Imposter

A Bible-themed pass-and-play party game for church youth groups, Bible studies, and friends. Gather 3–20 players around one device, give clues, discuss, and vote to find the hidden Imposter.

## Play

Start at `index.html` using a local web server. Add 3–20 unique player names, set the Imposter count, select Bible categories, adjust timers, and optionally enable the final guess. Each game randomly chooses one of two modes:

- **Different Word:** Civilians share a Bible-related word; Imposters receive a related word.
- **Hidden Bible Word:** Civilians share a word; Imposters receive no word and infer it from clues.

Players privately reveal roles, give one clue each, discuss, and vote privately. Votes are concealed until closed. Ties lead to a revote among tied players; a second tie eliminates nobody. Civilians win when no Imposters remain. Imposters win when they equal or outnumber the Civilians. If enabled, the last eliminated Imposter gets one final guess.

## Run locally

Requires Node.js 18+ for the local server and included test runner. The site has no third-party runtime dependencies, so there is nothing to install with `npm install`.

```sh
npm run start
```

Then open `http://127.0.0.1:4173`. The server can also use a different port by setting `PORT` (for example, `PORT=8080 npm run start`).

Alternatively, if Python is installed:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Serve the project root so JavaScript ES modules load from an HTTP origin. `file://` is not supported.

## Word bank

Edit [`js/words.js`](js/words.js). Each category stores related pairs as two strings. `individualWords` is derived from those pairs for Hidden Bible Word mode. The helper functions trim custom values, remove duplicate words and pairs (case-insensitively), reject blank or overlong entries, and exclude pairs whose two words are identical. Custom words entered by a host are paired in the order entered for Different Word mode; an unpaired final word remains available in Hidden Bible Word mode. Use terms that are recognizable and appropriately related. The bank contains biblical names, places, events, objects, concepts, teachings, miracles, books, and people/story combinations.

The game uses biblical vocabulary and original instructions, not copied NIV passages or a proprietary NIV word list. It does not provide Bible quotations or unverified verse citations.

## Tests

Run the pure game-engine tests with Node's built-in runner:

```sh
node --test tests/game-engine.test.js
```

## Deploy

### GitHub Pages

Commit the project to a repository. In **Settings → Pages**, choose **Deploy from a branch**, select the deployment branch and root (`/`), and save. The app uses relative CSS, script, and icon paths and works from a repository subpath.

### Netlify

Create a new site from the repository and set the publish directory to the project root. No build command is needed. For a manual deploy, upload the project directory contents.

## Preferences and privacy

Sound, reduced motion, timer defaults, and category preferences are stored in `localStorage`; player names, roles, words, and votes are not. Active game data remains in browser memory. Secret role content is inserted only after the player taps to reveal. Reveals and votes use handover screens, and the interface clears the private card when continuing. The app uses the Web Crypto API with rejection sampling and Fisher–Yates shuffling.

Pass-and-play privacy is for casual play. Anyone with developer-tools access can inspect client memory, and players can see a private screen if they look. Do not treat this as tamper-proof secrecy.

## Troubleshooting

- If modules fail to load, serve the folder through HTTP/HTTPS instead of opening the HTML file directly.
- If a selected category has no usable word pair or word, the start screen shows an explanatory validation error. Select more categories or add custom words.
- If a preference is stuck or malformed, use **Settings → Clear saved preferences**.
- The clue and discussion timers can be disabled in setup. A host can always advance clues or start voting early.
- No account, backend, analytics, tracking, external font, image API, or paid API is required.
