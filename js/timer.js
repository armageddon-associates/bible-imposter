export function createTimer(onTick, onEnd) {
  let handle = null, remaining = 0, deadline = 0, paused = false, ended = false;
  function stop() { if (handle) clearInterval(handle); handle = null; paused = false; }
  function tick() { const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); if (next !== remaining) { remaining = next; onTick(remaining); } if (!remaining && !ended) { ended = true; stop(); onEnd?.(); } }
  return {
    start(seconds) { stop(); ended = false; remaining = -1; deadline = Date.now() + Math.max(0, Math.floor(seconds)) * 1000; tick(); if (remaining) handle = setInterval(tick, 250); },
    pause() { if (!handle || paused) return; remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); clearInterval(handle); handle = null; paused = true; onTick(remaining); },
    resume() { if (!paused) return; paused = false; deadline = Date.now() + remaining * 1000; handle = setInterval(tick, 250); },
    stop,
    get paused() { return paused; },
    get running() { return !!handle; }
  };
}
