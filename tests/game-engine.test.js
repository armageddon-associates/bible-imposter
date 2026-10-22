import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../js/game-engine.js';
import * as ui from '../js/ui.js';
import { ALL_CATEGORIES, getPairs, getWords } from '../js/words.js';

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
  for(const voter of game.eligibleVoters(g)) game.castVote(g,voter.id,a.id);
  game.endVoting(g); assert.equal(g.phase,'results'); assert.equal(g.eliminatedId,a.id); assert.equal(a.alive,false);
});
test('revote tie eliminates no one and can continue to another round', () => {
  const g=make({players:names(4),imposterCount:1}); openVoting(g);
  const [a,b,c,d]=game.livingPlayers(g);
  game.castVote(g,a.id,b.id); game.castVote(g,b.id,a.id); game.castVote(g,c.id,a.id); game.castVote(g,d.id,b.id); game.endVoting(g); game.startRevote(g);
  game.castVote(g,a.id,b.id); game.castVote(g,b.id,a.id); game.endVoting(g);
  assert.equal(g.phase,'results'); assert.equal(g.eliminatedId,null); assert.equal(game.livingPlayers(g).length,4);
  game.nextRound(g); assert.equal(g.round,2); assert.equal(g.phase,'clues'); assert.deepEqual(g.votes,{});
});
test('counts abstentions as no vote and applies civilian and parity victory', () => {
  const g=make({players:names(4)}); openVoting(g);
  const imposter=g.players.find(p=>p.role==='imposter'), [a,b]=game.livingPlayers(g).filter(p=>p.role==='civilian');
  game.castVote(g,a.id,imposter.id); game.castVote(g,b.id,imposter.id); game.endVoting(g);
  assert.equal(g.voteResults[imposter.id],2); assert.equal(g.eliminatedId,imposter.id); assert.equal(g.winner,'civilians');
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
  assert.ok(getWords(['concepts'],['Faith',' faith ','Hope']).includes('Faith'));
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
  assert.match(valid,/Ready to play! The game will automatically choose the Bible word, game mode, and Imposters/);
  assert.doesNotMatch(valid,/imposter-plus|imposter-minus|custom-words|Custom Bible words/);
  assert.match(ui.setup({...base,players:['Alex','Alex','Jordan']}).match(/<button class="button primary" data-action="start-game"[^>]*>/)?.[0]??'',/disabled/);
  assert.doesNotMatch(ui.setup({...base,players:['Alex','Casey','Jordan']}),/data-action="start-game" disabled/);
  assert.match(ui.setup({...base,categories:['removed-category']}),/Using the complete Bible word bank/);
});
