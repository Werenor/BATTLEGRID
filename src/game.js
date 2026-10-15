const { ACTOR, OUTCOME, PHASE } = require('./constants');
const { areAllShipsSunk, attack, createBoard, isBoardReady } = require('./board');
const { normalizeAiProfile, validateAiProfile } = require('./ai-profile');

function createGame(options = {}) {
  const aiProfile = normalizeAiProfile(options.aiProfile);
  const validation = validateAiProfile(aiProfile);
  if (!validation.ok) throw new Error(`Invalid AI profile: ${validation.reason}`);
  return {
    aiBoard: createBoard(),
    aiProfile,
    firstPlayer: null,
    history: [],
    phase: PHASE.PLACEMENT,
    playerBoard: createBoard(),
    result: null,
    round: 1,
  };
}

function resolveFirstPlayer(choice, rng = Math.random) {
  if (choice === ACTOR.PLAYER || choice === ACTOR.AI) return choice;
  if (choice !== 'random') throw new Error(`Unknown first-player choice: ${choice}`);
  return rng() < 0.5 ? ACTOR.PLAYER : ACTOR.AI;
}

function startGame(game, firstPlayerChoice = ACTOR.PLAYER, rng = Math.random) {
  if (!isBoardReady(game.playerBoard) || !isBoardReady(game.aiBoard)) {
    return { ok: false, reason: 'boards_not_ready' };
  }
  game.firstPlayer = resolveFirstPlayer(firstPlayerChoice, rng);
  game.phase =
    game.firstPlayer === ACTOR.PLAYER ? PHASE.PLAYER_TURN : PHASE.AI_TURN;
  game.round = 1;
  return { firstPlayer: game.firstPlayer, ok: true };
}

function fire(game, actor, index) {
  const expectedPhase = actor === ACTOR.PLAYER ? PHASE.PLAYER_TURN : PHASE.AI_TURN;
  if (game.phase !== expectedPhase) return { ok: false, reason: 'not_actor_turn' };

  const targetBoard = actor === ACTOR.PLAYER ? game.aiBoard : game.playerBoard;
  const result = attack(targetBoard, index);
  if (!result.ok) return result;

  game.history.push({ actor, round: game.round, ...result });
  if (areAllShipsSunk(targetBoard)) {
    game.phase = PHASE.FINISHED;
    game.result = actor === ACTOR.PLAYER ? OUTCOME.PLAYER_WIN : OUTCOME.AI_WIN;
    return { ...result, gameOver: true, result: game.result };
  }

  game.phase = actor === ACTOR.PLAYER ? PHASE.PLAYER_END : PHASE.AI_RESULT;
  return { ...result, gameOver: false };
}

function endPlayerTurn(game) {
  if (game.phase !== PHASE.PLAYER_END) {
    return { ok: false, reason: 'player_action_not_resolved' };
  }
  if (game.firstPlayer === ACTOR.AI) game.round += 1;
  game.phase = PHASE.AI_TURN;
  return { ok: true };
}

function beginPlayerTurn(game) {
  if (game.phase !== PHASE.AI_RESULT) {
    return { ok: false, reason: 'ai_action_not_resolved' };
  }
  if (game.firstPlayer === ACTOR.PLAYER) game.round += 1;
  game.phase = PHASE.PLAYER_TURN;
  return { ok: true };
}

function surrender(game) {
  if (game.phase === PHASE.FINISHED) return { ok: false, reason: 'already_finished' };
  game.phase = PHASE.FINISHED;
  game.result = OUTCOME.SURRENDER;
  return { ok: true, result: game.result };
}

module.exports = {
  beginPlayerTurn,
  createGame,
  endPlayerTurn,
  fire,
  resolveFirstPlayer,
  startGame,
  surrender,
};
