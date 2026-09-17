# Loadout & runs — v2.1.0

## Boss forecast

The boss is selected once at the start of an ante. The board's forecast shows its name, rule and target; it can expand for details. Both shops before that boss show the same forecast. The shop after a boss shows the next ante's boss. Bosses use a separate seed stream and do not reroll when menus render or a pack opens.

## Linked deck edits

Every permanent deck card has a unique identity. Draws carry that identity; two ordinary 2s are not treated as the same card. A board tile is linked while it remains an unmerged, unchanged draw of a card still in the deck. A merge clears provenance from both participating tiles. A temporary spawn or copy has no provenance. Temporary value/finish changes make the draw ineligible until it matches its source again.

Marked ↗ tiles can receive permanent items during a round: the six finish Blueprints, Promote, Twin, Burn, Temper, Mould and Wedge. Selecting an item highlights eligible tiles and dims the rest. Frozen tiles remain unavailable. Only the exact source deck card changes, together with matching linked draws and any copy already in the upcoming pile. This never writes a temporarily buffed or merged value back into the deck.

Twin/Wedge require both deck capacity and a free board cell. Burn respects the 12-card minimum; copies respect the 22-card maximum. Mould requires two distinct source cards with a meaningful difference. Board Eraser, Halve, Double and the positional/finish-transfer tools remain temporary. Archive is still the way to file a built-up tile.

Pack editing still uses its fixed eight-card hand. New cards get fresh identities; replacing another card preserves the recipient's identity. Undo restores deck identity, pile, grid, score state and score-triggered deck edits. Using a permanent item clears the previous move's Undo snapshot.

## Mod pack cards

| Family | Card | Effect and extra cost |
|---|---|---|
| Blueprint | Heat Trace | Pay $3 for +20 chips per scoring move on one mod. Regular tuning caps at +40. |
| Blueprint | Gain Stage | Pay $4 for +2 mult per scoring move on one mod. Regular tuning caps at +4. |
| Blueprint | Buyout | Remove a sellable mod for twice its sell value plus $3. Tuning is lost. |
| Blueprint | Swap ROM | Pay $2 to trade a sellable mod for an unowned mod of the same rarity. Fresh state; tuning is lost. |
| Blueprint | Spare Parts | Receive one random unowned common mod. Needs a free slot. |
| Blueprint | Transplant | Move regular chip/mult tuning to another mod without exceeding +40/+4. Donor loses it. Overdrive cannot transfer. |
| Blacksite | Hot Swap | Pay $4 and give up a common/uncommon mod for a random unowned mod of the next rarity. Fresh state; tuning is lost. |
| Blacksite | Overdrive | Replace tuning with +60 chips/+6 mult. Lose 2 moves per round permanently. Once per mod, twice per run; shared −8 permanent move-bonus floor. |

Tuning is part of the owned mod, displayed on its card and inspection panel. It triggers only when that mod is active; Relay copies tuning with the target's scoring effect. Trading or selling a mod loses its tuning. Trading does not trigger sale hooks; Buyout does. Annex cannot be removed or randomly generated through these trades. Canceling the editor does not spend a pack pick. A successful application consumes one pick and counts as an item use. The pack's dealt tile hand stays unchanged.

## Difficulty and unlocks

| Level | Target multiplier | Starting moves | Rubble | Starting cash |
|---|---:|---:|---|---:|
| Street | ×1 | 24 | Standard | $4 |
| Wired | ×1.15 | 24 | Standard | $4 |
| Hardline | ×1.15 | 22 | Standard | $4 |
| Lockdown | ×1.30 | 22 | One move sooner | $4 |
| Kill Screen | ×1.45 | 20 | One move sooner | $2 |

The table is cumulative, not a list of additional penalties. Boss rules and upgrades still apply. The Hourglass's 16-move base also receives the difficulty move penalty. Rubble never arrives more often than once per two moves. Difficulty is captured when starting the run; changing a later run's selection cannot change the active one.

Beating Ante 8 unlocks the next level. Existing recorded wins give existing players Wired. After Hours and Paper Arcade are available immediately; Amber Terminal, Ice Station and Scarlet Circuit unlock after 1, 3 and 5 total full-run wins. Repeated wins can unlock cosmetics, but each difficulty requires a win on its predecessor. An endless continuation does not count as another run or award another unlock.

Progress uses a separate browser-local profile under the same QA/non-QA storage prefix as run history. No account or server is required. Card definitions are all visible in the searchable Collection, regardless of wins.

## Review status

Source and syntax review only. No automated tests, browser playtests or audio playback were run, per the user's standing instruction. Prices, difficulty penalties and skin layout have not been validated through play.
