# Audio notes

Legacy Apple iLife / Final Cut Pro samples remain in the assets folder for provenance; gameplay now uses procedural physical sounds with controlled envelopes. Music includes the house cues and four Sebastian Blue songs authorized for this game. The deployed files are intentionally self-contained; the source CAF files remain in the system library.

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
- `blue_mary.mp3` — Sebastian Blue / `Mary Margaret Bounce 3 (mastered)` from the local Music library
- `blue_nitemare.mp3` — Sebastian Blue / `Nitemare` from the local Music library
- `blue_not_afraid.mp3` — Sebastian Blue / `Not Afraid` from the local Music library
- `blue_flores.mp3` — Sebastian Blue ft. Juliana Aquino / `Flores Árvores` from the local Music library, converted to MP3 for the browser

The jukebox keeps the current buffer playing across title, round, shop, and boss changes. Scene changes ease the music bus and filter instead of restarting it. “Shuffle the house set” picks another track only at a natural track boundary; short cues loop to a minimum 90-second stay before changing. Round progress gently raises the filter ceiling and bus level, while the boss has a darker low-pass mix and the shop has a lighter, quieter mix. Effects stay on a separate bus so the player can lower or mute them without stopping the music.


## Level calibration and transport — September 15, 2026

All 12 deployed MP3 files were measured silently with FFmpeg EBU R128 loudnorm. Music is matched to **-20 LUFS integrated** before the room filter, music slider, and master bus. The original library files were not altered. The Nitemare game copy needed dynamic leveling: its original -26.17 LUFS had peaks at -0.39 dBTP, leaving insufficient headroom for a simple gain increase. That copy measured -19.75 LUFS / -2.14 dBTP after encoding, then receives -0.25 dB in the player. Every other file uses only the constant gain below.

| Track | File LUFS | File dBTP | Player gain dB | Matched LUFS |
|---|---:|---:|---:|---:|
| starlight | -13.68 | 0.47 | -6.32 | -20.00 |
| bossa | -14.16 | 1.37 | -5.84 | -20.00 |
| swing | -17.65 | -0.19 | -2.35 | -20.00 |
| velvet | -15.24 | -0.21 | -4.76 | -20.00 |
| wildcard | -13.15 | 0.38 | -6.85 | -20.00 |
| fireside | -16.64 | -0.36 | -3.36 | -20.00 |
| headspin | -12.42 | -0.03 | -7.58 | -20.00 |
| highlight | -15.06 | -0.29 | -4.94 | -20.00 |
| blue_mary | -12.93 | 0.52 | -7.07 | -20.00 |
| blue_nitemare | -19.75 | -2.14 | -0.25 | -20.00 |
| blue_not_afraid | -19.99 | -2.17 | -0.01 | -20.00 |
| blue_flores | -21.90 | -4.14 | +1.90 | -20.00 |

The next song is fetched 15 seconds before the crossfade. If decoding takes longer, the current source keeps looping until the next one is ready. Source envelopes share the same scheduled boundary. Screen changes alter tone and future selection only. Pause and a hidden tab suspend the audio clock, so resuming preserves the song position. A manually selected track loops continuously. Decoded music caches retain only active/current/next songs; effect caches are bounded at 48 small mono buffers.

### Effects

Effects are procedurally rendered from short modal bodies, filtered surface noise, and shaped attacks. Merge impact is a low wooden thock with a falling attack and increases in weight with the number and value of merges. Score is a lighter pitched finish; reactions use a spring resonance; packs tear then clack; upgrades and payouts have a longer resonant bloom. No legacy cash/coin clip is triggered. Effects use a separate volume bus, measured RMS targets, a -10 dBFS source peak ceiling, and a master safety compressor. Quiet routine actions have lower RMS than rewards. Mute/pause/hidden-tab stops effect voices immediately; there are no delayed arpeggio timers to burst out after unmuting.

Measured at source, before the effect slider/master:

| Effect | RMS dBFS | Peak dBFS |
|---|---:|---:|
| click | -30.00 | -21.06 |
| slide | -31.00 | -19.13 |
| bump | -28.00 | -19.00 |
| score | -24.46 | -11.29 |
| merge | -25.00 | -20.51 |
| pack | -27.91 | -10.00 |
| buy | -26.00 | -15.06 |
| bank | -25.00 | -11.74 |
| shuffle | -29.00 | -13.18 |
| rubble | -28.00 | -16.69 |
| boss | -28.00 | -13.16 |
| loss | -29.00 | -13.87 |
| upgrade | -25.00 | -12.04 |
| reaction | -25.00 | -11.58 |
| win | -25.37 | -10.00 |

Validation: `node --test tests/audio.test.js` checks uninterrupted scene transitions, prefetch timing, slow-load fallback, transport position across pause and visibility, manual looping, no unmute burst, measured effect RMS/peaks, and increased multi-merge energy. All testing was silent; perceived timbre still benefits from the user's listening feedback.
