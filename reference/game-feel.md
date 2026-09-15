# Game feel pass — 2048: ANTE 1.5

The approach follows Martin Jonasson and Petri Purho's [Juice It or Lose It](https://www.gdcvault.com/play/1016789/Juice-It-or-Lose) and its [original demonstration](https://www.youtube.com/watch?v=Fy0aCDmgnxg): reinforce a single meaningful action with several short, coordinated responses. Larger events deserve stronger feedback, while the resting board stays still and legible.

- Merges resolve on the moving tiles, with directional squash, spring-back, flecks and an immediate sound impact. Larger/enhanced merges have stronger weight; multi-merges briefly kick the cabinet.
- Mixed tile reactions put their name at the merge and in the score receipt. There are six pairings, each capped at once per move. Catalyst does not duplicate the extra reaction.
- Packs tear open over staggered card reveals, with a short paper-and-clack sound. Pack prices are spent immediately. Back returns from target selection to the same paid choices; Skip discards the contents without refunding anything.
- Clearing a round stamps its result and feeds payout rows into the receipt. Boss clears receive a stronger burst and frame treatment.
- Animation uses presentation-only randomness, separate from the game's seeded random draws. Particle counts are capped and elements are removed after the effect. Reduced-motion mode removes particle and wrapper motion.

Blueprint stock costs $6 and includes four deck jobs plus Dividend, Supply Parcel, Side Pocket and Ticket Roll. Oddity stock costs $8 and appears in 16% of ordinary shops and 33% of boss shops. This is an initial tuning pass intended for further player feedback, not a claim of simulation-proven balance.
