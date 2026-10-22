import { getPairs, getWords, ALL_CATEGORIES } from './words.js';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;
export function recommendedImposters(count) { return count <= 6 ? 1 : count <= 12 ? 2 : 3; }
export function randomInt(max, cryptoObject = globalThis.crypto) {
  if (!Number.isInteger(max) || max < 1) throw new RangeError('max must be a positive integer');
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { cryptoObject.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}
export function secureShuffle(items, cryptoObject = globalThis.crypto) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1, cryptoObject); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function validateSetup({ players } = {}) {
  const errors = [];
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) errors.push(`Add between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`);
  const clean = Array.isArray(players) ? players.map(n => String(n ?? '').trim()) : [];
  if (clean.some(n => !n)) errors.push('Player names cannot be empty.');
  if (new Set(clean.map(n => n.normalize('NFKC').toLocaleLowerCase())).size !== clean.length) errors.push('Each player needs a unique name.');
  // An empty or stale category selection falls back to the bundled Bible word bank.
  return errors;
}
export function createGame(config, cryptoObject = globalThis.crypto) {
  const names = config?.players;
  const errors = validateSetup({ ...config, players: names });
  if (errors.length) throw new Error(errors.join(' '));
  const players = names.map((name, index) => ({ id: `player-${index + 1}`, name: String(name).trim(), alive: true, role: 'civilian', word: null, hasVoted: false }));
  const imposterCount = recommendedImposters(players.length);
  if (imposterCount < 1 || imposterCount >= players.length) throw new Error('Could not create a valid role assignment.');
  const mode = config.mode ?? (randomInt(2, cryptoObject) ? 'hidden' : 'different');
  const validCategories = Array.isArray(config.categories) ? [...new Set(config.categories.filter(key => ALL_CATEGORIES.includes(key)))] : [];
  const selected = validCategories.length ? validCategories : ALL_CATEGORIES;
  const roles = secureShuffle([...Array(imposterCount).fill('imposter'), ...Array(players.length - imposterCount).fill('civilian')], cryptoObject);
  players.forEach((player, index) => { player.role = roles[index]; });
  let civilianWord, imposterWord = null;
  if (mode === 'different') {
    const pairs = getPairs(selected, config.customWords ?? []);
    if (!pairs.length) throw new Error('No valid word pairs are available for those categories.');
    const pair = pairs[randomInt(pairs.length, cryptoObject)]; civilianWord = pair.civilian; imposterWord = pair.imposter;
  } else if (mode === 'hidden') {
    const words = getWords(selected, config.customWords ?? []);
    if (!words.length) throw new Error('No valid words are available for those categories.');
    civilianWord = words[randomInt(words.length, cryptoObject)];
  } else throw new Error('Unknown game mode.');
  for (const player of players) player.word = player.role === 'imposter' ? imposterWord : civilianWord;
  return { phase: 'reveal', mode, imposterCount, civilianWord, imposterWord, players, revealOrder: secureShuffle(players.map(p => p.id), cryptoObject), revealIndex: 0, round: 1, votes: {}, revote: false, tiedIds: [], eliminatedId: null, lastEliminatedImposter: false, finalGuessUsed: false, finalGuessResult: null, clueIndex: 0, clueOrder: [], timer: { clueSeconds: config.clueSeconds ?? 30, discussionSeconds: config.discussionSeconds ?? 120 }, settings: { finalGuess: !!config.finalGuess }, categories: selected, winner: null, voteResults: null };
}
export function playerById(game, id) { return game.players.find(p => p.id === id); }
export function livingPlayers(game) { return game.players.filter(p => p.alive); }
export function currentRevealPlayer(game) { return playerById(game, game.revealOrder[game.revealIndex]); }
export function advanceReveal(game) {
  if (game.phase !== 'reveal') throw new Error('Not revealing roles.');
  if (++game.revealIndex >= game.revealOrder.length) startClues(game);
  return game;
}
export function startClues(game) { game.phase = 'clues'; game.clueOrder = secureShuffle(livingPlayers(game).map(p => p.id)); game.clueIndex = 0; game.votes = {}; game.voteResults = null; game.eliminatedId = null; game.lastEliminatedImposter = false; game.finalGuessResult = null; game.finalGuessUsed = false; }
export function currentCluePlayer(game) { return playerById(game, game.clueOrder[game.clueIndex]); }
export function nextClue(game) { if (game.phase !== 'clues') throw new Error('Not in clue round.'); if (game.clueIndex + 1 >= game.clueOrder.length) { game.phase = 'discussion'; return; } game.clueIndex++; }
export function startVoting(game) { if (!['clues','discussion','revote'].includes(game.phase)) throw new Error('Cannot start voting now.'); game.phase = 'voting'; game.votes = {}; game.voteResults = null; }
export function eligibleVoters(game) { return livingPlayers(game).filter(p => !game.revote || game.tiedIds.includes(p.id)); }
export function voteTargets(game) { return livingPlayers(game).filter(p => !game.revote || game.tiedIds.includes(p.id)); }
export function castVote(game, voterId, targetId) {
  if (game.phase !== 'voting') throw new Error('Voting is not open.');
  const voter = playerById(game, voterId), target = playerById(game, targetId);
  if (!voter?.alive || (game.revote && !game.tiedIds.includes(voterId))) throw new Error('This player cannot vote.');
  if (game.votes[voterId]) throw new Error('This player has already voted.');
  if (!target?.alive || (!game.revote && targetId === voterId) || (game.revote && !game.tiedIds.includes(targetId))) throw new Error('Invalid vote target.');
  game.votes[voterId] = targetId; voter.hasVoted = true;
}
export function endVoting(game) {
  if (game.phase !== 'voting') throw new Error('Voting is not open.');
  const pool = game.revote ? game.tiedIds : livingPlayers(game).map(p => p.id);
  const counts = Object.fromEntries(pool.map(id => [id, 0]));
  for (const [voter, target] of Object.entries(game.votes)) if (playerById(game, voter)?.alive && counts[target] !== undefined) counts[target]++;
  game.voteResults = counts;
  const max = Math.max(0, ...Object.values(counts));
  const tied = pool.filter(id => counts[id] === max);
  if (tied.length === 1 && max > 0) {
    const eliminated = playerById(game, tied[0]); eliminated.alive = false; eliminated.hasVoted = false; game.eliminatedId = eliminated.id; game.lastEliminatedImposter = eliminated.role === 'imposter';
    game.phase = 'results'; game.revote = false; game.tiedIds = [];
    const winner = checkWinner(game);
    if (winner === 'imposters' && game.settings.finalGuess && eliminated.role === 'imposter') game.winner = null;
  } else if (!game.revote && tied.length > 1) { game.revote = true; game.tiedIds = tied; game.votes = {}; game.voteResults = null; game.phase = 'revote'; }
  else { game.eliminatedId = null; game.revote = false; game.tiedIds = []; game.phase = 'results'; }
  for (const p of game.players) p.hasVoted = false;
  return game.voteResults;
}
export function startRevote(game) { if (game.phase !== 'revote') throw new Error('No revote is pending.'); game.phase = 'voting'; game.votes = {}; }
export function checkWinner(game) {
  const alive = livingPlayers(game), imposters = alive.filter(p => p.role === 'imposter').length, civilians = alive.length - imposters;
  if (imposters === 0) game.winner = 'civilians'; else if (imposters >= civilians) game.winner = 'imposters'; else game.winner = null;
  return game.winner;
}
export function submitFinalGuess(game, guess) {
  if (!game.settings.finalGuess || !game.lastEliminatedImposter || game.finalGuessUsed || !game.eliminatedId) throw new Error('A final guess is not available.');
  game.finalGuessUsed = true;
  const correct = String(guess).trim().toLocaleLowerCase() === game.civilianWord.toLocaleLowerCase();
  game.finalGuessResult = correct ? 'correct' : 'incorrect';
  if (correct) game.winner = 'imposters'; else checkWinner(game);
  game.phase = 'results';
  return correct;
}
export function nextRound(game) { if (game.winner) throw new Error('The game has ended.'); game.round++; startClues(game); }
