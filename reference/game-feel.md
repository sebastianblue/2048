# Game feel pass — 2048: ANTE 1.5

The approach follows Martin Jonasson and Petri Purho's [Juice It or Lose It](https://www.gdcvault.com/play/1016789/Juice-It-or-Lose) and its [original demonstration](https://www.youtube.com/watch?v=Fy0aCDmgnxg): reinforce a single meaningful action with several short, coordinated responses. Larger events deserve stronger feedback, while the resting board stays still and legible.

- Merges resolve on the moving tiles, with directional squash, spring-back, flecks and an immediate sound impact. Larger/enhanced merges have stronger weight; multi-merges briefly kick the cabinet.
- Mixed tile reactions put their name at the merge and in the score receipt. There are six pairings, each capped at once per move. Catalyst does not duplicate the extra reaction.
- Packs tear open over staggered card reveals, with a short paper-and-clack sound. Pack prices are spent immediately. Back returns from target selection to the same paid choices; Skip discards the contents without refunding anything.
- Clearing a round stamps its result and feeds payout rows into the receipt. Boss clears receive a stronger burst and frame treatment.
- Animation uses presentation-only randomness, separate from the game's seeded random draws. Particle counts are capped and elements are removed after the effect. Reduced-motion mode removes particle and wrapper motion.

## Pack stock — version 1.6

Each shop generates exactly two independent pack offers. Tile and Blueprint each have 46% of each ordinary shop slot, with Oddity at 8%. After a boss, the split is 42% / 42% / 16%. Neither common family is guaranteed, duplicate families are possible, and rerolling the charm/item shop does not replace pack stock.

Sizes are rolled separately: 76% Standard, 20% Large, 4% Deluxe. Standard means 3 choices / 1 pick, Large 5 choices / 1 pick, Deluxe 5 choices / 2 picks. Oddity choice counts stop at its four distinct effects. Each selected option is consumed; a second Deluxe pick must be different. Target selection can be canceled back to the same paid choices. Skipping forfeits any remaining picks.

Tile and Blueprint cost $6 / $8 / $11 by size. Oddity costs $8 / $10 / $14. No automatic replacement or second-purchase price inflation. Print Shop adds one choice to any Tile pack and reduces its cost by $1. Deck-space and item-capacity limits still apply, including between Deluxe picks.

This is an initial tuning pass intended for player feedback. Automated and browser tests were not run for the stock revision, per the user's request.
