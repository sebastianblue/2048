# 2048: ANTE — After Hours

A sliding-tile roguelite by Sebastian. Build a deck of tiles, combine enhancements, collect mods, and beat eight antes of rising score targets.

**Play: https://sebastianblue.github.io/2048/**

## Playing

Use arrow keys, WASD, swipe, or the direction buttons. A valid slide costs one move. Equal tiles merge once per move; merges score chips, while chains, mods and tile finishes build your multiplier. Reach the target and bank the round, or keep playing for extra cash.

Between rounds, buy mods, items, packs and firmware. Each shop has exactly two random pack offers in one Packs section. Tile and Blueprint packs share the common pool; Blacksite packs are rare. Offers can repeat a type, and neither common type is guaranteed. Shop rerolls do not refresh packs. Blueprint packs contain deck edits, supplies, money and upgrades for the run. Kick, Plus, Prism, Iron, Brass and Odds each have their own blueprint, which applies only that named finish to a chosen tile. Rare Blacksite packs contain experimental deck work with tradeoffs. **Opening any pack spends its price permanently.** You can skip its contents, but there are no refunds or replacement offers. Standard packs offer 3 choices and 1 pick; Large packs offer 5 choices and 1 pick; Deluxe packs offer 5 choices and 2 picks. Larger packs cost more. The Print Shop firmware adds one extra tile-pack choice and takes $1 off the listed price. Bulk License adds one choice to Blueprint and Blacksite packs; it never adds a pick.

Blueprint and Blacksite packs deal a random hand of 8 deck tiles. All tile jobs and held tile tools use that hand; canceling a selection or making a second Deluxe pick never redraws it. Removed tiles leave the hand, and newly created tiles go into the deck without replacing the missing choices. Held tools do not spend a pack pick. Changes inside a pack are permanent deck edits. During rounds, Blueprints and tools marked **Permanent** target linked draws marked **↗** and update the exact source card in the deck, upcoming pile and matching linked draws. Merges break the link; temporary copies and temporarily altered draws cannot be used to rewrite deck cards. Ordinary tactical tools stay temporary. Archive still files any eligible board tile into the deck.

The shop has a held-item rack and a **Buy & use** option for immediate items: Clock, Polish, Grease, Hot Wire, Read Head, Service Pass, Credit Chip and Scrap Cache. Most work even with full item slots; Scrap Cache needs room for its two tools. Clock used in the shop saves 6 extra moves for the next round (8 with Spare Battery); other boosts wait for their stated triggers. Wrench moves an installed fixture without restoring its charge, and Stack sends one of the next three draws to the bottom of the pile. Permanent deck tools work on marked linked draws or the hand inside an open Blueprint or Blacksite pack. Positional tools such as Line Driver and Skip Trace work only on the board.

**Board fixtures** stay on their chosen cells between rounds. Start with three slots; the Extension Lead firmware unlocks a fourth. Each shop stocks one fixture separately from its two packs, and Blueprint packs can contain fixture plans. A new installation can replace an old one without a refund. Shop rerolls do not change fixture stock.

| Fixture | Cost | Merge on its cell to… |
|---|---:|---|
| Press | $6 | Gain 20 chips. |
| Flywheel | $8 | Collect stored chips: 10 per intervening move, up to 60. |
| Toll Booth | $8 | Collect $1, twice per round. |
| Copy Desk | $10 | Spawn a plain copy of a result up to 32, once per round; needs space. |
| Inkwell | $9 | Give a plain result a random finish, once per round. |
| Trapdoor | $10 | Gain ×1.6 mult and remove a result of 16 or more, twice per round. |
| Switchboard | $7 | Gain +4 mult when the incoming direction differs from its previous hit. |

Fixture charges and direction memory reset each round. Field Service gives limited-use fixtures one extra use; Copper Traces adds 5 chips per real activation. Their effects resolve after tile finishes and before mods. Foreman rewards fixture activations; Live Circuit rewards hitting two at once; Field Notes grows when fixtures are installed. Compass, Clean Cut and Surveyor support alternating directions, plain tiles and merges spread across rows and columns. See [the board-workshop notes](reference/board-workshop.md) for tuning and interaction details.

Higher values can rarely appear in tile packs after you have made that exact value on the board during the current run. Larger numbers stay rarer. Six mixed-finish reactions reward setting up particular pairs; the rules sheet describes each one. Each pairing triggers at most once per move.

The board resets each round; your deck, mods and purchased upgrades remain for the run. Music keeps its place between screens. Sound settings have separate music/effects sliders, a mute button and manual track selection. Reduced-motion settings are respected.

## After Hours / v2.0.0

An 80s cyberpunk arcade treatment: steel cabinet, amber scores, circuit-board mod cartridges, a night-market skyline and a matching pack/editor interface. Music and sound scheduling are unchanged.

This release adds **50 cards: ten mods, ten consumables, ten Blueprint effects, ten Blacksite effects and ten firmware upgrades**. The seven fixtures and six tile finishes remain the same. New combinations include lean decks with Minimal ROM, matched draws with Cassette Loop, mixed finishes with Cross Talk, and a single enhanced tile with Null Modem. See [the full 50-card list and costs](reference/after-hours.md).

All additions have source review and syntax checks only. No automated tests or browser playtests were run for this release, at the user's request; tuning remains unplaytested.

## Loadout & runs / v2.1.0

- **Boss forecast:** see the current ante's boss from its first round and in the shop. After beating it, the shop previews the next ante's boss. Each boss is chosen once from a separate seeded schedule.
- **Permanent board edits:** named finish Blueprints, Mould, Wedge, Promote, Twin, Burn and Temper now change their linked deck cards when used during a round. Eligible draws show ↗ and highlight when selecting; merged tiles never become eligible again.
- **Collection:** all mods, items, Blueprints, Blacksite cards, firmware, fixtures and finishes are visible from the title screen, pause menu and footer. Search names/effects and filter mod rarity. There are no hidden card definitions.
- **Difficulty:** Street → Wired → Hardline → Lockdown → Kill Screen. Beat Ante 8 on a level to unlock the next. Higher levels raise targets, reduce moves, speed rubble or reduce starting cash; all penalties are listed before starting. Existing full-run wins unlock Wired.
- **Skins:** After Hours and Paper Arcade are free. Amber Terminal, Ice Station and Scarlet Circuit unlock at 1, 3 and 5 full-run wins. Skins are purely cosmetic and can change in Settings mid-run. Unlocks stay in this browser; QA preferences are separate.
- **Mod work:** six new Blueprint cards and two Blacksite cards tune, trade, salvage, transfer tuning or overdrive owned mods. Extra cash and permanent move costs are shown before applying; canceling spends no pick. See [details and caps](reference/loadout-and-runs.md).

This release received source and syntax review only, with no automated tests, browser playtests or audio playback, as requested. Difficulty tuning awaits playtest evidence.

## Local development

Requires a recent Node.js release (Node 22 or newer recommended).

```sh
npm install
npm start
```

Open http://127.0.0.1:4178/. Use `?qa=1` to keep test-run history and sound preferences separate from your normal browser history.

The game is authored directly in `dist/`; there is no build step and no production dependency. `index.html` loads `game.js` (rules/UI), `audio.js` (music/sound) and `juice.js` (impact/reveal animations). `style.css` provides layout; `cyberpunk.css`, local fonts and the original `assets/after-hours.svg` city illustration provide the After Hours presentation. `progression.js`/`.css` handle cosmetic and difficulty unlock menus; `collection.js`/`.css` render the card catalogue from the game definitions; `run-upgrades.css` styles boss forecasts, linked draws and mod work. Legacy `engine.js`/`app.js` are retained for the earlier version and are not loaded by the current page.

## Publishing

GitHub Pages serves the root of the `gh-pages` branch. All asset URLs are relative so the game works under `/2048/`.

```sh
git add .
git commit -m "Update the game"
git push origin main
npm run deploy
```

The publisher copies the committed `dist` tree into a new, ordinary commit on `gh-pages`. It preserves publishing history and refuses uncommitted game files. GitHub Pages publishes that branch automatically. Keep the asset version parameters in `index.html` aligned with each release. The game also upgrades the older cached shop layout before rendering it.

## Run history and checks

Run history is stored in the current browser. **Run history & export** downloads the most recent 25 runs as JSON for playtest discussion. The hosted game does not transmit gameplay logs to a server. Starting a new run does not resume unfinished play; exports are history, not saved-game files.

`npm test` includes the current game's DOM interactions and scoring, audio scheduling/levels, and the older engine's regression suite. `npm run balance` targets the legacy engine; it does not establish balance for this edition.

## Credits

Based on 2048; inspired by Balatro. Music includes Sebastian Blue, Sebastian Blue ft. Juliana Aquino, and Apple iLife cues. Audio is leveled for the game; original recordings remain unchanged. Sound effects are generated specifically for the game. Typeface: Barlow by Jeremy Tribby.

Music and other third-party assets retain their respective rights. See `reference/audio-notes.md` for audio provenance and calibration, and `reference/game-feel.md` for the animation approach.
