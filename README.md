# 2048: ANTE

A sliding-tile roguelite by Sebastian. Build a deck of tiles, combine enhancements, collect charms, and beat eight antes of rising score targets.

**Play: https://sebastianblue.github.io/2048/**

## Playing

Use arrow keys, WASD, swipe, or the direction buttons. A valid slide costs one move. Equal tiles merge once per move; merges score chips, while chains, charms and tile finishes build your multiplier. Reach the target and bank the round, or keep playing for extra cash.

Between rounds, buy charms, items, tile packs and permits. Blueprint packs contain deck edits, supplies, money and upgrades for the run. Rare Oddity packs contain experimental deck work with tradeoffs. **Opening any pack spends its price permanently.** You can skip its contents, but there are no refunds.

Higher values can rarely appear in tile packs after you have made that exact value on the board during the current run. Larger numbers stay rarer. Six mixed-finish reactions reward setting up particular pairs; the rules sheet describes each one. Each pairing triggers at most once per move.

The board resets each round; your deck, charms and purchased upgrades remain for the run. Music keeps its place between screens. Sound settings have separate music/effects sliders, a mute button and manual track selection. Reduced-motion settings are respected.

## Local development

Requires a recent Node.js release (Node 22 or newer recommended).

```sh
npm install
npm start
```

Open http://127.0.0.1:4178/. Use `?qa=1` to keep test-run history and sound preferences separate from your normal browser history.

The game is authored directly in `dist/`; there is no build step and no production dependency. `index.html` loads `game.js` (rules/UI), `audio.js` (music/sound) and `juice.js` (impact/reveal animations). `style.css` and local fonts provide the presentation. Legacy `engine.js`/`app.js` are retained for the earlier version and are not loaded by the current page.

## Publishing

GitHub Pages serves the root of the `gh-pages` branch. All asset URLs are relative so the game works under `/2048/`.

```sh
git add .
git commit -m "Update the game"
git push origin main
npm run deploy
```

The publisher copies the committed `dist` tree into a new, ordinary commit on `gh-pages`. It preserves publishing history and refuses uncommitted game files. GitHub Pages publishes that branch automatically.

## Run history and checks

Run history is stored in the current browser. **Run history & export** downloads the most recent 25 runs as JSON for playtest discussion. The hosted game does not transmit gameplay logs to a server. Starting a new run does not resume unfinished play; exports are history, not saved-game files.

`npm test` includes the current game's DOM interactions and scoring, audio scheduling/levels, and the older engine's regression suite. `npm run balance` targets the legacy engine; it does not establish balance for this edition.

## Credits

Based on 2048; inspired by Balatro. Music includes Sebastian Blue, Sebastian Blue ft. Juliana Aquino, and Apple iLife cues. Audio is leveled for the game; original recordings remain unchanged. Sound effects are generated specifically for the game. Typeface: Barlow by Jeremy Tribby.

Music and other third-party assets retain their respective rights. See `reference/audio-notes.md` for audio provenance and calibration, and `reference/game-feel.md` for the animation approach.
