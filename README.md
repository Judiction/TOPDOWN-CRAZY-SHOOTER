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

Every round starts with 3 random powerups on the map, and a new one appears every 30 seconds. Walk over one to grab it.

| Powerup | Effect |
|---|---|
| **FAT** (orange) | Draw walls twice as thick for 15 seconds |
| **RIC** (red) | Instant reload, and your next 30 shots ricochet 3 times (any gun except rockets). Careful, they can hit you too |
| **SMOL** (blue) | Shrink to half size for 15 seconds |
| **DEF** (green) | 12 orbiting spheres that block bullets. Each takes 2 hits |
| **Ghost** | Invisible to everyone else for 8 seconds, and you can walk through walls. You can still be hit, and your bullets still stop at walls |
| **Speed** | Move 60% faster for 10 seconds, leaving a trail |
| **Ink Rush** | Your pen refills instantly. Your walls stay, so ink from them that won't fit in your pen later is lost |
| **Medkit** | Heals 5 health |

**Weapons** replace your pistol until their ammo runs out, then you're back to the pistol.

| Weapon | Effect |
|---|---|
| **Shotgun** (yellow) | Fires 6 pellets in a 30° arc. 60 pellets, so 10 shots |
| **Uzi** (purple) | 90 fast bullets at twice the pistol's speed. They fizzle out after a short distance |
| **Rocket** (gray) | 6 slower rockets that home in on the nearest enemy. A direct hit does 3 damage. The explosion does 2 damage to everyone nearby, you included, and blasts holes in walls |
| **Laser** | One shot. After a short charge, a huge beam cuts through every wall to the edge of the arena and does 7 damage to everyone on the line |
| **Sniper** | 10 very fast shots that punch straight through walls and do 4 damage each. Everyone can see your aim line |
| **Flamer** | A short-range jet of fire that eats through walls and burns anyone in it |
| **Grenade** | 4 grenades that bounce off walls and explode after 1.5 seconds, doing 3 damage to everyone in the blast |

**Map events**

| Powerup | Effect |
|---|---|
| **Eraser** (teal) | Every wall on the map vanishes and everyone's pen refills |
| **Meteors** (dark) | Over the next 10 seconds, 3 meteors strike random spots, one at a time. Get out of the flashing circle before it explodes, or take 5 damage. The picker isn't safe either |
| **Blackout** | For 8 seconds everything goes dark except a small light around your own cursor |
| **Gravity Well** | For 6 seconds a vortex in the middle of the arena pulls in every player and bends every bullet |
| **Paint Bomb** | Splats walls in the picker's color all over the map, using no ink |
| **Mirror World** | The screen flips horizontally or vertically for 8 seconds. Your mouse still aims where you point, but WASD moves you in world directions |
| **Ink Storm** | Lightning strikes and every wall on the map loses about a third of itself. The ink goes back to whoever drew it |

Map events hit everyone, the player who picked them up included.

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
| `js/render.js`, `js/pixel.js`, `js/fx.js`, `js/icons.js` | Drawing, effects and powerup icons |
| `js/background.js` | Background art |
| `js/synth.js`, `js/audio.js` | Sound |
| `js/net.js`, `js/netsync.js` | Networking |
| `js/main.js` | Ties it all together |
