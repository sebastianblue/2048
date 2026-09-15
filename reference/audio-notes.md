# Audio notes

The game uses short, edited exports of Apple iLife / Final Cut Pro sound effects found on this computer. The deployed files are intentionally self-contained; the source CAF files remain in the system library.

- `coin.mp3` — iLife Sound Effects / Foley / Coin Drop on Wood
- `cash.mp3` — iLife Sound Effects / Foley / Cash Register
- `ratchet.mp3` — iLife Sound Effects / Foley / Clock Wind Up
- `switch.mp3` — Final Cut Pro Sound Effects / Work:Home / Switch 1
- `starlight.mp3` — iLife Sound Effects / Jingles / Starlight Lounge
- `bossa.mp3` — iLife Sound Effects / Jingles / Bossa Lounger Long
- `swing.mp3` — iLife Sound Effects / Jingles / Swing City Long
- `velvet.mp3` — iLife Sound Effects / Jingles / Red Velvet Long
- `wildcard.mp3` — iLife Sound Effects / Jingles / Wild Card Long
- `headspin.mp3` — iLife Sound Effects / Jingles / Headspin Long
- `highlight.mp3` — iLife Sound Effects / Jingles / Highlight Reel Long
- `fireside.mp3` — iLife Sound Effects / Jingles / Fireside

The jukebox keeps the current buffer playing across title, round, shop, and boss changes. Scene changes ease the music bus and filter instead of restarting it. “Shuffle the house set” picks another track only at a natural track boundary. Round progress gently raises the filter ceiling and bus level, while the boss has a darker low-pass mix and the shop has a lighter, quieter mix. Effects stay on a separate bus so the player can lower or mute them without stopping the music.
