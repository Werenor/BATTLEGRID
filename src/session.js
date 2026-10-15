const { ACTOR, PHASE } = require('./constants');
const { publicKnowledge } = require('./board');
const { chooseAiLayout } = require('./ai-placement');
const { resolveAiProfile } = require('./ai-profile');
const { chooseTargetDecision } = require('./ai-targeting');
const { evaluateMove } = require('./move-review');
const { createMatchLog, logAction } = require('./match-log');
const {
  beginPlayerTurn: beginPlayerTurnState,
  createGame,
  endPlayerTurn: endPlayerTurnState,
  fire,
  startGame,
} = require('./game');

function createSession(options = {}, rng = Math.random) {
  const aiProfile = resolveAiProfile(options.aiProfile, rng);
  const game = createGame({ ...options, aiProfile });
  game.aiBoard = chooseAiLayout(game.aiProfile.placement, rng);
  return {
    game,
    targetingContext: { decisions: [] },
    log: options.logger || (options.log ? createMatchLog() : null),
  };
}

function beginSession(session, firstPlayerChoice, rng = Math.random) {
  const result = startGame(session.game, firstPlayerChoice, rng);
  if (result.ok && session.log) {
    const game = session.game;
    session.log.write({ type: 'start', schema: 1, firstPlayer: game.firstPlayer,
      aiProfile: game.aiProfile,
      playerFleet: game.playerBoard.ships.map(({ length, cells }) => ({ length, cells })),
      aiFleet: game.aiBoard.ships.map(({ length, cells }) => ({ length, cells })),
    });
  }
  return result;
}

function playerFire(session, index, decision = null) {
  const game = session.game;
  if (game.phase !== PHASE.PLAYER_TURN || game.aiBoard.shots[index] !== null) {
    return fire(game, ACTOR.PLAYER, index);
  }
  const knowledge = publicKnowledge(game.aiBoard);
  const review = evaluateMove(knowledge, index);
  const result = fire(game, ACTOR.PLAYER, index);
  if (result.ok) game.history[game.history.length - 1].review = review;
  logAction(session, ACTOR.PLAYER, knowledge, result, decision);
  return result;
}

function aiFire(session, rng = Math.random) {
  if (session.game.phase !== PHASE.AI_TURN) {
    return { ok: false, reason: 'not_actor_turn' };
  }
  const knowledge = publicKnowledge(session.game.playerBoard);
  const decision = chooseTargetDecision(knowledge, session.game.aiProfile.targeting, rng);
  if (!decision) return { ok: false, reason: 'no_available_target' };
  const review = evaluateMove(knowledge, decision.index);
  const result = fire(session.game, ACTOR.AI, decision.index);
  if (result.ok) {
    session.game.history[session.game.history.length - 1].review = review;
    session.targetingContext.decisions.push({
      ...decision,
      outcome: result.outcome,
      round: session.game.round,
      searching: !knowledge.shots.includes('hit'),
    });
  }
  logAction(session, ACTOR.AI, knowledge, result, decision);
  return result;
}

function endPlayerTurn(session) {
  return endPlayerTurnState(session.game);
}

function beginPlayerTurn(session) {
  return beginPlayerTurnState(session.game);
}

module.exports = {
  aiFire,
  beginPlayerTurn,
  beginSession,
  createSession,
  endPlayerTurn,
  playerFire,
};
