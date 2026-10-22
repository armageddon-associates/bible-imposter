import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../js/game-engine.js';
import * as ui from '../js/ui.js';
import { ALL_CATEGORIES, getPairs, getWords, individualWords } from '../js/words.js';

function deterministicCrypto() {
  let n = 1;
  return { getRandomValues(buffer) { for (let i=0;i<buffer.length;i++) buffer[i]=(n++ * 2654435761) >>> 0; return buffer; } };
}
const names = n => Array.from({length:n},(_,i)=>`Player ${i+1}`);
function make(config={}) { return game.createGame({ players:names(6), categories:ALL_CATEGORIES, mode:'different', ...config }, deterministicCrypto()); }
function openVoting(g) { game.startClues(g); game.startVoting(g); }

test('validates minimum, maximum, and invalid player counts', () => {
  assert.equal(game.validateSetup({players:names(3)}).length,0);
  assert.equal(game.validateSetup({players:names(20)}).length,0);
  assert.ok(game.validateSetup({players:names(2)}).some(error=>error.includes('between 3 and 20')));
  assert.ok(game.validateSetup({players:names(21)}).some(error=>error.includes('between 3 and 20')));
});
test('automatically assigns the required Imposter count for every policy boundary', () => {
  assert.deepEqual([3,6,7,12,13,20].map(game.recommendedImposters),[1,1,2,2,3,3]);
  for (const [count, expected] of [[3,1],[6,1],[7,2],[12,2],[13,3],[20,3]]) {
    const g=make({players:names(count)});
    assert.equal(g.imposterCount,expected);
    assert.equal(g.players.filter(p=>p.role==='imposter').length,expected);
    assert.equal(g.players.filter(p=>p.role==='civilian').length,count-expected);
    assert.ok(g.players.some(p=>p.role==='imposter') && g.players.some(p=>p.role==='civilian'));
  }
  assert.equal(make({players:names(7),imposterCount:6}).imposterCount,2,'stale/manual counts cannot override the automatic policy');
});
test('constructs both game modes with correct word assignments', () => {
  const different=make({mode:'different'});
  assert.equal(new Set(different.players.filter(p=>p.role==='civilian').map(p=>p.word)).size,1);
  assert.notEqual(different.civilianWord,different.imposterWord);
  assert.ok(different.players.filter(p=>p.role==='imposter').every(p=>p.word===different.imposterWord));
  const hidden=make({mode:'hidden'});
  assert.ok(hidden.players.filter(p=>p.role==='imposter').every(p=>p.word===null));
  assert.ok(hidden.players.filter(p=>p.role==='civilian').every(p=>p.word===hidden.civilianWord));
});
test('randomizes reveal order and starts clue turn only after every private reveal', () => {
  const g=make(); const order=[...g.revealOrder];
  assert.equal(new Set(order).size,6);
  while(g.phase==='reveal') game.advanceReveal(g);
  assert.equal(g.phase,'clues');
  assert.equal(g.clueOrder.length,6);
});
test('rejects duplicate votes, self votes, and eliminated voters', () => {
  const g=make(); openVoting(g);
  const [a,b,c]=game.livingPlayers(g);
  assert.throws(()=>game.castVote(g,a.id,a.id));
  game.castVote(g,a.id,b.id);
  assert.throws(()=>game.castVote(g,a.id,c.id));
  b.alive=false;
  assert.throws(()=>game.castVote(g,b.id,c.id));
});
test('handles tied vote and tiebreak elimination', () => {
  const g=make({players:names(4),imposterCount:1}); openVoting(g);
  const [a,b,c,d]=game.livingPlayers(g);
  game.castVote(g,a.id,b.id); game.castVote(g,b.id,a.id); game.castVote(g,c.id,a.id); game.castVote(g,d.id,b.id);
  game.endVoting(g); assert.equal(g.phase,'revote'); assert.deepEqual(new Set(g.tiedIds),new Set([a.id,b.id]));
  game.startRevote(g);
  for(const voter of game.eligibleVoters(g)) game.castVote(g,voter.id,voter.id===a.id?b.id:a.id);
  game.endVoting(g); assert.equal(g.phase,'results'); assert.equal(g.eliminatedId,a.id); assert.equal(a.alive,false);
});
test('revote tie eliminates no one and can continue to another round', () => {
  const g=make({players:names(4),imposterCount:1}); openVoting(g);
  const [a,b,c,d]=game.livingPlayers(g);
  game.castVote(g,a.id,b.id); game.castVote(g,b.id,a.id); game.castVote(g,c.id,a.id); game.castVote(g,d.id,b.id); game.endVoting(g); game.startRevote(g);
  game.castVote(g,a.id,b.id); game.castVote(g,b.id,a.id); game.castVote(g,c.id,a.id); game.castVote(g,d.id,b.id); game.endVoting(g);
  assert.equal(g.phase,'results'); assert.equal(g.eliminatedId,null); assert.equal(game.livingPlayers(g).length,4);
  game.nextRound(g); assert.equal(g.round,2); assert.equal(g.phase,'clues'); assert.deepEqual(g.votes,{});
});
test('counts abstentions as no vote and applies civilian and parity victory', () => {
  const g=make({players:names(4)}); openVoting(g);
  const imposter=g.players.find(p=>p.role==='imposter'), [a,b]=game.livingPlayers(g).filter(p=>p.role==='civilian');
  game.castVote(g,a.id,imposter.id); game.castVote(g,b.id,imposter.id); for(const voter of game.eligibleVoters(g)) if(!g.votes[voter.id]) game.castVote(g,voter.id,voter.role==='imposter'?a.id:imposter.id); game.endVoting(g);
  assert.equal(g.voteResults[imposter.id],3); assert.equal(g.eliminatedId,imposter.id); assert.equal(g.winner,'civilians');
  const parity=make({players:names(3)}); const civilian=parity.players.find(p=>p.role==='civilian');
  civilian.alive=false; assert.equal(game.checkWinner(parity),'imposters');
});
test('supports a one-time final Imposter guess', () => {
  const g=make({players:names(4),imposterCount:1,finalGuess:true});
  const imposter=g.players.find(p=>p.role==='imposter'); imposter.alive=false; g.eliminatedId=imposter.id; g.lastEliminatedImposter=true; g.phase='results';
  assert.equal(game.submitFinalGuess(g,g.civilianWord),true); assert.equal(g.winner,'imposters');
  assert.throws(()=>game.submitFinalGuess(g,g.civilianWord));
  const g2=make({players:names(4),imposterCount:1,finalGuess:true}); const imp=g2.players.find(p=>p.role==='imposter'); imp.alive=false; g2.eliminatedId=imp.id; g2.lastEliminatedImposter=true;
  assert.equal(game.submitFinalGuess(g2,'not the word'),false);
});
test('word pools are nonempty and reject empty, equal, and duplicate custom entries', () => {
  const pairs=getPairs(ALL_CATEGORIES,[' Ark ','ark','','Rainbow']);
  assert.ok(pairs.length>0); assert.ok(pairs.every(p=>p.civilian.toLowerCase()!==p.imposter.toLowerCase()));
  assert.ok(getWords(['concepts'],['Faith',' faith ','Hope']).some(word=>word.en.toLocaleLowerCase()==='faith'));
  assert.ok(getPairs([],[]).length>0);
});
test('empty or stale categories fall back to local Bible words; invalid mode still fails clearly', () => {
  for (const categories of [[],['not-a-category']]) {
    const g=game.createGame({players:names(3),categories,mode:'different'},deterministicCrypto());
    assert.ok(g.civilianWord && g.imposterWord && g.categories.length>0);
  }
  assert.throws(()=>game.createGame({players:names(3),categories:ALL_CATEGORIES,mode:'mystery'},deterministicCrypto()),/Unknown game mode/);
});
test('validates empty and duplicate names without requiring an Imposter count', () => {
  assert.ok(game.validateSetup({players:['A','B',' ']}).some(error=>error.includes('cannot be empty')));
  assert.ok(game.validateSetup({players:['A','a','C']}).some(error=>error.includes('unique')));
  assert.ok(game.validateSetup({players:['Élodie','e\u0301lodie','C']}).some(error=>error.includes('unique')));
  assert.throws(()=>game.createGame({players:['A','B',' ']}),/Player names cannot be empty/);
});
test('supports automatic mode selection and replay-style fresh game creation without host words', () => {
  const first=game.createGame({players:names(7)},deterministicCrypto());
  const replay=game.createGame({players:names(7)},deterministicCrypto());
  assert.ok(['different','hidden'].includes(first.mode));
  assert.ok(['different','hidden'].includes(replay.mode));
  assert.equal(first.players.filter(p=>p.role==='imposter').length,2);
  assert.equal(replay.players.filter(p=>p.role==='imposter').length,2);
  assert.ok(first.civilianWord && replay.civilianWord);
  assert.ok(!first.revealOrder.every((id,index)=>id===first.players[index].id));
});
test('setup UI needs only player names and disables Start Game for invalid lists', () => {
  const base={players:names(7),categories:ALL_CATEGORIES,clueSeconds:30,discussionSeconds:120,finalGuess:false};
  const valid=ui.setup(base);
  assert.match(valid,/7 players · 2 Imposters · 5 Civilians/);
  assert.match(valid,/Ready to play! The game automatically chooses the Bible word, game mode, and Imposters/);
  assert.doesNotMatch(valid,/imposter-plus|imposter-minus|custom-words|Custom Bible words/);
  assert.match(ui.setup({...base,players:['Alex','Alex','Jordan']}).match(/<button class="button primary" data-action="start-game"[^>]*>/)?.[0]??'',/disabled/);
  assert.doesNotMatch(ui.setup({...base,players:['Alex','Casey','Jordan']}),/data-action="start-game" disabled/);
  assert.match(ui.setup({...base,categories:['removed-category']}),/Using the complete Bible word bank/);
});

test('stores private translations and optional clues without leaking into the wrong role', () => {
  const different=make({mode:'different',categories:['characters'],imposterClue:true});
  assert.ok(different.players.filter(p=>p.role==='civilian').every(p=>p.wordMalayalam===different.civilianWordEntry.ml));
  assert.ok(different.players.filter(p=>p.role==='imposter').every(p=>p.word===different.imposterWord&&p.imposterHint));
  assert.ok(different.players.filter(p=>p.role==='civilian').every(p=>p.imposterHint===null));
  const hidden=make({mode:'hidden',imposterClue:true});
  assert.ok(hidden.players.filter(p=>p.role==='imposter').every(p=>p.word===null&&p.wordMalayalam===null&&p.imposterHint));
  assert.ok(hidden.players.filter(p=>p.role==='civilian').every(p=>p.word===hidden.civilianWord&&p.wordMalayalam===hidden.civilianWordEntry.ml));
  const noHint=make({mode:'hidden'}); assert.ok(noHint.players.every(p=>p.role!=='imposter'||p.imposterHint===null));
});
test('every built-in secret word has a Malayalam display value', () => {
  const entries=Object.values(individualWords).flat();
  assert.ok(entries.length>0);
  assert.ok(entries.every(entry=>typeof entry.ml==='string'&&entry.ml.trim().length>0));
});
test('clue phase goes straight to voting and guards repeated transitions', () => {
  const g=make(); game.startClues(g); game.startVoting(g);
  assert.equal(g.phase,'voting'); assert.throws(()=>game.startVoting(g));
  assert.throws(()=>game.nextClue(g));
});
function castRoundVotes(g,targetId){const counts=Object.fromEntries(g.players.map(p=>[p.id,0]));for(const voter of game.eligibleVoters(g)){const selected=[];if(voter.id!==targetId){selected.push(targetId);counts[targetId]++;}while(selected.length<game.requiredVoteCount(g,voter.id)){const option=g.players.filter(p=>p.id!==voter.id&&!selected.includes(p.id)).sort((a,b)=>counts[a.id]-counts[b.id])[0];selected.push(option.id);counts[option.id]++;}game.castVote(g,voter.id,selected);}}
test('multiple-target ballots require distinct eligible suspects and count each selection',()=>{const g=make({players:names(7),roundMode:'fixed',roundLimit:1});game.startClues(g);game.startVoting(g);const [voter,...others]=g.players;assert.equal(game.requiredVoteCount(g,voter.id),2);assert.throws(()=>game.castVote(g,voter.id,[others[0].id]));assert.throws(()=>game.castVote(g,voter.id,[others[0].id,others[0].id]));assert.throws(()=>game.castVote(g,voter.id,[voter.id,others[0].id]));game.castVote(g,voter.id,[others[0].id,others[1].id]);assert.equal(g.voteResults,null);assert.throws(()=>game.castVote(g,voter.id,[others[2].id,others[3].id]));assert.deepEqual(g.votes[voter.id],[others[0].id,others[1].id]);});
test('revote caps a multi-Imposter ballot to available non-self candidates',()=>{const g=make({players:names(7),roundMode:'fixed',roundLimit:1});g.phase='voting';g.revote=true;g.tiedIds=['player-1','player-2'];assert.equal(game.requiredVoteCount(g,'player-1'),1);const html=ui.voting(g,0,[],true);assert.match(html,/requirement is reduced/);});
test('discussion expiry message remains a manual-vote prompt',()=>{const g=make({roundMode:'fixed'});game.startClues(g);const html=ui.clue(g,0,'Discussion time is over');assert.match(html,/Discussion time is over/);assert.match(html,/data-action="start-voting"/);});
test('Elimination Every Round preserves permanent eliminations across its next round',()=>{const g=make({players:names(6),roundMode:'elimination'});game.startClues(g);game.startVoting(g);const target=g.players.find(p=>p.role==='civilian');for(const v of game.eligibleVoters(g))game.castVote(g,v.id,[v.id===target.id?g.players.find(p=>p.id!==target.id).id:target.id]);game.endVoting(g);assert.equal(target.alive,false);if(!g.winner){game.nextRound(g);assert.equal(target.alive,false);assert.equal(g.clueOrder.includes(target.id),false);}});
test('discussion deadline starts after role reveals, expires without starting voting, and manual voting clears it',()=>{const g=make({roundMode:'fixed',discussionSeconds:60});assert.equal(g.discussionDeadline,null);while(g.phase==='reveal')game.advanceReveal(g);const now=100000;game.startDiscussion(g,now);assert.equal(g.discussionDeadline,now+60000);assert.equal(game.expireDiscussion(g,now+59999),false);assert.equal(game.expireDiscussion(g,now+60000),true);assert.equal(game.expireDiscussion(g,now+60001),false);assert.equal(g.phase,'clues');assert.equal(g.discussionTimeExpired,true);game.startVoting(g);assert.equal(g.phase,'voting');assert.equal(g.discussionDeadline,null);});


test('fixed setup ignores obsolete round limits and keeps discussion timer',()=>{assert.equal(game.validateSetup({players:names(3),roundMode:'fixed',roundLimit:NaN,discussionSeconds:60}).length,0);for(const seconds of [60,3600])assert.equal(game.validateSetup({players:names(3),roundMode:'fixed',discussionSeconds:seconds}).length,0);for(const seconds of [59,3601])assert.ok(game.validateSetup({players:names(3),roundMode:'fixed',discussionSeconds:seconds}).length);const html=ui.setup({players:names(3),categories:ALL_CATEGORIES,clueSeconds:30,discussionSeconds:600,roundMode:'fixed'});assert.match(html,/id="discussion-seconds" type="number" min="1" max="60" step="1" value="10"/);assert.doesNotMatch(html,/round-limit/);});
function forceRoles(g,imposterIds){g.initialImposterCount=g.imposterCount=imposterIds.length;for(const p of g.players){p.role=imposterIds.includes(p.id)?'imposter':'civilian';p.word=p.role==='imposter'?(g.mode==='different'?g.imposterWord:null):g.civilianWord;p.wordMalayalam=p.role==='imposter'?(g.mode==='different'?g.imposterWordEntry?.ml??null:null):g.civilianWordEntry?.ml??null;}}
function voteFor(g,targetId){game.startClues(g);game.startVoting(g);for(const voter of game.eligibleVoters(g)){let ballot=[targetId];if(voter.id===targetId)ballot=[g.players.find(p=>p.id!==voter.id).id];while(ballot.length<game.requiredVoteCount(g,voter.id)){const next=g.players.find(p=>p.id!==voter.id&&!ballot.includes(p.id));ballot.push(next.id);}game.castVote(g,voter.id,ballot);}game.endVoting(g);}
test('fixed mode ends after final vote and civilians win only when every Imposter is selected',()=>{const g=make({players:names(6),roundMode:'fixed',roundLimit:20});forceRoles(g,['player-1']);voteFor(g,'player-1');assert.equal(g.phase,'fixed-results');assert.equal(g.winner,'civilians');assert.equal(g.fixedResult.winner,'civilians');assert.equal(g.completedRounds,1);assert.equal(g.configuredRoundLimit,null);assert.throws(()=>game.nextRound(g));});
test('fixed mode gives Imposters the win when the Imposter is not identified',()=>{const g=make({players:names(6),roundMode:'fixed'});forceRoles(g,['player-1']);voteFor(g,'player-2');assert.equal(g.winner,'imposters');assert.match(g.fixedResult.reason,/remains unidentified/);assert.equal(g.phase,'fixed-results');});
test('multiple Imposters: identifying one while missing another is an Imposter win',()=>{const g=make({players:names(7),roundMode:'fixed'});forceRoles(g,['player-1','player-2']);game.startClues(g);game.startVoting(g);const fillers=['player-3','player-4','player-5','player-6','player-7'];let fillIndex=0;for(const voter of game.eligibleVoters(g)){let second=fillers[fillIndex++%fillers.length];if(second===voter.id)second=fillers[fillIndex++%fillers.length];const ballot=voter.id==='player-1'?['player-2',second]:['player-1',second];game.castVote(g,voter.id,ballot);}game.endVoting(g);assert.equal(g.eliminatedId,'player-1');assert.equal(g.winner,'imposters');assert.match(g.fixedResult.reason,/at least one Imposter remains unidentified/i);});
test('selecting a Civilian while an Imposter remains gives Imposters the win',()=>{const g=make({players:names(6),roundMode:'fixed'});forceRoles(g,['player-1']);voteFor(g,'player-2');assert.equal(g.eliminatedId,'player-2');assert.equal(g.players.find(p=>p.id===g.eliminatedId).role,'civilian');assert.equal(g.winner,'imposters');});
test('a tied final revote eliminates nobody and Imposters win',()=>{const g=make({players:names(4),roundMode:'fixed'});forceRoles(g,['player-1']);game.startClues(g);game.startVoting(g);const [a,b,c,d]=g.players;game.castVote(g,a.id,[b.id]);game.castVote(g,b.id,[a.id]);game.castVote(g,c.id,[a.id]);game.castVote(g,d.id,[b.id]);game.endVoting(g);assert.equal(g.phase,'revote');game.startRevote(g);for(const voter of game.eligibleVoters(g))game.castVote(g,voter.id,voter.id===a.id||voter.id===c.id?[b.id]:[a.id]);game.endVoting(g);assert.equal(g.phase,'fixed-results');assert.equal(g.eliminatedId,null);assert.deepEqual(g.fixedResult.eliminatedIds,[]);assert.equal(g.winner,'imposters');});
test('fixed final screen shows totals, roles, word translation, winner, and no Next Round',()=>{const g=make({players:names(6),roundMode:'fixed',mode:'different'});forceRoles(g,['player-1']);voteFor(g,'player-1');const html=ui.results(g);assert.match(html,/CIVILIANS WIN/);assert.match(html,/Every Imposter was correctly identified/);assert.match(html,/Vote totals · all players/);assert.match(html,/Imposter/);assert.match(html,/lang="ml"/);assert.match(html,/Imposter word:/);assert.match(html,/data-action="play-again"/);assert.match(html,/data-action="home"/);assert.doesNotMatch(html,/data-action="next-round"|Round draw|Next round/);});
test('fixed Hidden Word final result explains the absent Imposter word',()=>{const g=make({players:names(6),roundMode:'fixed'});forceRoles(g,['player-1']);voteFor(g,'player-2');g.fixedResult.mode='hidden';g.fixedResult.imposterWord=null;g.fixedResult.players.find(p=>p.id==='player-1').word=null;g.fixedResult.players.find(p=>p.id==='player-1').wordMalayalam=null;const html=ui.results(g);assert.match(html,/IMPOSTERS WIN/);assert.match(html,/Hidden Word mode/);assert.match(html,/no word assigned/);assert.match(html,/lang="ml"/);});
test('a fresh game starts from reveal with reset votes and new player objects',()=>{const old=make({players:names(6),roundMode:'fixed'});forceRoles(old,['player-1']);voteFor(old,'player-2');const fresh=game.createGame({players:names(6),categories:ALL_CATEGORIES,roundMode:'fixed'},deterministicCrypto());assert.equal(fresh.phase,'reveal');assert.deepEqual(fresh.votes,{});assert.equal(fresh.completedRounds,0);assert.ok(fresh.players.every(p=>p.alive&&!p.hasVoted));assert.ok(fresh.players.every(p=>!old.players.includes(p)));});
test('Elimination Every Round behavior still advances to clues after a nonterminal result',()=>{const g=make({players:names(6),roundMode:'elimination'});forceRoles(g,['player-1']);voteFor(g,'player-2');assert.equal(g.phase,'results');assert.equal(g.winner,null);game.nextRound(g);assert.equal(g.phase,'clues');assert.equal(g.players.find(p=>p.id==='player-2').alive,false);});
