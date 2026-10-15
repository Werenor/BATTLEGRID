const BOARD_SIZE = 8;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

const SHIP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'ship-4', length: 4 }),
  Object.freeze({ id: 'ship-3a', length: 3 }),
  Object.freeze({ id: 'ship-3b', length: 3 }),
  Object.freeze({ id: 'ship-2', length: 2 }),
]);

const SHOT = Object.freeze({
  MISS: 'miss',
  HIT: 'hit',
  SUNK: 'sunk',
});

const PHASE = Object.freeze({
  PLACEMENT: 'placement',
  PLAYER_TURN: 'player_turn',
  PLAYER_END: 'player_end',
  AI_TURN: 'ai_turn',
  AI_RESULT: 'ai_result',
  FINISHED: 'finished',
});

const ACTOR = Object.freeze({
  PLAYER: 'player',
  AI: 'ai',
});

const OUTCOME = Object.freeze({
  PLAYER_WIN: 'player_win',
  AI_WIN: 'ai_win',
  SURRENDER: 'surrender',
  ABORTED: 'aborted',
});

const SKILL = Object.freeze({
  WEAK: 'weak',
  COMPETENT: 'competent',
  EXPERT: 'expert',
});

const PLACEMENT_STYLE = Object.freeze({
  RANDOM: 'random',
  BALANCED: 'balanced',
  DISPERSED: 'dispersed',
  CLUSTERED: 'clustered',
  EDGE: 'edge',
  CORNER: 'corner',
});

const TARGETING_STYLE = Object.freeze({
  RANDOM: 'random',
  OFFENSIVE: 'offensive',
  STRATEGIC: 'strategic',
  INFORMATION: 'information',
});

module.exports = {
  ACTOR,
  BOARD_SIZE,
  CELL_COUNT,
  OUTCOME,
  PLACEMENT_STYLE,
  PHASE,
  SHIP_DEFINITIONS,
  SKILL,
  SHOT,
  TARGETING_STYLE,
};
