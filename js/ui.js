// Menus (title, lobby, pause, winner screen) as plain HTML laid over the canvas.
// Sizes use --px (one game pixel in CSS px, set by initCanvas) so the menus match the pixel art.

import { COLORS, SETTING_DEFS, MAX_PLAYERS, NAME_MAX, teamsOf, teamCount } from './settings.js';
import { canStart } from './room.js';
import { mountLogo } from './logo.js';
import { powerupBadge } from './render.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// handlers: onHost(name), onJoin(name, code), onHowTo(), onAction(action), onStart(), onLeave(), onCopy(),
//           onPlayAgain(), onMenu(), onResume(), onEndMatch(), onClick()
export function createUI(root, handlers) {
  let screen = null;

  function show(node, name) {
    root.replaceChildren(node);
    screen = name;
    // Any button click gets a little UI blip.
    node.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.disabled) handlers.onClick?.();
      b?.blur();
    });
  }

  function hide() {
    root.replaceChildren();
    screen = null;
  }

  // ---- title ----

  function showTitle({ name = '', code = '', message = '' } = {}) {
    const n = el(`
      <div class="title-screen">
        <canvas class="logo-canvas" aria-label="Doodle Duel"></canvas>
        <p class="tagline">DRAW WALLS <i>·</i> SHOOT CURSORS <i>·</i> LAST ONE CLICKING WINS</p>
        <div class="panel title">
          <label class="field">YOUR NAME <input id="ui-name" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off"></label>
          <div class="start-grid">
            <span></span>
            <input id="ui-code" maxlength="8" placeholder="ENTER ROOM CODE" spellcheck="false" autocomplete="off">
            <button data-act="host" class="big">HOST GAME</button>
            <button data-act="join" class="big green">JOIN GAME</button>
          </div>
          <button data-act="howto" class="howto">HOW TO PLAY</button>
          <p class="msg" id="ui-msg"></p>
        </div>
        <p class="help">WASD MOVE · MOUSE AIM · CLICK SHOOT · R RELOAD · SPACE + CLICK DRAW · M MUTE · ESC MENU</p>
      </div>`);
    mountLogo(n.querySelector('.logo-canvas'));
    const nameInput = n.querySelector('#ui-name');
    const codeInput = n.querySelector('#ui-code');
    nameInput.value = name;
    codeInput.value = code;
    n.querySelector('#ui-msg').textContent = message;
    n.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'host') handlers.onHost(nameInput.value);
      if (act === 'join') handlers.onJoin(nameInput.value, codeInput.value);
      if (act === 'howto') handlers.onHowTo();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlers.onHost(nameInput.value);
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlers.onJoin(nameInput.value, codeInput.value);
    });
    show(n, 'title');
    if (!name) nameInput.focus();
  }

  function setMessage(text) {
    const m = root.querySelector('#ui-msg');
    if (m) m.textContent = text;
  }

  // ---- lobby ----

  function showLobby(room, localId) {
    const n = el(`
      <div class="lobby-screen">
        <div class="panel lobby">
          <div class="lobby-body">
          <div class="lobby-head">
            <h2>LOBBY</h2>
            <div class="code">ROOM <b id="ui-room"></b></div>
          </div>
          <button data-act="copy" id="ui-copy" class="small">COPY INVITE LINK</button>
          <h3>PLAYERS <span id="ui-count"></span></h3>
          <ul id="ui-players" class="players"></ul>
          <div id="ui-botpick" class="botpick" hidden>
            <h3>COLOR FOR <b id="ui-botname"></b></h3>
            <div class="colors">
              ${COLORS.map((c) => `<button class="swatch" data-botcolor="${c}" style="--c:${c}" title="${c}"></button>`).join('')}
            </div>
          </div>
          <button data-act="addBot" id="ui-addbot" class="small">+ ADD BOT</button>
          <div class="me-row">
            <div>
              <h3>YOUR NAME</h3>
              <input id="ui-lname" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off">
            </div>
          </div>
          <h3>YOUR COLOR <span id="ui-teamwarn" class="team-warn" hidden>MATCHING COLORS WILL BE IN THE SAME TEAM!</span></h3>
          <div id="ui-colors" class="colors">
            ${COLORS.map((c) => `<button class="swatch" data-color="${c}" style="--c:${c}" title="${c}"></button>`).join('')}
          </div>
          <h3>SETTINGS</h3>
          <div id="ui-settings" class="settings"></div>
          </div>
          <p id="ui-status" class="status"></p>
          <div class="lobby-foot">
            <button data-act="leave">LEAVE</button>
            <button data-act="start" id="ui-start" class="big">START</button>
          </div>
        </div>
        <p class="playground-hint">MOVE, SHOOT AND DRAW WHILE YOU WAIT!<br><span>NOBODY GETS HURT IN HERE</span></p>
      </div>`);
    n.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.color) handlers.onAction({ type: 'color', color: d.color });
      else if (d.act === 'pickBot') {
        botPicking = botPicking === d.id ? null : d.id;       // click the dot again to close
        updateLobby(lastRoom, lastLocalId);
      } else if (d.botcolor) {
        handlers.onAction({ type: 'botColor', id: botPicking, color: d.botcolor });
        botPicking = null;
        updateLobby(lastRoom, lastLocalId);
      }
      else if (d.act === 'addBot') handlers.onAction({ type: 'addBot' });
      else if (d.act === 'removeBot') handlers.onAction({ type: 'removeBot', id: d.id });
      else if (d.act === 'setting') {
        const def = SETTING_DEFS.find((s) => s.key === d.key);
        const i = def.options.indexOf(lastRoom.settings[d.key]);
        const next = def.options[(i + Number(d.dir) + def.options.length) % def.options.length];
        handlers.onAction({ type: 'setting', key: d.key, value: next });
      } else if (d.act === 'start') handlers.onStart();
      else if (d.act === 'copy') handlers.onCopy();
      else if (d.act === 'leave') handlers.onLeave();
    });
    n.querySelector('#ui-lname').addEventListener('input', (e) => handlers.onAction({ type: 'name', name: e.target.value }));
    show(n, 'lobby');
    updateLobby(room, localId);
  }

  let lastRoom = null;

  let lastLocalId = null;
  let botPicking = null;                // id of the bot whose color picker is open (host only)

  function updateLobby(room, localId) {
    lastRoom = room;
    lastLocalId = localId;
    if (screen !== 'lobby') return;
    const isHost = room.hostId === localId;
    const me = room.players.find((p) => p.id === localId);
    const $ = (sel) => root.querySelector(sel);

    $('#ui-room').textContent = room.code || 'CONNECTING...';
    $('#ui-copy').hidden = !room.code || room.code === 'OFFLINE';
    $('#ui-count').textContent = `${room.players.length}/${MAX_PLAYERS}`;
    $('#ui-players').innerHTML = room.players
      .map((p) => {
        const tags = [p.id === room.hostId && 'HOST', p.isBot && 'BOT', p.id === localId && 'YOU', p.waiting && 'NEXT GAME']
          .filter(Boolean).map((t) => `<i>${t}</i>`).join('');
        const kick = isHost && p.isBot && !room.inMatch ? `<button class="x" data-act="removeBot" data-id="${esc(p.id)}">X</button>` : '';
        // The host can recolor bots by clicking their color box.
        const dot = isHost && p.isBot && !room.inMatch
          ? `<button class="dot pick${botPicking === p.id ? ' open' : ''}" data-act="pickBot" data-id="${esc(p.id)}" style="--c:${p.color}" title="Change bot color"></button>`
          : `<span class="dot" style="--c:${p.color}"></span>`;
        return `<li>${dot}<span class="pname">${esc(p.name)}</span>${tags}${kick}</li>`;
      })
      .join('');

    // Every color can be picked; ones someone else already has get a little marker (= you'd team up).
    const used = new Set(room.players.filter((p) => p.id !== localId).map((p) => p.color));
    for (const b of root.querySelectorAll('#ui-colors .swatch')) {
      const c = b.dataset.color;
      b.classList.toggle('mine', me?.color === c);
      b.classList.toggle('used', used.has(c));
    }
    $('#ui-teamwarn').hidden = teamCount(room.players) === room.players.length;

    const bot = isHost && !room.inMatch && room.players.find((p) => p.id === botPicking && p.isBot);
    if (!bot) botPicking = null;
    $('#ui-botpick').hidden = !bot;
    if (bot) {
      $('#ui-botname').textContent = bot.name;
      for (const b of root.querySelectorAll('#ui-botpick .swatch')) b.classList.toggle('mine', b.dataset.botcolor === bot.color);
    }

    const nameInput = $('#ui-lname');
    if (me && document.activeElement !== nameInput) nameInput.value = me.name;

    $('#ui-settings').innerHTML = SETTING_DEFS.map((def) => {
      const value = esc(def.format(room.settings[def.key]));
      const control = isHost
        ? `<button class="arrow" data-act="setting" data-key="${def.key}" data-dir="-1">&lt;</button><b>${value}</b><button class="arrow" data-act="setting" data-key="${def.key}" data-dir="1">&gt;</button>`
        : `<b>${value}</b>`;
      return `<div class="setting"><span>${def.label}</span><span class="ctl">${control}</span></div>`;
    }).join('');

    $('#ui-addbot').hidden = !isHost || room.players.length >= MAX_PLAYERS || room.inMatch;
    const start = $('#ui-start');
    start.hidden = !isHost;
    start.disabled = !canStart(room);
    $('#ui-status').textContent = !isHost
      ? room.inMatch ? 'GAME IN PROGRESS. YOU PLAY IN THE NEXT ONE!' : 'WAITING FOR THE HOST TO START'
      : room.players.length < 2
        ? 'ADD A BOT OR WAIT FOR FRIENDS'
        : teamCount(room.players) < 2
          ? 'YOU NEED AT LEAST 2 TEAMS (DIFFERENT COLORS)'
          : '';
  }

  // ---- how to play: instructions on the right, a private practice arena behind ----

  const HOWTO_POWERUPS = [
    ['PLAYER BOOSTS', [
      ['fat', 'FAT WALLS', 'Draw walls twice as thick'],
      ['ricochet', 'RICOCHET', 'Shots bounce off walls (and can hit you!)'],
      ['small', 'GET SMALL', 'Half size, harder to hit'],
      ['defense', 'DEFENSE BALLS', 'Orbiting spheres block bullets'],
      ['ghost', 'GHOST', 'Invisible, walk through walls'],
      ['speed', 'SPEED BOOTS', 'Move a lot faster'],
      ['inkrush', 'INK RUSH', 'Refill your pen'],
      ['medkit', 'MEDKIT', 'Heal +5 HP'],
    ]],
    ['WEAPONS', [
      ['shotgun', 'SHOTGUN', '6 pellets per shot'],
      ['uzi', 'UZI', 'Fast, short-range spray'],
      ['rocket', 'ROCKETS', 'Homing, they explode'],
      ['laser', 'LASER', 'One huge beam through everything'],
      ['sniper', 'SNIPER', 'Shoots through walls'],
      ['flamer', 'FLAMETHROWER', 'Short fire jet, melts walls'],
      ['grenade', 'GRENADES', 'Bounce, then boom'],
    ]],
    ['MAP EVENTS (HIT EVERYONE)', [
      ['eraser', 'ERASER', 'All walls vanish, pens refill'],
      ['meteor', 'METEORS', 'Get out of the flashing circles'],
      ['blackout', 'BLACKOUT', 'Lights out'],
      ['gravity', 'GRAVITY WELL', 'Everything gets sucked in'],
      ['paintbomb', 'PAINT BOMB', 'Free walls splat everywhere'],
      ['mirror', 'MIRROR WORLD', 'The screen flips'],
      ['inkstorm', 'INK STORM', 'Walls crumble'],
    ]],
  ];

  function showHowTo() {
    const k = (key) => `<kbd>${key}</kbd>`;
    const n = el(`
      <div class="howto-screen">
        <p class="practice-hint">PRACTICE HERE! TRY MOVING, SHOOTING AND DRAWING</p>
        <div class="panel howto">
          <h2>HOW TO PLAY</h2>
          <div class="howto-scroll">
            <ul class="rules">
              <li>${k('W')}${k('A')}${k('S')}${k('D')}<span>YOU ARE A CURSOR. MOVE AROUND.</span></li>
              <li>${k('MOUSE')}<span>AIM. HOLD ${k('CLICK')} TO SHOOT. ${k('R')} RELOADS.</span></li>
              <li>${k('SPACE')}+${k('CLICK')}<span>DRAW WALLS. THEY BLOCK BULLETS AND PLAYERS.</span></li>
              <li><i class="inkbar"></i><span>DRAWING USES INK (THE BAR NEXT TO YOU). SHOOT WALLS TO GET INK BACK: IT ALWAYS RETURNS TO WHOEVER DREW THEM.</span></li>
              <li><i class="crown">★</i><span>LAST CURSOR STANDING WINS THE ROUND. KILLS HEAL +5 HP. DYING CURSORS EXPLODE!</span></li>
              <li><i class="crown">◆</i><span>WALK OVER POWERUPS TO GRAB THEM:</span></li>
            </ul>
            ${HOWTO_POWERUPS.map(([title, list]) => `
              <h3>${title}</h3>
              <ul class="pu-list">
                ${list.map(([type, name, desc]) => `<li><span class="badge" data-type="${type}"></span><b>${name}</b><span>${esc(desc.toUpperCase())}</span></li>`).join('')}
              </ul>`).join('')}
          </div>
          <button data-act="back" class="big">BACK TO MENU</button>
        </div>
      </div>`);
    for (const slot of n.querySelectorAll('.badge')) {
      const badge = powerupBadge(slot.dataset.type);
      const c = document.createElement('canvas');
      c.width = badge.width;
      c.height = badge.height;
      c.getContext('2d').drawImage(badge, 0, 0);
      slot.appendChild(c);
    }
    n.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')?.dataset.act === 'back') handlers.onBack();
    });
    show(n, 'howto');
    autoScroll(n.querySelector('.howto-scroll'));
  }

  // After a few seconds, slowly scroll the instructions so it's obvious there's more below.
  // Stops for good as soon as the reader scrolls, clicks or touches it themselves.
  function autoScroll(box) {
    const DELAY = 5000, SPEED = 18;     // ms before it starts, CSS px per second
    let stopped = false, last = null, pos = 0;
    const stop = () => (stopped = true);
    for (const ev of ['wheel', 'pointerdown', 'touchstart', 'keydown']) box.addEventListener(ev, stop, { passive: true });
    setTimeout(() => {
      pos = box.scrollTop;
      const tick = (now) => {
        if (stopped || !box.isConnected) return;
        if (last !== null) pos += (SPEED * (now - last)) / 1000;
        last = now;
        box.scrollTop = pos;
        if (box.scrollTop + box.clientHeight < box.scrollHeight - 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, DELAY);
  }

  // ---- in-match menu (ESC) and winner screen ----

  function showPause(isHost) {
    const n = el(`
      <div class="panel pause">
        <h2>MENU</h2>
        <p class="help">THE GAME KEEPS RUNNING</p>
        <button data-act="resume" class="big">RESUME</button>
        <button data-act="end">${isHost ? 'END GAME' : 'LEAVE GAME'}</button>
      </div>`);
    n.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'resume') handlers.onResume();
      if (act === 'end') handlers.onEndMatch();
    });
    show(n, 'pause');
  }

  function showGameOver(match, isHost) {
    const teams = teamsOf(match.roster);
    const winner = teams.find((t) => t.key === match.winner);
    const rows = [...teams]
      .sort((a, b) => (match.scores[b.key] ?? 0) - (match.scores[a.key] ?? 0))
      .map((t) => `<li><span class="dot" style="--c:${t.color}"></span><span class="pname">${esc(t.name)}</span><b>${match.scores[t.key] ?? 0}</b></li>`)
      .join('');
    const n = el(`
      <div class="panel gameover">
        <h1 class="winner" style="color:${winner?.color ?? '#fff'}">${esc(winner?.name ?? '???')}</h1>
        <h2>${winner && winner.members.length > 1 ? 'WIN THE GAME!' : 'WINS THE GAME!'}</h2>
        <ul class="players scores">${rows}</ul>
        ${isHost
          ? '<button data-act="again" class="big">PLAY AGAIN</button><button data-act="menu">MAIN MENU</button>'
          : '<p class="help">WAITING FOR THE HOST...</p><button data-act="menu">LEAVE</button>'}
      </div>`);
    n.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'again') handlers.onPlayAgain();
      if (act === 'menu') handlers.onMenu();
    });
    show(n, 'gameover');
  }

  // Short message in the lobby status line (e.g. "LINK COPIED").
  function flashStatus(text) {
    const el = root.querySelector('#ui-status');
    if (!el) return;
    el.textContent = text;
    setTimeout(() => lastRoom && updateLobby(lastRoom, lastLocalId), 1500);
  }

  return { showTitle, showHowTo, setMessage, flashStatus, showLobby, updateLobby, showPause, showGameOver, hide, get screen() { return screen; } };
}
