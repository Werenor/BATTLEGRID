const fs = require('fs');
const path = require('path');
const { createSession, beginSession, playerFire, aiFire, endPlayerTurn, beginPlayerTurn } = require('../src/session');
const { chooseAiLayout } = require('../src/ai-placement');
const { chooseTargetDecision } = require('../src/ai-targeting');
const { publicKnowledge } = require('../src/board');
const { ACTOR, PHASE } = require('../src/constants');
const { createFileMatchLog } = require('./file-log');

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function summary(history, actor) {
  const moves = history.filter((entry) => entry.actor === actor);
  const rated = moves.filter((entry) => entry.review);
  const positive = (entry) => ['!', '!!'].includes(entry.review?.symbol);
  const good = rated.filter(positive);
  const early = moves.slice(0, 16).filter((entry) => positive(entry) &&
    !entry.review.reason.includes('及时抓住'));
  return { shots: moves.length, rated: rated.length, good: good.length,
    goodRate: rated.length ? good.length / rated.length : 0,
    goodNonFinish: good.filter((entry) => !entry.review.reason.includes('及时抓住')).length,
    earlyNonFinish: early.length };
}
const games = [];
const styles = ['offensive', 'strategic', 'information'];
const placements = ['balanced', 'dispersed', 'clustered', 'edge', 'corner'];
let pair = 0;
for (const skill of ['competent', 'expert']) {
  for (const playerStyle of styles) for (const aiStyle of styles) {
    const seed = 2026101400 + pair++;
    const playerLayout = chooseAiLayout({ skill: 'competent', style: placements[(pair - 1) % 5] }, seeded(seed));
    const aiLayout = chooseAiLayout({ skill: 'competent', style: placements[(pair + 1) % 5] }, seeded(seed + 1000));
    for (const firstPlayer of [ACTOR.PLAYER, ACTOR.AI]) {
      const playerRng = seeded(seed + 2000), aiRng = seeded(seed + 3000);
      const session = createSession({ logger: createFileMatchLog(), aiProfile: {
        placement: { skill: 'competent', style: placements[(pair + 1) % 5] },
        targeting: { skill, style: aiStyle },
      } }, seeded(seed));
      session.game.playerBoard = JSON.parse(JSON.stringify(playerLayout));
      session.game.aiBoard = JSON.parse(JSON.stringify(aiLayout));
      beginSession(session, firstPlayer);
      while (session.game.phase !== PHASE.FINISHED) {
        switch (session.game.phase) {
          case PHASE.PLAYER_TURN: {
            const decision = chooseTargetDecision(publicKnowledge(session.game.aiBoard),
              { skill, style: playerStyle }, playerRng);
            playerFire(session, decision.index, decision);
            break;
          }
          case PHASE.PLAYER_END: endPlayerTurn(session); break;
          case PHASE.AI_TURN: aiFire(session, aiRng); break;
          case PHASE.AI_RESULT: beginPlayerTurn(session); break;
          default: throw new Error('Invalid phase');
        }
      }
      if (session.log.error) throw new Error(session.log.error);
      const game = { pair, skill, playerStyle, aiStyle, firstPlayer,
        winner: session.game.result === 'player_win' ? 'player' : 'ai',
        player: summary(session.game.history, ACTOR.PLAYER),
        ai: summary(session.game.history, ACTOR.AI), log: session.log.path };
      games.push(game);
    }
    console.log(`Completed pair ${pair}/18 (${games.length} games)`);
  }
}
function compare(metric, eligible = games) {
  let wins = 0, losses = 0, ties = 0;
  for (const game of eligible) {
    const diff = game.player[metric] - game.ai[metric];
    if (Math.abs(diff) < 1e-9) { ties++; continue; }
    if ((diff > 0 ? 'player' : 'ai') === game.winner) wins++; else losses++;
  }
  return { wins, losses, ties, winRate: wins + losses ? wins / (wins + losses) : null };
}
const report = { games: games.length, pairedStartingOrder: true,
  comparisons: Object.fromEntries(['good', 'goodRate', 'goodNonFinish', 'earlyNonFinish']
    .map((metric) => [metric, compare(metric, metric === 'earlyNonFinish'
      ? games.filter((game) => game.player.shots >= 16 && game.ai.shots >= 16) : games)])),
  totalShots: games.reduce((sum, game) => sum + game.player.shots + game.ai.shots, 0),
  matches: games };
const file = path.resolve(__dirname, '..', 'logs', 'rating-experiment.json');
fs.writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, matches: undefined, file }));
