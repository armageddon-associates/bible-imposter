import * as engine from './game-engine.js';
import { ALL_CATEGORIES } from './words.js';
import { loadPreferences, savePreferences, clearPreferences } from './storage.js';
import * as ui from './ui.js';
import { createTimer } from './timer.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let prefs = loadPreferences();
let game = null;
let screen = 'home';
let setupState = { players: ['Player 1','Player 2','Player 3'], imposters: 1, categories: prefs.categories.length ? prefs.categories : [...ALL_CATEGORIES], customWords: [], clueSeconds: prefs.clueSeconds, discussionSeconds: prefs.discussionSeconds, finalGuess: false };
let revealed = false, voterIndex = 0, pendingVote = null, timerValue = null, timer = createTimer(value => { timerValue = value; render(); }, () => handleTimerEnd()), timerStarted = false, timeoutNotice = '';
let votePrivate = false;

function setScreen(next) { timer.stop(); timerStarted = false; timerValue = null; screen = next; pendingVote = null; votePrivate = false; if (next !== 'reveal') revealed = false; render(); }
function showToast(message) { toast.textContent = message; toast.classList.add('visible'); setTimeout(()=>toast.classList.remove('visible'), 2400); }
function collectSetup() {
  setupState.players = [...document.querySelectorAll('.player-name')].map(input=>input.value.trim());
  setupState.categories = [...document.querySelectorAll('.category-chip.selected')].map(btn=>btn.dataset.category);
  setupState.customWords = (document.querySelector('#custom-words')?.value ?? '').split(',').map(w=>w.trim()).filter(Boolean);
  setupState.clueSeconds = Number(document.querySelector('#clue-seconds')?.value ?? setupState.clueSeconds);
  setupState.discussionSeconds = Number(document.querySelector('#discussion-seconds')?.value ?? setupState.discussionSeconds);
  setupState.finalGuess = !!document.querySelector('#final-guess')?.checked;
}
function render() {
  const views = { home: ui.home, setup: ()=>ui.setup(setupState), reveal: ()=>ui.reveal(game,revealed), clues: ()=>ui.clue(game,timerValue), discussion: ()=>ui.discussion(game,timerValue,timer.paused), voting: ()=>ui.voting(game,voterIndex,pendingVote,votePrivate), results: ()=>ui.results(game), howto: ui.howto, settings: ()=>ui.settings(prefs) };
  app.innerHTML = views[screen]?.() ?? ui.home();
  if (prefs.reducedMotion) document.documentElement.classList.add('reduced-motion'); else document.documentElement.classList.remove('reduced-motion');
  if (screen==='clues' && game?.timer.clueSeconds>0 && !timerStarted) { timerStarted=true; timer.start(game.timer.clueSeconds); }
  if (screen==='discussion' && game?.timer.discussionSeconds>0 && !timerStarted) { timerStarted=true; timer.start(game.timer.discussionSeconds); }
  if (screen==='setup') { const val=document.querySelector('#imposter-value'); if (val) val.textContent=setupState.imposters; const count=document.querySelector('#player-count'); if(count) count.textContent=setupState.players.length; }
}
function handleTimerEnd() {
  timerStarted=false;
  if(screen==='clues') { timeoutNotice='Clue time is up.'; showToast(timeoutNotice); }
  if(screen==='discussion') { timeoutNotice='Discussion time is up. Ready to vote?'; showToast(timeoutNotice); }
  render();
}
function goResults() { timer.stop(); timerStarted=false; timerValue=null; screen='results'; render(); }
function beginVoting(revote = false) { if (revote) engine.startRevote(game); else engine.startVoting(game); voterIndex=0; pendingVote=null; votePrivate=false; setScreen('voting'); }
function finishVoting() {
  try {
    timer.stop();
    engine.endVoting(game);
    if (game.phase==='revote') { showToast('It’s a tie. Vote again among the tied players.'); game.voteResults=null; voterIndex=0; votePrivate=false; render(); return; }
    goResults();
  } catch(error) { showToast(error.message); }
}
function confirmVote(target) {
  const voters=engine.eligibleVoters(game), voter=voters[voterIndex];
  try { engine.castVote(game,voter.id,target); pendingVote=null; voterIndex++; if(voterIndex>=voters.length) finishVoting(); else render(); }
  catch(error) { showToast(error.message); }
}
function startNewGame() {
  collectSetup();
  const errors=engine.validateSetup({players:setupState.players,imposterCount:setupState.imposters,categories:setupState.categories});
  const error=document.querySelector('#setup-error');
  if(errors.length) { error.textContent=errors.join(' '); error.classList.add('visible'); return; }
  try {
    timer.stop(); game=engine.createGame({...setupState}); revealed=false; voterIndex=0; setScreen('reveal');
  } catch(e) { error.textContent=e.message; error.classList.add('visible'); }
}
function replay() { timer.stop(); game=null; setupState.players=setupState.players.map((p,i)=>p || `Player ${i+1}`); setupState.imposters=engine.recommendedImposters(setupState.players.length); setScreen('setup'); }
function updatePreference() {
  const sound=document.querySelector('#pref-sound'), motion=document.querySelector('#pref-motion'), clue=document.querySelector('#pref-clue'), discussion=document.querySelector('#pref-discussion');
  if(sound) prefs.sound=sound.checked; if(motion) prefs.reducedMotion=motion.checked; if(clue) prefs.clueSeconds=Number(clue.value); if(discussion) prefs.discussionSeconds=Number(discussion.value);
  savePreferences(prefs); if(screen==='settings') render();
}

app.addEventListener('click', event => {
  const button=event.target.closest('[data-action]'); if(!button || button.disabled) return;
  const action=button.dataset.action;
  if(screen==='setup' && ['add-player','remove-player','imposter-minus','imposter-plus','category','toggle-all-categories'].includes(action)) collectSetup();
  switch(action) {
    case 'setup': setupState.players=['Player 1','Player 2','Player 3']; setupState.imposters=1; setupState.categories=prefs.categories.length?prefs.categories:[...ALL_CATEGORIES]; setScreen('setup'); break;
    case 'home': game=null; setScreen('home'); break;
    case 'howto': setScreen('howto'); break;
    case 'settings': setScreen('settings'); break;
    case 'add-player': if(setupState.players.length<20) setupState.players.push(`Player ${setupState.players.length+1}`); setupState.imposters=Math.min(setupState.imposters,setupState.players.length-1); render(); break;
    case 'remove-player': if(setupState.players.length>3) setupState.players.splice(Number(button.dataset.index),1); setupState.imposters=Math.min(setupState.imposters,setupState.players.length-1); render(); break;
    case 'imposter-minus': setupState.imposters=Math.max(1,setupState.imposters-1); render(); break;
    case 'imposter-plus': setupState.imposters=Math.min(setupState.players.length-1,setupState.imposters+1); render(); break;
    case 'category': {const key=button.dataset.category; setupState.categories=setupState.categories.includes(key)?setupState.categories.filter(k=>k!==key):[...setupState.categories,key]; render(); break;}
    case 'toggle-all-categories': setupState.categories=setupState.categories.length===ALL_CATEGORIES.length?[]:[...ALL_CATEGORIES]; render(); break;
    case 'start-game': startNewGame(); break;
    case 'show-private': revealed=true; render(); break;
    case 'next-reveal': revealed=false; engine.advanceReveal(game); if(game.phase==='clues') setScreen('clues'); else render(); break;
    case 'next-clue': timer.stop(); timerStarted=false; timerValue=null; engine.nextClue(game); if(game.phase==='discussion') render(); else render(); break;
    case 'start-discussion': timer.stop(); timerStarted=false; game.phase='discussion'; timerValue=null; render(); break;
    case 'pause-timer': timer.pause(); render(); break;
    case 'resume-timer': timer.resume(); render(); break;
    case 'early-vote': beginVoting(); break;
    case 'start-voting': beginVoting(); break;
    case 'start-revote': beginVoting(true); break;
    case 'show-ballot': votePrivate=true; render(); break;
    case 'select-vote': pendingVote=button.dataset.target; render(); break;
    case 'cancel-vote': pendingVote=null; render(); break;
    case 'confirm-vote': confirmVote(button.dataset.target); votePrivate=false; break;
    case 'next-voter': voterIndex++; votePrivate=false; if(voterIndex>=engine.eligibleVoters(game).length) finishVoting(); else render(); break;
    case 'end-voting': finishVoting(); break;
    case 'next-round': engine.nextRound(game); voterIndex=0; setScreen('clues'); break;
    case 'play-again': replay(); break;
    case 'skip-guess': game.finalGuessUsed=true; game.finalGuessResult='skipped'; engine.checkWinner(game); goResults(); break;
    case 'clear-preferences': clearPreferences(); prefs=loadPreferences(); showToast('Saved preferences cleared.'); render(); break;
  }
});
app.addEventListener('submit', event=>{
  if(event.target.id==='guess-form') { event.preventDefault(); const value=document.querySelector('#final-word-guess').value; try { engine.submitFinalGuess(game,value); goResults(); } catch(e) { showToast(e.message); } }
});
app.addEventListener('change', event=>{
  if(event.target.closest('#pref-sound')||event.target.closest('#pref-motion')||event.target.closest('#pref-clue')||event.target.closest('#pref-discussion')) updatePreference();
  if(event.target.id==='clue-seconds') setupState.clueSeconds=Number(event.target.value);
  if(event.target.id==='discussion-seconds') setupState.discussionSeconds=Number(event.target.value);
  if(event.target.id==='final-guess') setupState.finalGuess=event.target.checked;
});
app.addEventListener('input', event=>{
  if(event.target.matches('.player-name')) { const rows=[...document.querySelectorAll('.player-name')]; const duplicates=rows.filter(input=>input.value.trim()&&rows.filter(other=>other.value.trim().toLowerCase()===input.value.trim().toLowerCase()).length>1); rows.forEach(input=>input.classList.toggle('invalid',duplicates.includes(input))); }
  if(event.target.id==='custom-words') { const words=event.target.value.split(',').map(x=>x.trim()).filter(Boolean); document.querySelector('#custom-count').textContent=`${words.length} added`; }
});
window.addEventListener('keydown', e=>{ if(e.key==='Escape'&&screen==='reveal'&&revealed){revealed=false;render();} });
render();
