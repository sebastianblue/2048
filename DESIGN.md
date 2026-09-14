# Design and balance notes

## Research translated into rules

1. **A familiar core with comfortable repetition.** LocalThunk's [Solitaire essay](https://localthunk.com/blog/solitaire) describes familiar solo play and progression that guides experimentation. Here, standard 2048 movement remains intact. Alternate kits open after clearing rounds 3 and 6; higher stakes unlock after a win. There are no permanent score bonuses to grind.
2. **Strong synergies and varied challenges.** In [Mega Crit's designer interview](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-), Anthony Giovannetti discusses combos, layered risk/reward and enemies that test different strategies. The game uses five relic slots, conditional chips and multipliers, economy decisions and four announced boss rules. Shop rerolls and guaranteed workshop upgrades keep random offers from being the only route forward. Small Change stops appearing in shops before ante three, where its small-tile condition can no longer trigger.
3. **Metrics plus human feedback.** Mega Crit's [2019 GDC balance presentation](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf) emphasizes iteration and interpreting metrics alongside playtests. Automated policies calibrate the initial curve. Actual playtest notes, purchase choices and loss states should drive future changes.

These are design interpretations, not a claim that the sources endorse this particular game.

## Run structure

Twelve rounds in four antes. A round has 24 moves in ante one, then 26. Each board starts with three pairs worth 1×, 2× and 4× the ante's spawning base (2, 4, 8, 16). At least one pair is available for planning; the target rises faster than tile values alone. Fresh boards make per-round targets measurable and prevent one early board lock from determining the entire run. Persistent relics, cash, powerups and scaling growth carry the strategy forward.

| Round | Target | Boss |
|---|---:|---|
| 1 | 160 | — |
| 2 | 280 | — |
| 3 | 400 | The Toll: small merges give half base chips |
| 4 | 1,000 | — |
| 5 | 1,550 | — |
| 6 | 2,300 | High Tide: extra spawn every third slide |
| 7 | 3,600 | — |
| 8 | 5,200 | — |
| 9 | 7,400 | The Pendulum: repeating a direction halves score |
| 10 | 10,500 | — |
| 11 | 14,500 | — |
| 12 | 17,000 | The House: all score ×0.7 |

## Score and economy

Merged tile values plus flat relic chips form the chip total. The base streak adds +0.15× per preceding consecutive scoring slide, capped at +0.75×. Echo Chamber adds to that multiplier, then other bonuses and workshop levels multiply it. Round once at the end. A non-merging slide resets the streak. Invalid directions spend no moves or RNG. Powerups spend no moves; promotion does not award points.

Normal, large and boss blinds pay $5, $6 and $8. Early finishes pay $1 per five remaining moves, capped at $3. Savings pay $1 per $5 held before payout, capped at $3. Relics cost $5–8, consumables $3–4. Rerolls start at $2 and rise by $1 within a shop. Workshop upgrades start at $6 and increase by $4, up to six upgrades. Selling returns half the listed price, rounded down. Limited inventory creates an opportunity cost for every purchase.

## Calibration results

Final curve, 500 seeds per policy (1,500 runs total):

| Policy | Clear round 3 | Clear round 6 | Clear round 9 | Win all 12 |
|---|---:|---:|---:|---:|
| Random valid directions, sensible purchases | 76% | 63% | 24% | 20% |
| Greedy scoring plus board-space heuristic, sensible purchases | 96% | 92% | 75% | 42% |
| Same deliberate movement, no purchases | 45% | 0% | 0% | 0% |

The initial curve let 96% of the deliberate-policy runs win. Targets were increased and spread over the later rounds. The final opening stays accessible, purchases materially matter and later challenges separate the tested policies.

**Limits:** These are reproducible policy results, not human win rates. The shop policy favors a fixed list of relics and does not represent all viable builds. The player makes only a one-slide heuristic evaluation and uses a limited recovery policy; it does not demonstrate optimal play. These results cannot prove that every relic is equally useful, every seed is winnable or the game is fun. Human logs should identify repetitive choices, unappealing relics, opaque score interactions and abrupt difficulty jumps. In particular, late-game multiplier combinations deserve further observation.

## Browser verification

Confirmed board rendering, a legal slide via WebMCP, invalid-direction rejection, in-game Hammer targeting, preservation across refresh, first-round completion, relic purchase, workshop upgrade, affordability restrictions, transition into the next round, feedback creation and separate test-session storage. At a 390 px viewport the board measures 354 px with no horizontal overflow. No browser warnings or errors were observed. Local event delivery returned HTTP 204, the saved JSONL parsed correctly and a cross-origin request returned 403. Core winning and losing states are additionally tested through the engine.
