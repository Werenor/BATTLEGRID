const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { createFileMatchLog } = require('./file-log');
const { createSession, beginSession, playerFire, aiFire, endPlayerTurn, beginPlayerTurn } = require('../src/session');
const { publicKnowledge, placeShip } = require('../src/board');
const { chooseTargetDecision } = require('../src/ai-targeting');
const { ACTOR, PHASE, SHIP_DEFINITIONS } = require('../src/constants');

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function summarize(session, actor) {
  const entries = session.game.history.filter((entry) => entry.actor === actor);
  const records = fs.readFileSync(session.log.path, 'utf8').trim().split('\n').map(JSON.parse)
    .filter((entry) => entry.type === 'shot' && entry.actor === actor);
  const ratings = {};
  for (const entry of entries) {
    const symbol = entry.review?.symbol || 'unrated';
    ratings[symbol] = (ratings[symbol] || 0) + 1;
  }
  const conflicts = records.filter((entry) => entry.decision?.regret <= 2 && entry.review?.loss >= 15 && !entry.review.openingExploration)
    .map((entry) => ({ round: entry.round, coordinate: entry.result.coordinate,
      mode: entry.decision.mode, regret: entry.decision.regret,
      rating: entry.review.symbol, loss: entry.review.loss,
      recommended: entry.review.bestCoordinate }));
  return {
    shots: entries.length,
    firstHit: entries.findIndex((entry) => entry.outcome !== 'miss') + 1 || null,
    searchMisses: records.filter((entry) => !entry.knowledge.shots.includes('hit') && entry.result.outcome === 'miss').length,
    pursuitMisses: records.filter((entry) => entry.knowledge.shots.includes('hit') && entry.result.outcome === 'miss').length,
    ratings, conflicts,
  };
}

const styles = ['offensive', 'strategic', 'information'];
const layouts = [
  { name: '截图偏边布局', cells: [[1, 9, 17, 25], [5, 6, 7], [39, 47, 55], [51, 52]] },
  { name: '平行贴靠布局', cells: [[18, 26, 34, 42], [19, 27, 35], [20, 28, 36], [43, 44]] },
  { name: '首尾贴靠布局', cells: [[0, 1, 2, 3], [4, 5, 6], [8, 9, 10], [11, 12]] },
];
const report = [];
let number = 0;
for (const layout of layouts) {
  for (const style of styles) {
    const rng = seeded(20261013 + number++);
    const session = createSession({ logger: createFileMatchLog(), aiProfile: {
      placement: { skill: 'expert', style: 'random' },
      targeting: { skill: 'expert', style },
    } }, rng);
    SHIP_DEFINITIONS.forEach((ship, i) => {
      const result = placeShip(session.game.playerBoard, ship.id, layout.cells[i]);
      if (!result.ok) throw new Error(JSON.stringify(result));
    });
    beginSession(session, 'random', rng);
    const start = performance.now();
    while (session.game.phase !== PHASE.FINISHED) {
      switch (session.game.phase) {
        case PHASE.PLAYER_TURN: {
          // Stand-in opponent uses the same public-information targeting rules.
          const decision = chooseTargetDecision(publicKnowledge(session.game.aiBoard),
            { skill: 'expert', style: 'strategic' }, rng);
          playerFire(session, decision.index, decision);
          break;
        }
        case PHASE.PLAYER_END: endPlayerTurn(session); break;
        case PHASE.AI_TURN: aiFire(session, rng); break;
        case PHASE.AI_RESULT: beginPlayerTurn(session); break;
        default: throw new Error(`Unexpected phase ${session.game.phase}`);
      }
    }
    if (session.log.error) throw new Error(session.log.error);
    const item = { layout: layout.name, style, firstPlayer: session.game.firstPlayer,
      outcome: session.game.result, rounds: session.game.round,
      elapsedMs: Math.round(performance.now() - start),
      player: summarize(session, ACTOR.PLAYER), ai: summarize(session, ACTOR.AI),
      log: session.log.path };
    report.push(item);
    console.log(JSON.stringify(item));
  }
}
const destination = path.resolve(__dirname, '..', 'logs', 'simulation-summary.json');
fs.writeFileSync(destination, JSON.stringify({ opponent: 'expert strategic bot, not a human playtest', games: report }, null, 2), 'utf8');
console.log(`REPORT ${destination}`);
