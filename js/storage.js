const KEY = 'bible-imposter-preferences-v1';
const defaults = { sound: false, reducedMotion: false, clueSeconds: 30, discussionSeconds: 120, categories: [] };
export function loadPreferences() {
  try { const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { ...defaults, ...saved, categories: Array.isArray(saved.categories) ? saved.categories : [] }; }
  catch { return { ...defaults }; }
}
export function savePreferences(preferences) { const { sound, reducedMotion, clueSeconds, discussionSeconds, categories } = preferences; localStorage.setItem(KEY, JSON.stringify({ sound: !!sound, reducedMotion: !!reducedMotion, clueSeconds, discussionSeconds, categories })); }
export function clearPreferences() { localStorage.removeItem(KEY); }
