# CLICK CLACK BOOM POW

A tiny retro top-down shooter for up to 8 players, right in the browser. You're a mouse cursor. Shoot your friends, paint walls to hide behind, and be the last cursor standing.

**Play:** https://judiction.github.io/TOPDOWN-CRAZY-SHOOTER/

No install and no account. One player hosts, everyone else joins with a 4-letter room code.

## How to play online

1. Type your name and click **HOST GAME**.
2. Share the **room code**, or click **COPY INVITE LINK** and send the link to your friends.
3. Friends type the code and click **JOIN**, or just open your link.
4. Everyone picks a color. Each color can only be taken by one player.
5. The host picks the settings and clicks **START**.

Want to play solo or fill empty seats? The host can **+ ADD BOT** in the lobby.

## Controls

| Action | Key |
|---|---|
| Move | **WASD** (or arrow keys) |
| Aim | Mouse |
| Shoot | Hold **left click** |
| Draw walls | Hold **Space** + hold **left click** |
| Reload | **R** (automatic when empty) |
| Mute | **M** |
| Menu | **ESC** |

## Rules

- **Rounds:** each round starts with a 3, 2, 1, GO! countdown. The last player alive wins the round. The first player to reach the host's number of round wins takes the game.
- **Health:** you die after 10 hits. The host can change this.
- **Ammo:** 60 bullets per magazine. A reload takes 3 seconds.
- **Sudden death:** if the round timer runs out, everyone slowly loses health until one player is left.

### Wall Paint

Your pen holds a limited amount of ink, shown as the bar next to your cursor. Walls stop bullets and players, including yours.

Bullets chip walls away, and the ink **always goes back to whoever drew that wall**, no matter who shot it. Shoot your own walls to refill your pen.

### Powerups

A random powerup appears every 30 seconds. Walk over one to grab it.

| Powerup | Effect |
|---|---|
| **FAT** (orange) | Draw walls twice as thick for 15 seconds |
| **RIC** (red) | Instant reload, and your next 30 bullets ricochet 3 times. Careful, they can hit you too |
| **SMOL** (blue) | Shrink to half size for 15 seconds |
| **DEF** (green) | 12 orbiting spheres that block bullets. Each takes 2 hits |

### Host settings

- Rounds to win
- Round time before sudden death
- Health
- Ink amount
- Powerup frequency (or powerups off)

## Good to know

- **The host's browser runs the game.** If the host closes the tab, the game ends for everyone. Switching tabs is fine.
- Online play connects players directly through [PeerJS](https://peerjs.com/), which is free and needs no server of our own. A few strict networks, such as some school or office networks, may block the connection.
- If the matchmaking server can't be reached, hosting falls back to **offline** mode, so you can still play against bots.

## Run it locally

It's plain HTML and JavaScript with no build step. Serve the folder with any static web server, for example:

```sh
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from disk won't work, because browsers block JavaScript modules on `file://`.

## How it's made

- **Graphics:** canvas rendered at 640×360 and scaled up with crisp pixels. The background is generative art that changes every round, and the font is [Silkscreen](https://fonts.google.com/specimen/Silkscreen).
- **Sound:** 100% code-generated 8-bit audio modeled on the NES sound chip (pulse, triangle and noise channels). A new acid techno loop is generated for every round.
- **Networking:** the host runs the simulation at 60 ticks per second and sends snapshots 20 times a second. Clients predict their own movement so it feels instant.

| File | What it does |
|---|---|
| `js/game.js` | Game rules |
| `js/match.js` | Rounds |
| `js/room.js` | Lobby |
| `js/bots.js` | Bots |
| `js/render.js`, `js/pixel.js` | Drawing |
| `js/background.js` | Background art |
| `js/synth.js`, `js/audio.js` | Sound |
| `js/net.js`, `js/netsync.js` | Networking |
| `js/main.js` | Ties it all together |
