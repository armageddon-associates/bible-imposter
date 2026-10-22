export function createTimer(onTick, onEnd) {
  let handle = null, remaining = 0, deadline = 0, paused = false;
  function stop() { if (handle) clearInterval(handle); handle = null; paused = false; }
  function tick() { remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); onTick(remaining); if (!remaining) { stop(); onEnd?.(); } }
  return {
    start(seconds) { stop(); remaining = Math.max(0, Math.floor(seconds)); deadline = Date.now() + remaining * 1000; tick(); if (remaining) handle = setInterval(tick, 250); },
    pause() { if (!handle || paused) return; remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); clearInterval(handle); handle = null; paused = true; onTick(remaining); },
    resume() { if (!paused) return; paused = false; deadline = Date.now() + remaining * 1000; handle = setInterval(tick, 250); },
    stop,
    get paused() { return paused; },
    get running() { return !!handle; }
  };
}
