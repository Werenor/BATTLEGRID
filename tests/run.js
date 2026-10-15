const assert = require('node:assert/strict');
const { evaluateMove, rateMove, RATINGS } = require('../src/move-review');

const {
  normalizeAiProfile,
  resolveAiProfile,
  validateAiProfile,
} = require('../src/ai-profile');
const { chooseAiLayout } = require('../src/ai-placement');
const {
  buildTargetMaps,
  analyzeKnowledge,
  enumerateFleetLayouts,
  chooseTarget,
  chooseTargetDecision,
  generateConsistentLayout,
  targetScope,
} = require('../src/ai-targeting');
const {
  attack,
  cellsBetween,
  createBoard,
  isBoardReady,
  placeShip,
  publicKnowledge,
  toIndex,
  validEndpoints,
} = require('../src/board');
const {
  ACTOR,
  PHASE,
  PLACEMENT_STYLE,
  SHIP_DEFINITIONS,
  SHOT,
  SKILL,
  TARGETING_STYLE,
} = require('../src/constants');
const {
  beginPlayerTurn,
  createGame,
  endPlayerTurn,
  fire,
  startGame,
} = require('../src/game');
const {
  cancelPlacement,
  clickPlacementCell,
  createPlacementState,
} = require('../src/placement');
const {
  aiFire,
  beginPlayerTurn: beginSessionPlayerTurn,
  beginSession,
  createSession,
  endPlayerTurn: endSessionPlayerTurn,
  playerFire,
} = require('../src/session');
const {
  buildBattleBoardColumn,
  confirmPlayerResult,
  cycleFirstPlayer,
  firstPlayerLabel,
  renderMatch,
  shotPresentation,
} = require('../src/era-page');

const tests = [];
function test(name, callback) {
  tests.push({ callback, name });
}

function sequenceRng(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function placeStandardFleet(board, offset = 0) {
  const placements = [
    [0, 1, 2, 3],
    [8, 9, 10],
    [16, 17, 18],
    [24, 25],
  ].map((cells) => cells.map((cell) => cell + offset));
  SHIP_DEFINITIONS.forEach((ship, index) => {
    assert.equal(placeShip(board, ship.id, placements[index]).ok, true);
  });
}

test('allows ships to touch end-to-end and in parallel', () => {
  const board = createBoard();
  assert.equal(placeShip(board, 'ship-4', [0, 1, 2, 3]).ok, true);
  assert.equal(placeShip(board, 'ship-3a', [4, 5, 6]).ok, true);
  assert.equal(placeShip(board, 'ship-3b', [8, 9, 10]).ok, true);
  assert.equal(placeShip(board, 'ship-2', [11, 12]).ok, true);
  assert.equal(isBoardReady(board), true);
});

test('sinking one touching ship only turns that ship red', () => {
  const board = createBoard();
  placeShip(board, 'ship-4', [0, 1, 2, 3]);
  placeShip(board, 'ship-3a', [4, 5, 6]);
  attack(board, 4);
  [0, 1, 2, 3].forEach((cell) => attack(board, cell));
  assert.deepEqual(board.shots.slice(0, 4), Array(4).fill(SHOT.SUNK));
  assert.equal(board.shots[4], SHOT.HIT);
  assert.equal(board.shots[5], null);
});

test('endpoint selection allows touching but rejects overlap', () => {
  const board = createBoard();
  placeShip(board, 'ship-4', [0, 1, 2, 3]);
  const endpoints = validEndpoints(board, 'ship-3a', toIndex(1, 0));
  assert.ok(endpoints.includes(toIndex(1, 2)));
  assert.ok(!validEndpoints(board, 'ship-3a', toIndex(0, 2)).includes(toIndex(2, 2)));
});

test('rejects repeated attacks', () => {
  const board = createBoard();
  placeShip(board, 'ship-2', [0, 1]);
  assert.equal(attack(board, 7).ok, true);
  assert.deepEqual(attack(board, 7), { ok: false, reason: 'already_attacked' });
});

test('round order alternates and stops immediately on victory', () => {
  const game = createGame();
  placeStandardFleet(game.playerBoard);
  placeStandardFleet(game.aiBoard);
  assert.equal(startGame(game, ACTOR.PLAYER).ok, true);
  assert.equal(game.phase, PHASE.PLAYER_TURN);
  assert.equal(fire(game, ACTOR.PLAYER, 63).ok, true);
  assert.equal(game.phase, PHASE.PLAYER_END);
  assert.deepEqual(fire(game, ACTOR.AI, 63), { ok: false, reason: 'not_actor_turn' });
  assert.equal(endPlayerTurn(game).ok, true);
  assert.equal(game.phase, PHASE.AI_TURN);
  assert.equal(fire(game, ACTOR.AI, 63).ok, true);
  assert.equal(game.phase, PHASE.AI_RESULT);
  assert.deepEqual(fire(game, ACTOR.PLAYER, 62), { ok: false, reason: 'not_actor_turn' });
  assert.equal(beginPlayerTurn(game).ok, true);
  assert.equal(game.phase, PHASE.PLAYER_TURN);
  assert.equal(game.round, 2);
  [0, 1, 2, 3, 8, 9, 10, 16, 17, 18, 24, 25].forEach((cell, index, cells) => {
    const result = fire(game, ACTOR.PLAYER, cell);
    if (index === cells.length - 1) {
      assert.equal(result.gameOver, true);
      assert.equal(game.phase, PHASE.FINISHED);
    } else {
      assert.equal(result.gameOver, false);
      endPlayerTurn(game);
      fire(game, ACTOR.AI, 62 - index);
      beginPlayerTurn(game);
    }
  });
  assert.deepEqual(fire(game, ACTOR.AI, 30), { ok: false, reason: 'not_actor_turn' });
});

test('AI-first games traverse every explicit phase before advancing the round', () => {
  const game = createGame();
  placeStandardFleet(game.playerBoard);
  placeStandardFleet(game.aiBoard);
  startGame(game, ACTOR.AI);
  assert.equal(game.round, 1);
  assert.equal(game.phase, PHASE.AI_TURN);
  fire(game, ACTOR.AI, 63);
  assert.equal(game.phase, PHASE.AI_RESULT);
  beginPlayerTurn(game);
  assert.equal(game.phase, PHASE.PLAYER_TURN);
  assert.equal(game.round, 1);
  fire(game, ACTOR.PLAYER, 63);
  assert.equal(game.phase, PHASE.PLAYER_END);
  endPlayerTurn(game);
  assert.equal(game.phase, PHASE.AI_TURN);
  assert.equal(game.round, 2);
});

test('expert and weak skill cannot be combined in one profile', () => {
  const invalid = validateAiProfile({
    placement: { skill: SKILL.WEAK, style: PLACEMENT_STYLE.EDGE },
    targeting: { skill: SKILL.EXPERT, style: TARGETING_STYLE.OFFENSIVE },
  });
  assert.deepEqual(invalid, { ok: false, reason: 'skill_gap_too_large' });
  assert.equal(validateAiProfile(normalizeAiProfile()).ok, true);
});

test('AI placement always produces a complete non-overlapping fleet', () => {
  const board = chooseAiLayout(
    { skill: SKILL.WEAK, style: PLACEMENT_STYLE.CLUSTERED },
    sequenceRng([0.13, 0.71, 0.42, 0.91, 0.27]),
  );
  assert.equal(isBoardReady(board), true);
  const cells = board.ships.flatMap((ship) => ship.cells);
  assert.equal(new Set(cells).size, 12);
});

test('random AI preferences resolve before placement and remain concrete for the match', () => {
  const profile = resolveAiProfile(
    normalizeAiProfile(),
    sequenceRng([0.99, 0.99]),
  );
  assert.notEqual(profile.placement.style, PLACEMENT_STYLE.RANDOM);
  assert.notEqual(profile.targeting.style, TARGETING_STYLE.RANDOM);
  assert.equal(profile.targeting.style, TARGETING_STYLE.INFORMATION);
});

test('consistent fleet layouts explain every yellow hit without covering known water', () => {
  const board = createBoard();
  placeStandardFleet(board);
  attack(board, 0);
  attack(board, 7);
  const knowledge = publicKnowledge(board);
  const layout = generateConsistentLayout(
    knowledge,
    sequenceRng([0.2, 0.8, 0.4, 0.6, 0.1, 0.9]),
  );
  assert.ok(layout);
  const occupied = new Set(layout.flat());
  assert.equal(occupied.has(0), true);
  assert.equal(occupied.has(7), false);
});

test('all targeting personalities only choose an unknown cell', () => {
  const board = createBoard();
  placeStandardFleet(board);
  attack(board, 0);
  attack(board, 7);
  const knowledge = publicKnowledge(board);
  for (const style of [
    TARGETING_STYLE.OFFENSIVE,
    TARGETING_STYLE.STRATEGIC,
    TARGETING_STYLE.INFORMATION,
  ]) {
    const target = chooseTarget(
      knowledge,
      { sampleCount: 40, skill: SKILL.COMPETENT, style },
      sequenceRng([0.31, 0.79, 0.17, 0.63, 0.48]),
    );
    assert.equal(knowledge.shots[target], null);
  }
});

test('target maps distinguish hit, immediate sink, and information value', () => {
  const knowledge = {
    remainingShips: [2],
    shots: Array(64).fill(null),
  };
  knowledge.shots[0] = SHOT.HIT;
  const maps = buildTargetMaps(knowledge, [
    [[0, 1]],
    [[0, 8]],
  ]);
  assert.equal(maps.hit[1], 0.5);
  assert.equal(maps.sink[1], 0.5);
  assert.equal(maps.information[1], 0.5);
  assert.equal(maps.hit[9], 0);
  assert.equal(maps.information[9], 0);
});

test('target decisions expose candidate quality and decision loss for balancing', () => {
  const board = createBoard();
  placeStandardFleet(board);
  attack(board, 0);
  attack(board, 7);
  const decision = chooseTargetDecision(
    publicKnowledge(board),
    {
      candidateNoise: 0,
      sampleCount: 50,
      skill: SKILL.WEAK,
      style: TARGETING_STYLE.INFORMATION,
    },
    sequenceRng([0.23, 0.81, 0.47, 0.65, 0.12, 0.94]),
  );
  assert.ok(decision.candidates.length >= 1 && decision.candidates.length <= 6);
  assert.ok(['pursuit', 'finish'].includes(decision.mode));
  assert.ok(decision.chosenQuality <= decision.bestQuality);
  assert.equal(decision.regret, decision.bestQuality - decision.chosenQuality);
});

test('all personalities finish an exposed ship instead of searching elsewhere', () => {
  const knowledge = { remainingShips: [4], shots: Array(64).fill(null) };
  [9, 17, 25].forEach((cell) => { knowledge.shots[cell] = SHOT.HIT; });
  knowledge.shots[33] = SHOT.MISS;
  for (const style of [TARGETING_STYLE.OFFENSIVE, TARGETING_STYLE.STRATEGIC, TARGETING_STYLE.INFORMATION]) {
    const decision = chooseTargetDecision(knowledge, {
      skill: SKILL.EXPERT, style, sampleCount: 30,
    }, sequenceRng([0.23, 0.81, 0.47, 0.65, 0.12, 0.94]));
    assert.equal(decision.index, 1, 'B1 is the only possible finishing shot');
    assert.equal(decision.mode, 'finish');
  }
});

test('information AI stays with wounded ships even with noisy candidate selection', () => {
  const knowledge = { remainingShips: [3, 2], shots: Array(64).fill(null) };
  knowledge.shots[27] = SHOT.HIT;
  const decision = chooseTargetDecision(knowledge, {
    skill: SKILL.EXPERT, style: TARGETING_STYLE.INFORMATION,
    sampleCount: 40, candidateNoise: 100,
  }, sequenceRng([0.23, 0.81, 0.47, 0.65, 0.12, 0.94]));
  assert.equal(decision.mode, 'pursuit');
  for (const { cell } of decision.candidates) {
    const row = Math.floor(cell / 8), column = cell % 8;
    assert.ok((row === 3 && Math.abs(column - 3) <= 2) ||
      (column === 3 && Math.abs(row - 3) <= 2));
  }
});

test('touching yellow cells can belong to different wounded ships', () => {
  const knowledge = { remainingShips: [2, 2], shots: Array(64).fill(null) };
  knowledge.shots[0] = SHOT.HIT;
  knowledge.shots[1] = SHOT.HIT;
  const maps = buildTargetMaps(knowledge, [
    [[0, 8], [1, 2]],
    [[0, 8], [1, 9]],
  ]);
  const scope = targetScope(maps, knowledge);
  assert.equal(scope.mode, 'finish');
  assert.deepEqual(scope.cells, [8]);
  assert.equal(maps.pursuit[2], 0.5);
  assert.equal(maps.pursuit[9], 0.5);
  const layout = generateConsistentLayout(knowledge, sequenceRng([0.23, 0.81, 0.47, 0.65, 0.12, 0.94]));
  assert.ok(layout);
  assert.ok(layout.every((ship) => !ship.every((cell) => knowledge.shots[cell] === SHOT.HIT)),
    'a fully hit ship would already be red, not yellow');
});

test('cellsBetween creates an inclusive straight line', () => {
  assert.deepEqual(cellsBetween(toIndex(2, 1), toIndex(2, 4)), [17, 18, 19, 20]);
  assert.deepEqual(cellsBetween(toIndex(1, 3), toIndex(4, 3)), [11, 19, 27, 35]);
});

test('review rewards routine finishing without inventing a brilliant move', () => {
  const knowledge = { remainingShips: [2], shots: Array(64).fill(null) };
  knowledge.shots[0] = SHOT.HIT;
  const maps = buildTargetMaps(knowledge, [[[0, 1]]]);
  const finish = rateMove(knowledge, 1, maps);
  assert.equal(finish.symbol, '!');
  assert.equal(finish.loss, 0);
  assert.equal(finish.bestCoordinate, 'B1');
  assert.equal(rateMove(knowledge, 63, maps).symbol, '??');
});

test('a worse but legal pursuit direction is not classified as a serious mistake', () => {
  const knowledge = { remainingShips: [4], shots: Array(64).fill(null) };
  knowledge.shots[0] = SHOT.HIT;
  const layouts = Array.from({ length: 9 }, () => [[0, 1, 2, 3]]);
  layouts.push([[0, 8, 16, 24]]);
  const maps = buildTargetMaps(knowledge, layouts);
  const rating = rateMove(knowledge, 8, maps);
  assert.ok(['i', '?!'].includes(rating.symbol));
});

test('routine consecutive hits are normal moves and finishing is rewarded once', () => {
  const knowledge = { remainingShips: [4], shots: Array(64).fill(null) };
  const layout = [[[0, 1, 2, 3]]];
  knowledge.shots[0] = SHOT.HIT;
  assert.equal(rateMove(knowledge, 1, buildTargetMaps(knowledge, layout)).symbol, 'i');
  knowledge.shots[1] = SHOT.HIT;
  assert.equal(rateMove(knowledge, 2, buildTargetMaps(knowledge, layout)).symbol, 'i');
  knowledge.shots[2] = SHOT.HIT;
  assert.equal(rateMove(knowledge, 3, buildTargetMaps(knowledge, layout)).symbol, '!');
});

test('ordinary probing between comparable wounded-ship directions is a normal move', () => {
  const knowledge = { remainingShips: [3], shots: Array(64).fill(null) };
  knowledge.shots[0] = SHOT.HIT;
  const maps = buildTargetMaps(knowledge, [[[0, 1, 2]], [[0, 8, 16]]]);
  assert.equal(rateMove(knowledge, 1, maps).symbol, 'i');
  assert.equal(rateMove(knowledge, 8, maps).symbol, 'i');
});

test('review is deterministic and only needs public knowledge', () => {
  const knowledge = { remainingShips: [2], shots: Array(64).fill(null) };
  knowledge.shots[0] = SHOT.HIT;
  knowledge.shots[8] = SHOT.MISS;
  const before = JSON.stringify(knowledge);
  assert.deepEqual(evaluateMove(knowledge, 1), evaluateMove(knowledge, 1));
  assert.equal(JSON.stringify(knowledge), before);
  assert.equal(evaluateMove(knowledge, 1).symbol, '!');
});

test('exact enumeration covers two and three touching ships without duplicate ship labels', () => {
  const knowledge = { remainingShips: [2, 2], shots: Array(64).fill(SHOT.MISS) };
  [0, 1, 8, 9].forEach((cell) => { knowledge.shots[cell] = null; });
  const result = enumerateFleetLayouts(knowledge);
  assert.equal(result.complete, true);
  assert.equal(result.layouts.length, 2);
  knowledge.shots[0] = SHOT.HIT;
  knowledge.shots[1] = SHOT.HIT;
  assert.equal(enumerateFleetLayouts(knowledge).layouts.length, 1);
  const three = { remainingShips: [2, 2, 2], shots: Array(64).fill(SHOT.MISS) };
  [0, 1, 2, 3, 4, 5].forEach((cell) => { three.shots[cell] = null; });
  assert.equal(enumerateFleetLayouts(three).layouts.length, 1);
  assert.equal(analyzeKnowledge(three).method, 'exact');
});

test('budget exhaustion discards incomplete enumeration and uses sampled analysis', () => {
  const knowledge = { remainingShips: [2, 2], shots: Array(64).fill(null) };
  const result = enumerateFleetLayouts(knowledge, { maxNodes: 1 });
  assert.equal(result.complete, false);
  assert.deepEqual(result.layouts, []);
  const analysis = analyzeKnowledge(knowledge, { maxNodes: 1, sampleCount: 20 });
  assert.equal(analysis.method, 'sampled');
  assert.equal(analysis.count, 20);
  assert.equal(analysis.maps.allowFinish, false);
});

test('uncertain samples cannot turn a tolerated decision into a brilliant rating', () => {
  const knowledge = { remainingShips: [2], shots: Array(64).fill(null) };
  knowledge.shots[0] = SHOT.HIT;
  const maps = buildTargetMaps(knowledge, [[[0, 1]], [[0, 1]], [[0, 8]]]);
  assert.equal(rateMove(knowledge, 1, maps, 80).symbol, 'i');
});

test('AI targeting and review share exact analysis and retain small absolute probability differences', () => {
  const knowledge = { remainingShips: [2], shots: Array(64).fill(null) };
  [0, 1].forEach((cell) => { knowledge.shots[cell] = SHOT.SUNK; });
  const analysis = analyzeKnowledge(knowledge);
  assert.equal(analysis.method, 'exact');
  assert.equal(analyzeKnowledge(knowledge), analysis);
  const decision = chooseTargetDecision(knowledge, { skill: SKILL.EXPERT, style: TARGETING_STYLE.INFORMATION });
  const review = evaluateMove(knowledge, decision.index);
  assert.equal(review.analysisMethod, decision.analysisMethod);
  assert.equal(review.samples, decision.layoutsConsidered);
  assert.equal(review.uncertainty, 0);
  assert.notEqual(evaluateMove(knowledge, 63).symbol, '??');
});

test('zero-information exploration is reasonable in every square despite sampled priors', () => {
  const knowledge = { remainingShips: [4, 3, 3, 2], shots: Array(64).fill(null) };
  const maps = buildTargetMaps(knowledge, [[[27, 28, 29, 30], [8, 9, 10], [16, 17, 18], [40, 41]]]);
  for (let cell = 0; cell < 64; cell += 1) {
    const rating = rateMove(knowledge, cell, maps);
    assert.equal(rating.symbol, 'i');
    assert.equal(rating.openingExploration, true);
  }
  const corner = evaluateMove(knowledge, 63);
  assert.equal(corner.symbol, 'i');
});

test('opening misses allow exploration but publicly impossible squares are still errors', () => {
  const knowledge = { remainingShips: [2], shots: Array(64).fill(null) };
  knowledge.shots[1] = SHOT.MISS;
  knowledge.shots[8] = SHOT.MISS;
  const maps = buildTargetMaps(knowledge, [[[27, 28]]]);
  assert.equal(rateMove(knowledge, 63, maps).symbol, 'i');
  assert.equal(rateMove(knowledge, 0, maps).symbol, '??');
  assert.equal(rateMove(knowledge, 1, maps), null);
});

test('live reports color only the review mark and hide recommendation details', () => {
  const entry = { actor: ACTOR.PLAYER, coordinate: 'C3', outcome: SHOT.MISS,
    review: { symbol: '?!', ...RATINGS['?!'], bestCoordinate: 'B1', quality: 70 } };
  const content = require('../src/era-page').historyContent(entry);
  assert.equal(content[0].color, RATINGS['?!'].color);
  assert.equal(content[1].color, '#ffffff');
  assert.equal(content[1].content, '你攻击 C3——未命中。');
  assert.equal(JSON.stringify(content).includes('B1'), false);
});

test('settlement opens review and returns to settings without modifying history', async () => {
  const game = createGame();
  game.phase = PHASE.FINISHED;
  game.result = 'player_win';
  game.history.push({ round: 1, actor: ACTOR.PLAYER, coordinate: 'B1', outcome: SHOT.SUNK, shipLength: 2,
    review: { symbol: 'i', ...RATINGS.i, quality: 100, bestQuality: 100, loss: 0, bestCoordinate: 'B1', reason: '优先收尾。' } });
  const before = JSON.stringify(game.history);
  const inputs = [960, 970, 961];
  const lines = [];
  const era = { clear: async () => {}, drawLine: () => {},
    print: (content) => lines.push(content), printInColRows: () => {}, printButton: () => {},
    input: async () => { assert.ok(inputs.length); return inputs.shift(); } };
  await require('../src/era-page').showSettlement(era, game);
  assert.ok(lines.some((line) => typeof line === 'string' && line.includes('推荐 B1')));
  assert.equal(JSON.stringify(game.history), before);
  assert.equal(inputs.length, 0);
});

test('cancelling a first endpoint keeps existing ships unchanged', () => {
  const board = createBoard();
  const state = createPlacementState(board);
  assert.equal(clickPlacementCell(board, state, toIndex(0, 0)).ok, true);
  assert.equal(state.firstEndpoint, toIndex(0, 0));
  assert.equal(cancelPlacement(board, state).ok, true);
  assert.equal(state.firstEndpoint, null);
  assert.equal(board.ships.every((ship) => ship.cells.length === 0), true);
});

test('cancelling reposition restores the ship to its original cells', () => {
  const board = createBoard();
  placeShip(board, 'ship-4', [0, 1, 2, 3]);
  const state = createPlacementState(board);
  assert.equal(clickPlacementCell(board, state, 1).ok, true);
  assert.deepEqual(board.ships[0].cells, []);
  assert.equal(clickPlacementCell(board, state, toIndex(4, 0)).ok, true);
  assert.equal(cancelPlacement(board, state).ok, true);
  assert.deepEqual(board.ships[0].cells, [0, 1, 2, 3]);
});

test('a session connects AI placement, alternating fire, and public targeting', () => {
  const rng = sequenceRng([0.12, 0.84, 0.33, 0.67, 0.48, 0.91]);
  const session = createSession({}, rng);
  placeStandardFleet(session.game.playerBoard);
  assert.equal(beginSession(session, ACTOR.PLAYER, rng).ok, true);
  assert.equal(playerFire(session, 63).ok, true);
  assert.equal(session.game.phase, PHASE.PLAYER_END);
  assert.equal(endSessionPlayerTurn(session).ok, true);
  const result = aiFire(session, rng);
  assert.equal(result.ok, true);
  assert.equal(session.game.playerBoard.shots[result.index] !== null, true);
  assert.equal(session.game.phase, PHASE.AI_RESULT);
  assert.equal(beginSessionPlayerTurn(session).ok, true);
  assert.equal(session.game.phase, PHASE.PLAYER_TURN);
});

test('first-player button cycles player, opponent, and random', () => {
  assert.equal(cycleFirstPlayer(ACTOR.PLAYER), ACTOR.AI);
  assert.equal(cycleFirstPlayer(ACTOR.AI), 'random');
  assert.equal(cycleFirstPlayer('random'), ACTOR.PLAYER);
  assert.equal(firstPlayerLabel('random'), '随机');
});

test('match logs capture pre-shot public knowledge and skip rejected actions', () => {
  const records = [];
  const logger = { ended: false, write: (record) => records.push(record) };
  const rng = sequenceRng([0.12, 0.84, 0.33, 0.67, 0.48, 0.91]);
  const session = createSession({ logger }, rng);
  placeStandardFleet(session.game.playerBoard);
  beginSession(session, ACTOR.PLAYER, rng);
  const result = playerFire(session, 63);
  assert.equal(result.ok, true);
  assert.equal(records[0].type, 'start');
  assert.equal(records[1].type, 'shot');
  assert.equal(records[1].knowledge.shots[63], null);
  assert.equal(records[1].result.index, 63);
  assert.ok(records[1].review);
  assert.equal(playerFire(session, 63).ok, false);
  assert.equal(records.length, 2);
  require('../src/match-log').finishMatchLog(session);
  require('../src/match-log').finishMatchLog(session);
  assert.equal(records.filter((entry) => entry.type === 'finish').length, 1);
});

test('engine logging persists through supported APIs without importing built-in libraries', async () => {
  const records = [];
  const era = {
    get: (key) => { assert.equal(key, 'global:0'); return 0; },
    set: (key, value) => { assert.equal(key, 'global:0'); records.push(JSON.parse(value)); },
    saveGlobal: async () => true,
  };
  const log = require('../src/match-log').createEngineMatchLog(era);
  const record = { type: 'shot', knowledge: { shots: [null] } };
  log.write(record);
  record.knowledge.shots[0] = SHOT.HIT;
  await log.pending;
  assert.equal(log.error, null);
  assert.equal(records[0][0].records[0].knowledge.shots[0], null);
  log.write({ type: 'finish' });
  await log.pending;
  assert.equal(records.at(-1)[0].records.length, 2);
});

test('shot presentation uses the agreed blue, yellow, red states', () => {
  assert.equal(shotPresentation(SHOT.MISS).color, '#409eff');
  assert.equal(shotPresentation(SHOT.HIT).color, '#e6a23c');
  assert.equal(shotPresentation(SHOT.SUNK).color, '#f56c6c');
  assert.equal(shotPresentation(null).color, '#8c8c8c');
});

test('battle boards are built as equal-width columns for side-by-side rendering', () => {
  const board = createBoard();
  placeStandardFleet(board);
  const own = buildBattleBoardColumn(board, { revealShips: true, title: '我方海域' });
  const enemy = buildBattleBoardColumn(board, { interactive: true, title: '敌方海域' });
  assert.equal(own.config.width, 12);
  assert.equal(enemy.config.width, 12);
  assert.equal(own.columns[0].content, '我方海域');
  assert.equal(enemy.columns[0].content, '敌方海域');
  assert.equal(
    enemy.columns.some((entry) => entry.type === 'button' && entry.accelerator >= 200),
    true,
  );
});

test('player result is flushed and delayed without requesting another input', async () => {
  const game = createGame();
  placeStandardFleet(game.playerBoard);
  placeStandardFleet(game.aiBoard);
  startGame(game, ACTOR.PLAYER);
  fire(game, ACTOR.PLAYER, 63);
  let endTurnInputs = 0;
  const events = [];
  const era = {
    clear: async (count) => events.push(count === 0 ? 'ack' : 'clear'),
    delay: async (ms) => {
      assert.equal(game.phase, PHASE.PLAYER_END);
      assert.equal(game.history.length, 1);
      events.push(`delay:${ms}`);
    },
    drawLine: () => {},
    input: async () => {
      endTurnInputs += 1;
      return 980;
    },
    print: (content, config) => {
      if (content.includes('你攻击 H8') && config?.flush) events.push('result-flushed');
    },
    printButton: () => assert.fail('result frame must contain no end-turn button'),
    printInColRows: () => {},
  };
  await confirmPlayerResult(era, game);
  assert.equal(endTurnInputs, 0);
  assert.deepEqual(events, ['clear', 'result-flushed', 'ack', 'delay:750']);
  assert.equal(game.phase, PHASE.PLAYER_END);
  assert.equal(endPlayerTurn(game).ok, true);
  assert.equal(game.phase, PHASE.AI_TURN);
});

test('battle frame no longer contains an end-turn button', () => {
  const game = createGame();
  placeStandardFleet(game.playerBoard);
  placeStandardFleet(game.aiBoard);
  startGame(game, ACTOR.PLAYER);
  fire(game, ACTOR.PLAYER, 63);
  const order = [];
  const era = {
    drawLine: (config) => {
      if (config?.content === '上一轮') order.push('report');
    },
    print: () => {},
    printButton: (content, accelerator, config) => {
      if (content === '结束回合') order.push(`button:${config.align}:${config.disabled}`);
    },
    printInColRows: () => {},
  };
  renderMatch(era, game, false, null, true);
  assert.deepEqual(order, ['report']);
});

test('thinking is displayed as centered text during the AI turn', () => {
  const game = createGame();
  game.phase = PHASE.AI_TURN;
  const lines = [];
  const era = {
    drawLine: () => {},
    printInColRows: () => {},
    print: (content, config) => lines.push({ content, config }),
    printButton: () => assert.fail('AI frame must contain no end-turn button'),
  };
  renderMatch(era, game, false);
  const thinking = lines.find((line) => line.content === '思考中……');
  assert.equal(thinking.config.align, 'center');
  assert.equal(thinking.config.flush, true);
});

async function run() {
  let failures = 0;
  for (const { callback, name } of tests) {
    try {
      await callback();
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    }
  }

  if (failures) process.exitCode = 1;
  else process.stdout.write(`\n${tests.length} tests passed.\n`);
}

run();
