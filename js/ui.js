// Menus (title, lobby, pause, winner screen) as plain HTML laid over the canvas.
// Sizes use --px (one game pixel in CSS px, set by initCanvas) so the menus match the pixel art.

import { COLORS, SETTING_DEFS, MAX_PLAYERS, NAME_MAX } from './settings.js';
import { canStart } from './room.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// handlers: onHost(name), onJoin(name, code), onAction(action), onStart(), onLeave(), onCopy(),
//           onPlayAgain(), onMenu(), onResume(), onEndMatch(), onClick()
export function createUI(root, handlers) {
  let screen = null;

  function show(node, name) {
    root.replaceChildren(node);
    screen = name;
    // Any button click gets a little UI blip.
    node.addEventListener('click', (e) => {
      if (e.target.closest('button:not(:disabled)')) handlers.onClick?.();
    });
  }

  function hide() {
    root.replaceChildren();
    screen = null;
  }

  // ---- title ----

  function showTitle({ name = '', code = '', message = '' } = {}) {
    const n = el(`
      <div class="panel title">
        <h1 class="logo"><span style="color:#ff5ea8">CLICK</span> <span style="color:#5ee7ff">CLACK</span><br><span style="color:#ffe14d">BOOM</span> <span style="color:#ff7a45">POW</span></h1>
        <label class="field">YOUR NAME <input id="ui-name" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off"></label>
        <button data-act="host" class="big">HOST GAME</button>
        <div class="row">
          <input id="ui-code" maxlength="8" placeholder="ROOM CODE" spellcheck="false" autocomplete="off">
          <button data-act="join">JOIN</button>
        </div>
        <p class="msg" id="ui-msg"></p>
        <p class="help">WASD MOVE · MOUSE AIM · CLICK SHOOT · R RELOAD<br>HOLD SPACE + CLICK TO DRAW WALLS · M MUTE · ESC MENU</p>
      </div>`);
    const nameInput = n.querySelector('#ui-name');
    const codeInput = n.querySelector('#ui-code');
    nameInput.value = name;
    codeInput.value = code;
    n.querySelector('#ui-msg').textContent = message;
    n.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'host') handlers.onHost(nameInput.value);
      if (act === 'join') handlers.onJoin(nameInput.value, codeInput.value);
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
      <div class="panel lobby">
        <div class="lobby-head">
          <h2>LOBBY</h2>
          <div class="code">ROOM <b id="ui-room"></b> <button data-act="copy" id="ui-copy">COPY INVITE LINK</button></div>
        </div>
        <div class="lobby-cols">
          <section>
            <h3>PLAYERS <span id="ui-count"></span></h3>
            <ul id="ui-players" class="players"></ul>
            <button data-act="addBot" id="ui-addbot" class="small">+ ADD BOT</button>
            <h3>YOUR NAME</h3>
            <input id="ui-lname" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off">
            <h3>YOUR COLOR</h3>
            <div id="ui-colors" class="colors">
              ${COLORS.map((c) => `<button class="swatch" data-color="${c}" style="--c:${c}" title="${c}"></button>`).join('')}
            </div>
          </section>
          <section>
            <h3>SETTINGS</h3>
            <div id="ui-settings" class="settings"></div>
          </section>
        </div>
        <div class="lobby-foot">
          <button data-act="leave">LEAVE</button>
          <span id="ui-status" class="status"></span>
          <button data-act="start" id="ui-start" class="big">START</button>
        </div>
      </div>`);
    n.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.color) handlers.onAction({ type: 'color', color: d.color });
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
        return `<li><span class="dot" style="--c:${p.color}"></span><span class="pname">${esc(p.name)}</span>${tags}${kick}</li>`;
      })
      .join('');

    const taken = new Set(room.players.filter((p) => p.id !== localId).map((p) => p.color));
    for (const b of root.querySelectorAll('.swatch')) {
      const c = b.dataset.color;
      b.classList.toggle('mine', me?.color === c);
      b.classList.toggle('taken', taken.has(c));
      b.disabled = taken.has(c);
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
        : '';
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
    const winner = match.roster.find((r) => r.id === match.winner);
    const rows = [...match.roster]
      .sort((a, b) => (match.scores[b.id] ?? 0) - (match.scores[a.id] ?? 0))
      .map((r) => `<li><span class="dot" style="--c:${r.color}"></span><span class="pname">${esc(r.name)}</span><b>${match.scores[r.id] ?? 0}</b></li>`)
      .join('');
    const n = el(`
      <div class="panel gameover">
        <h1 class="winner" style="color:${winner?.color ?? '#fff'}">${esc(winner?.name ?? '???')}</h1>
        <h2>WINS THE GAME!</h2>
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

  return { showTitle, setMessage, flashStatus, showLobby, updateLobby, showPause, showGameOver, hide, get screen() { return screen; } };
}
