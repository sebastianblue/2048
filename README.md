# Double or Nothing

A complete browser-based 2048 roguelite. Plain HTML, CSS and JavaScript; no runtime package dependencies. The `dist/` directory is the authored deployable game.

## Play

Run `npm start`, then open `http://127.0.0.1:4178/`. Use arrows, WASD, touch swipes or on-screen direction buttons. Equal tiles merge once per slide. Beat each round's score target before spending your moves. Shops appear between rounds; the twelfth round is the final boss.

- 18 relics, 6 consumable powerups, five relic slots, three powerup slots.
- 12 rounds in four antes, four visible boss rules, three starting kits.
- Standard, Easygoing and unlockable High Stakes modes; fixed daily seeds use UTC.
- Device-local automatic saves, optional procedural sound, reduced motion, keyboard controls.
- Relic selection and tile generation use separate seeded random streams.

## Playtest logs

The local server writes game events as JSON Lines under `playtests/YYYY-MM-DD.jsonl`. These files are ignored by Git and never deployed. Each event includes a run identifier, seed, timestamp, event type, before/after board state, score, moves, money, inventory and relevant score breakdown or shop action. Logging starts when the updated page is loaded; earlier moves cannot be reconstructed. An existing run is captured with a `resume` snapshot.

Use **Feedback & logs** to attach a note to the current state or download the browser's recent events as JSON (up to 1,000 events or approximately 2.5 MB; local project logs retain all received events). Hosted play keeps logs in that browser for download; it does not send play data to a server. The local endpoint accepts only same-origin POSTs and caps request size. `?playtest` uses separate local storage and never writes to the user's local playtest files.

## Checks

`npm test`: 20 engine checks covering movement, conservation, relic math, all bosses, shop restrictions, economy, powerups, recovery, deterministic replay, saves and a complete winning run.

`npm run balance -- 500`: deterministic simulation with three policies. See `DESIGN.md` for the final results and limitations.

## Files

- `dist/engine.js`: pure deterministic rules and content definitions.
- `dist/app.js`: UI, animation, audio, browser saves, playtest logging and optional WebMCP.
- `dist/style.css`: responsive game and market styling.
- `server.js`: local static server and local-only playtest collection.
- `tests/`: invariant checks and balance simulations.

Research credits and their application are documented in `DESIGN.md` and the in-game Design notes.
