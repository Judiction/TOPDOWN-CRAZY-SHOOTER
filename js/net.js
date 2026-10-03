// Thin wrapper around PeerJS (loaded from a CDN in index.html as the global `Peer`).
// PeerJS's free cloud server only introduces browsers to each other; after that, game data flows
// directly between players over WebRTC. The host's peer id is derived from the room code.

const PREFIX = 'clickclackboompow-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // no I or O, so codes are easy to read out loud
const CONNECT_TIMEOUT = 10000;

export const PROTOCOL = 1;                      // bump when host/client messages change

export function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export function cleanCode(code) {
  return String(code ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

function needPeerJS() {
  if (typeof window.Peer !== 'function') throw Object.assign(new Error('PeerJS failed to load'), { type: 'no-peerjs' });
}

// Registers this browser as the host of `code`. Resolves with the Peer once the server accepts it.
export function openHost(code) {
  needPeerJS();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer(PREFIX + code);
    const timer = setTimeout(() => {
      peer.destroy();
      reject(Object.assign(new Error('timeout'), { type: 'timeout' }));
    }, CONNECT_TIMEOUT);
    peer.on('open', () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on('error', (err) => {
      clearTimeout(timer);
      peer.destroy();
      reject(err);
    });
  });
}

// Connects to the host of `code`. Resolves with { peer, conn } once the data channel is open.
export function joinHost(code) {
  needPeerJS();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer();
    const fail = (err) => {
      clearTimeout(timer);
      peer.destroy();
      reject(err);
    };
    const timer = setTimeout(() => fail(Object.assign(new Error('timeout'), { type: 'timeout' })), CONNECT_TIMEOUT);
    peer.on('error', fail);
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        clearTimeout(timer);
        resolve({ peer, conn });
      });
      conn.on('error', fail);
    });
  });
}

// Keeps a host reachable for new joiners if its link to the PeerJS server drops (open games keep working).
export function keepAlive(peer) {
  peer.on('disconnected', () => {
    if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1000);
  });
}

export function errorMessage(err) {
  switch (err?.type) {
    case 'peer-unavailable': return 'ROOM NOT FOUND. CHECK THE CODE!';
    case 'unavailable-id': return 'THAT ROOM CODE IS TAKEN, TRY AGAIN.';
    case 'timeout': return 'CONNECTION TIMED OUT. TRY AGAIN.';
    case 'no-peerjs': return 'COULD NOT LOAD THE NETWORK LIBRARY. CHECK YOUR CONNECTION.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return 'CANNOT REACH THE MATCHMAKING SERVER.';
    case 'browser-incompatible': return 'THIS BROWSER DOES NOT SUPPORT ONLINE PLAY.';
    default: return 'CONNECTION FAILED. TRY AGAIN.';
  }
}
