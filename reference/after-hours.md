# After Hours — v2.0.0

An 80s cyberpunk arcade theme and 50 additions to the five existing card families. Seven board fixtures and six tile finishes remain unchanged. The expansion favors new combinations and alternative costs over raising every score bonus.

## Mods — 10

| Mod | Price | Effect |
|---|---:|---|
| Boot ROM | $4 | First scoring move each round: +100 chips. |
| Cassette Loop | $6 | Repeat the previous scoring move's exact merge values for ×1.8 mult; order does not matter. |
| Cross Talk | $5 | +6 mult per merge of two different finishes, maximum +12 per move. |
| Vacuum Tube | $5 | +80 chips with at least eight empty cells. |
| Null Modem | $8 | ×2.2 mult with exactly one enhanced tile on the board. |
| Minimal ROM | $6 | ×1.8 mult with at most 14 deck tiles. |
| Parity Check | $5 | Make both even and odd powers of two in one move for +60 chips. |
| Meter Reader | $7 | Round-end income: $2 per different fixture type activated, maximum $6. |
| Pirate Radio | $6 | Equal odds per scoring activation: +60 chips, +8 mult, or ×1.6 mult. |
| End of Tape | $5 | +12 mult with three or fewer draws left in the pile. |

## Consumables — 10

| Item | Price | Effect |
|---|---:|---|
| Read Head | $2 | Reverse the next three draws. Needs at least two. |
| Service Pass | $4 | Two free rerolls; at most four tickets held. |
| Credit Chip | $3 | Collect $5; at most three redemptions per run. |
| Scrap Cache | $4 | Two different tools from Eraser, Halve, Swap, Shuffle and Jackhammer. Needs one spare slot when held, two for immediate purchase/use. |
| Patch Cable | $3 | Move a finish to a plain board tile; the donor becomes plain. |
| Echo Chip | $5 | Copy a finish to up to two adjacent plain board tiles. |
| Skip Trace | $3 | Move a board tile to the nearest empty corner without merging. |
| Line Driver | $3 | Rotate a row right, wrapping at the edge. Frozen tiles and walls prevent use on that row. |
| Plasma Cutter | $4 | Remove a tile and adjacent loose rubble. Walls remain. |
| Heat Sink | $3 | Double an enhanced board tile of 32 or less, removing its finish. |

The first four can be used directly in shops and open packs. The remaining six require the board. These are temporary board edits; Archive is still the route for filing a resulting tile into the permanent deck.

## Blueprint effects — 10

These are choices inside a paid Blueprint pack. Additional costs are shown before applying.

| Blueprint | Effect and cost |
|---|---|
| Splice | Transfer one finish between two dealt tiles; donor becomes plain. |
| Crosswire | Swap two different finishes, including plain. |
| Downlink | Halve two tiles of 4 or more; retain finishes. |
| Pairing | Lower the larger of two different values to match the smaller. |
| Salvage | Strip up to two finishes for $3 each. |
| Bootstrap | Double one plain 2 or 4. |
| Multicast | Add two plain copies of a tile of 8 or less; needs two free deck slots. |
| Reboot | Reset two eligible tiles to plain 2s. |
| Service Window | Pay $2 for four moves next round; no more than eight may already be banked. |
| Bypass Lead | Unlock a fourth fixture slot for a permanent loss of two moves per round. |

## Blacksite effects — 10

Blacksite replaces the displayed Oddity name. These packs remain rare and share the same two shop pack slots as Tile and Blueprint packs.

| Effect | Effect and additional cost |
|---|---|
| Mirror ROM | Pay $4 to copy a template of 32 or less over two other tiles, including its finish. |
| Black Ice | Give three tiles Iron; permanently lose two moves per round. Maximum two uses. |
| Glass Cannon | Quadruple a tile of 16 or less and give it Prism; permanently lose one move per round. Maximum three uses. |
| Counterfeit | Pay $5 to give two tiles Brass. |
| Loaded Dice | Pay $4 to give three tiles Odds. |
| Memory Hole | Pay $3 to destroy three tiles; retain at least 12. |
| Mass Driver | Pay $2 to fuse two equal tiles of 32 or less into one plain doubled tile; retain at least 12. |
| Ghost Image | Pay $4 to add two exact copies of a tile of 16 or less; needs two free deck slots. |
| Dead Drop | Pay $5 and destroy an enhanced tile to unlock the sixth mod slot; retain at least 12 tiles. |
| Neon Bloom | Pay $3 to turn two equal plain tiles of 16 or less into Kick and Plus, setting up Overprint. |

All tile selections use the fixed eight-tile hand dealt when opening the pack. New copies do not join that hand. Deluxe picks and canceled selections cannot redraw it. A total permanent move penalty below −8 is blocked. Overclock can offset those costs, but does not restore per-card use allowances.

## Firmware — 10

Each new firmware can be installed once per run and takes no mod or item slot.

| Firmware | Price | Effect |
|---|---:|---|
| Wide Bus | $7 | Preview five draws instead of three. |
| Spare Battery | $7 | Clocks grant eight moves instead of six. |
| Thermal Sleeve | $9 | Add one move to rubble intervals, including The Drought. |
| Copper Traces | $10 | +5 chips per actual fixture activation; priming does not count. |
| Field Service | $12 | One extra use per round for Toll Booth, Copy Desk, Inkwell and Trapdoor. |
| Bulk License | $9 | One extra choice in Blueprint and Blacksite packs; same number of picks. |
| Price Scanner | $7 | Shop consumables cost $1 less, minimum $1, including Buy & use. |
| Signal Amp | $8 | First scoring move each round: +40 chips. |
| Sorting Buffer | $12 | Every reshuffle begins with a matching-value pair if available. Finishes may differ. |
| Fuse Link | $10 | Save the first Prism tile that would shatter each round, for the whole scoring move. |

## Interactions and limits

- Extension Lead and Bypass Lead share a four-fixture cap. Sixth Slot and Dead Drop share a six-mod cap. A previously offered firmware cannot be purchased after another route reaches its cap.
- Side Pocket and Deep Pockets share the five-item cap. Reroll tickets share a four-ticket cap.
- Signal Amp and Fuse Link reset each round and participate in Undo. Field Service uses existing fixture counters, also restored by Undo.
- Sorting Buffer rearranges only the upcoming pile after a real reshuffle; it never duplicates cards or alters the deck.
- Copper Traces only rewards effects that actually fire, not exhausted fixtures or a primed Switchboard. Receipt lines identify its bonus separately.
- No refunds on opened packs. Exactly two pack offers per shop; rerolls leave them alone. Extra choices do not add picks.
- Existing audio, restrained merge animations, music continuity, and reduced-motion behavior are preserved.

## Review status

Source review and syntax checks only. No automated tests, browser playtests, or audio playback for this release, per the user's instruction. Prices, caps and synergies are design decisions awaiting playtest evidence.
