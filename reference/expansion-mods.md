# Night-market mods

Ten additions to the existing mod pool. Prices and caps are design choices, not playtest findings.

| Mod | Price | Effect | Build it supports |
| --- | ---: | --- | --- |
| Boot ROM | $4 | +100 chips on the first scoring move of each round | A carefully prepared opener; Carbon Press; short rounds |
| Cassette Loop | $6 | ×1.8 mult when the exact list of merged values repeats across scoring moves | Consistent draws, small tiles, a trimmed deck |
| Cross Talk | $5 | +6 mult per merge with two different finishes, capped at +12 | Mixed finishes and their reactions |
| Vacuum Tube | $5 | +80 chips with eight or more empty cells | A spacious board, Trapdoor, removal tools |
| Null Modem | $8 | ×2.2 mult with exactly one enhanced tile on the board | A single anchor tile; deliberate finish removal |
| Minimal ROM | $6 | ×1.8 mult with at most 14 tiles in the deck | Paying to slim the starting 20-tile deck |
| Parity Check | $5 | +60 chips for making both even and odd powers of two in one move | Mixed values and several merges per move |
| Meter Reader | $7 | At round end, $2 per different fixture type activated, capped at $6 | Installing and actively using several fixtures |
| Pirate Radio | $6 | Equal odds of +60 chips, +8 mult, or ×1.6 mult on each scoring activation | Bounded variance with no losing roll |
| End of Tape | $5 | +12 mult when the draw pile has at most three tiles left | Draw-cycle timing and a small deck |

These use existing hooks only. Boot ROM and Cassette Loop allow Relay to copy their scoring effect without consuming or advancing their stored state twice. Meter Reader only records real fixture activations; its payout runs once through the existing round-end hook. Pirate Radio makes a separate seeded roll for each activation, including a copied activation. No new tile finishes, fixtures, card families, or unbounded growth loops are introduced.

Static syntax check completed. No tests, browser interaction, or audio playback performed.
