# Board workshop — 1.8.0

Fixtures add a second kind of investment: improve a location rather than a tile. A fixture stays put while tiles slide over it. One fixture can occupy a cell, with three installed at a time, or four after buying Extension Lead for $10. They persist for the run.

## Acquisition and costs

Each shop has one fixed fixture offer, priced from $6 to $10. It competes with charms and packs for cash. Rerolling the shop never replaces this offer. Blueprint packs can instead reveal one of seven named fixture plans. Installing a plan spends one pack pick; canceling placement keeps the same pack, remaining picks and dealt tile hand. Pack prices remain nonrefundable. There are still exactly two pack offers per shop.

Installation is paid when a cell is confirmed. Replacing an existing fixture destroys it with no refund. Wrench costs $3 and relocates one fixture to an unoccupied fixture slot; it preserves charge, direction memory and uses. It never moves the tiles sitting on those cells.

## Effects and guardrails

- Press: +20 chips whenever a merge lands there.
- Flywheel: banks 10 chips on each valid move that does not merge there, up to 60; the next hit collects the bank. Invalid slides give no charge.
- Toll Booth: pays $1 for each of its first two hits per round. At most $2 per installed booth per round.
- Copy Desk: once per round, copies a merge result of 32 or less into a random empty cell. The copy is plain and joins the current board, never the permanent deck. It cannot merge or trigger a fixture during the same scoring event.
- Inkwell: once per round, gives a plain merge result a random finish. That finish does not retroactively score on the merge that created it.
- Trapdoor: a merge of at least 16 gives ×1.6 mult and removes the result. Twice per round. It frees space but spends tile value that could have built a larger merge.
- Switchboard: the first hit records its direction. Later hits from a different direction award +4 mult and update that direction. Repeating the same direction awards nothing.

All fixture uses, charge and direction memory reset at the start of each round. Moving a fixture does not reset anything. An exhausted fixture cannot trigger Foreman, Live Circuit or Hot Wire. Multiple fixtures may activate in one move, but each has only one merge landing on its cell.

Effects resolve after tile finishes and mixed-finish reactions, then before charms. Copy Desk adds and Trapdoor removes tiles before empty-space charms evaluate the board. Boss walls and frozen tiles still obey ordinary movement restrictions. The Plain disables tile finishes, not board machinery.

## Charms and tools

Foreman adds 3 mult per fixture activated in a move. Live Circuit gives ×2 mult if at least two activate. Field Notes gains 2 mult for each installation made while owned, including paid replacements, up to +12; moving fixtures grants nothing.

Compass gives +6 mult when consecutive scoring moves alternate horizontal and vertical. Clean Cut adds 20 chips per plain/plain merge, capped at 60. Surveyor gives +8 mult if merges cover at least two rows and two columns. These three are useful without buying a fixture.

Grease ($3) pauses the rubble countdown for four valid moves. Hot Wire ($3) adds 20 chips on each of the next three moves that activates at least one fixture. Both can be prepared in the shop, carry unused charges between rounds and cannot be used again while already fully charged. Hot Wire requires an installed fixture.

Stack ($2) sends one of the next three pile entries to the bottom without changing any tile, rerolling a draw or duplicating a card. Choosing or canceling its preview never changes the pile. It works during rounds or in the shop; it is unavailable inside a pack, where permanent deck edits reshuffle the pile.

## Initial tuning

The round targets are unchanged. Fixed slot limits, positional requirements, once- or twice-per-round triggers and cash prices are the initial constraints, not evidence of measured balance. These additions have not been playtested under the user's current no-testing instruction. Run exports now include installed fixtures at round start, fixture activations per move and installation/relocation history for later review.
