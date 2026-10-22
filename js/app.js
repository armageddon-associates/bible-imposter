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
let setupState = { players: ['Player 1','Player 2','Player 3'], categories: prefs.categories.length ? prefs.categories : [...ALL_CATEGORIES], clueSeconds: prefs.clueSeconds, discussionSeconds: 600, roundMode: 'elimination', roundLimit: 5, imposterClue: false, finalGuess: false };
let revealed = false, voterIndex = 0, pendingVote = [], timerValue = null, timer = createTimer(value => { timerValue = value; render(); }, () => handleTimerEnd()), timerStarted = false, timeoutNotice = '';
let votePrivate = false;

function setScreen(next) { timer.stop(); timerStarted = false; timerValue = null; screen = next; pendingVote = []; votePrivate = false; if (next !== 'reveal') revealed = false; render(); }
function showToast(message) { toast.textContent = message; toast.classList.add('visible'); setTimeout(()=>toast.classList.remove('visible'), 2400); }
function collectSetup() {
  setupState.players = [...document.querySelectorAll('.player-name')].map(input=>input.value.trim());
  setupState.categories = [...document.querySelectorAll('.category-chip.selected')].map(btn=>btn.dataset.category);
  setupState.clueSeconds = Number(document.querySelector('#clue-seconds')?.value ?? setupState.clueSeconds);
  setupState.roundMode = document.querySelector('#round-mode')?.value ?? setupState.roundMode;
  setupState.roundLimit = Number(document.querySelector('#round-limit')?.value ?? setupState.roundLimit);
  setupState.discussionSeconds = Number(document.querySelector('#discussion-seconds')?.value ?? (setupState.discussionSeconds/60))*60;
  setupState.imposterClue = !!document.querySelector('#imposter-clue')?.checked;
  setupState.finalGuess = !!document.querySelector('#final-guess')?.checked;
}
function render() {
  const views = { home: ui.home, setup: ()=>ui.setup(setupState), reveal: ()=>ui.reveal(game,revealed), clues: ()=>ui.clue(game,timerValue,timeoutNotice), voting: ()=>ui.voting(game,voterIndex,pendingVote,votePrivate), results: ()=>ui.results(game), howto: ui.howto, settings: ()=>ui.settings(prefs) };
  app.innerHTML = views[screen]?.() ?? ui.home();
  if (prefs.reducedMotion) document.documentElement.classList.add('reduced-motion'); else document.documentElement.classList.remove('reduced-motion');
  if (screen==='clues' && game?.roundMode==='fixed' && game.discussionDeadline && !game.discussionTimeExpired && !timerStarted) { timerStarted=true; timer.start(Math.max(0,Math.ceil((game.discussionDeadline-Date.now())/1000))); }
  else if (screen==='clues' && game?.roundMode!=='fixed' && game?.timer.clueSeconds>0 && !timerStarted) { timerStarted=true; timer.start(game.timer.clueSeconds); }
  if (screen==='setup') { const count=document.querySelector('#player-count'); if(count) count.textContent=setupState.players.length; }
}
function handleTimerEnd() {
  timerStarted=false;
  if(screen==='clues' && game?.roundMode==='fixed') { engine.expireDiscussion(game,Date.now()); timeoutNotice='Discussion time is over'; render(); return; }
  if(screen==='clues') { beginVoting(); return; }
  render();
}
function goResults() { timer.stop(); timerStarted=false; timerValue=null; screen='results'; render(); }
function beginVoting(revote = false) { if (!game || screen!=='clues' && !revote || game.phase!=='clues' && !revote) return; timer.stop(); timerStarted=false; if (revote) engine.startRevote(game); else engine.startVoting(game); voterIndex=0; pendingVote=[]; votePrivate=false; setScreen('voting'); }
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
  try { engine.castVote(game,voter.id,target); pendingVote=[]; votePrivate=false; voterIndex++; if(voterIndex>=voters.length) finishVoting(); else render(); }
  catch(error) { showToast(error.message); }
}
function startNewGame() {
  collectSetup();
  const errors=engine.validateSetup({players:setupState.players,categories:setupState.categories,roundMode:setupState.roundMode,roundLimit:setupState.roundLimit,discussionSeconds:setupState.discussionSeconds});
  const error=document.querySelector('#setup-error');
  if(errors.length) { error.textContent=errors.join(' '); error.classList.add('visible'); return; }
  try {
    timer.stop(); timeoutNotice=''; game=engine.createGame({...setupState}); revealed=false; voterIndex=0; setScreen('reveal');
  } catch(e) { error.textContent=e.message; error.classList.add('visible'); }
}
function replay() { timer.stop(); game=null; setupState.players=setupState.players.map((p,i)=>p || `Player ${i+1}`); setScreen('setup'); }
function updatePreference() {
  const sound=document.querySelector('#pref-sound'), motion=document.querySelector('#pref-motion'), clue=document.querySelector('#pref-clue');
  if(sound) prefs.sound=sound.checked; if(motion) prefs.reducedMotion=motion.checked; if(clue) prefs.clueSeconds=Number(clue.value);
  savePreferences(prefs); if(screen==='settings') render();
}

app.addEventListener('click', event => {
  const button=event.target.closest('[data-action]'); if(!button || button.disabled) return;
  const action=button.dataset.action;
  if(screen==='setup' && ['add-player','remove-player','category','toggle-all-categories'].includes(action)) collectSetup();
  switch(action) {
    case 'setup': setupState.players=['Player 1','Player 2','Player 3']; setupState.categories=prefs.categories.length?prefs.categories:[...ALL_CATEGORIES]; setupState.clueSeconds=prefs.clueSeconds; setupState.discussionSeconds=600; setupState.roundMode='elimination'; setupState.roundLimit=5; setupState.imposterClue=false; setupState.finalGuess=false; setScreen('setup'); break;
    case 'home': game=null; setScreen('home'); break;
    case 'howto': setScreen('howto'); break;
    case 'settings': setScreen('settings'); break;
    case 'add-player': if(setupState.players.length<20) { const used=new Set(setupState.players.map(name=>name.toLocaleLowerCase())); let next=setupState.players.length+1; while(used.has(`player ${next}`.toLocaleLowerCase())) next++; setupState.players.push(`Player ${next}`); } render(); break;
    case 'remove-player': if(setupState.players.length>3) setupState.players.splice(Number(button.dataset.index),1); render(); break;
    case 'category': {const key=button.dataset.category; setupState.categories=setupState.categories.includes(key)?setupState.categories.filter(k=>k!==key):[...setupState.categories,key]; render(); break;}
    case 'toggle-all-categories': setupState.categories=setupState.categories.length===ALL_CATEGORIES.length?[]:[...ALL_CATEGORIES]; render(); break;
    case 'start-game': startNewGame(); break;
    case 'show-private': revealed=true; render(); break;
    case 'next-reveal': revealed=false; engine.advanceReveal(game); if(game.phase==='clues') {timeoutNotice=''; if(game.roundMode==='fixed'){engine.startDiscussion(game);timerValue=Math.ceil(game.discussionDurationSeconds);} setScreen('clues');} else render(); break;
    case 'next-clue': timer.stop(); timerStarted=false; timerValue=null; engine.nextClue(game); render(); break;
    case 'start-voting': beginVoting(); break;
    case 'start-revote': beginVoting(true); break;
    case 'show-ballot': votePrivate=true; render(); break;
    case 'select-vote': {const id=button.dataset.target;pendingVote=pendingVote.includes(id)?pendingVote.filter(x=>x!==id):[...pendingVote,id];render();break;}
    case 'cancel-vote': pendingVote=[]; render(); break;
    case 'confirm-vote': confirmVote(pendingVote); votePrivate=false; break;
    case 'next-voter': voterIndex++; votePrivate=false; if(voterIndex>=engine.eligibleVoters(game).length) finishVoting(); else render(); break;
    case 'end-voting': finishVoting(); break;
    case 'next-round': try { engine.nextRound(game); voterIndex=0; timeoutNotice=''; setScreen(game.roundMode==='fixed'?'reveal':'clues'); } catch(e) { showToast(e.message); } break;
    case 'play-again': replay(); break;
    case 'skip-guess': try { engine.skipFinalGuess(game); goResults(); } catch(e) { showToast(e.message); } break;
    case 'clear-preferences': clearPreferences(); prefs=loadPreferences(); showToast('Saved preferences cleared.'); render(); break;
  }
});
app.addEventListener('submit', event=>{
  if(event.target.id==='guess-form') { event.preventDefault(); const value=document.querySelector('#final-word-guess').value; try { engine.submitFinalGuess(game,value); goResults(); } catch(e) { showToast(e.message); } }
});
app.addEventListener('change', event=>{
  if(event.target.closest('#pref-sound')||event.target.closest('#pref-motion')||event.target.closest('#pref-clue')) updatePreference();
  if(event.target.id==='clue-seconds') setupState.clueSeconds=Number(event.target.value);
  if(event.target.id==='final-guess') setupState.finalGuess=event.target.checked;
  if(event.target.id==='imposter-clue') setupState.imposterClue=event.target.checked;
  if(event.target.id==='round-mode') { setupState.roundMode=event.target.value; const setting=document.querySelector('#round-limit-setting'); if(setting) setting.hidden=setupState.roundMode!=='fixed'; updateSetupValidation(); }
  if(event.target.id==='round-limit') { setupState.roundLimit=Number(event.target.value); updateSetupValidation(); }
  if(event.target.id==='discussion-seconds') {setupState.discussionSeconds=Number(event.target.value)*60; updateSetupValidation();}
});
app.addEventListener('input', event=>{
  if(event.target.matches('.player-name')) {
    const rows=[...document.querySelectorAll('.player-name')];
    const duplicates=rows.filter(input=>input.value.trim()&&rows.filter(other=>other.value.trim().normalize('NFKC').toLocaleLowerCase()===input.value.trim().normalize('NFKC').toLocaleLowerCase()).length>1);
    rows.forEach(input=>input.classList.toggle('invalid',duplicates.includes(input)));
    const errors=engine.validateSetup({players:rows.map(input=>input.value),roundMode:setupState.roundMode,roundLimit:Number(document.querySelector('#round-limit')?.value ?? setupState.roundLimit),discussionSeconds:Number(document.querySelector('#discussion-seconds')?.value ?? (setupState.discussionSeconds/60))*60});
    const start=document.querySelector('[data-action="start-game"]'), error=document.querySelector('#setup-error');
    if(start) start.disabled=errors.length>0;
    if(error) { error.textContent=errors.join(' '); error.classList.toggle('visible',errors.length>0); }
  }
});
function updateSetupValidation() { const errors=engine.validateSetup({players:[...document.querySelectorAll('.player-name')].map(input=>input.value),roundMode:setupState.roundMode,roundLimit:Number(document.querySelector('#round-limit')?.value ?? setupState.roundLimit),discussionSeconds:Number(document.querySelector('#discussion-seconds')?.value ?? (setupState.discussionSeconds/60))*60}); const start=document.querySelector('[data-action="start-game"]'),error=document.querySelector('#setup-error'); if(start) start.disabled=errors.length>0; if(error) { error.textContent=errors.join(' '); error.classList.toggle('visible',errors.length>0); } }
window.addEventListener('keydown', e=>{ if(e.key==='Escape'&&screen==='reveal'&&revealed){revealed=false;render();} });
render();
