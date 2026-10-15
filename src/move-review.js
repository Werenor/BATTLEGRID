const { SHOT } = require('./constants');
const { allPlacements } = require('./ai-utils');
const { formatCoordinate } = require('./board');
const {
  analyzeKnowledge, targetScope, unknownCells,
} = require('./ai-targeting');

const RATINGS = Object.freeze({
  i: { color: '#96bc4b', label: '合理' },
  '!': { color: '#5c8bb0', label: '好棋' },
  '!!': { color: '#1baca6', label: '妙手' },
  '?!': { color: '#f7c631', label: '不精确' },
  '?': { color: '#e6912c', label: '失误' },
  '??': { color: '#fa412d', label: '严重失误' },
});

function rateMove(knowledge, index, maps, uncertainty = 0) {
  const cells = unknownCells(knowledge);
  if (!cells.includes(index)) return null;
  const hasHits = knowledge.shots.includes(SHOT.HIT);
  const scope = targetScope(maps, knowledge);
  const allowed = new Set(scope.cells);
  const entries = cells.map((cell) => ({
    cell,
    quality: Math.max(0, maps.hit[cell] * (hasHits ? 40 : 70) +
      maps.sink[cell] * (hasHits ? 30 : 0) + maps.information[cell] * 30 -
      (allowed.has(cell) ? 0 : scope.mode === 'finish' ? 55 : 25)),
  }));
  const ranked = entries.filter((entry) => allowed.has(entry.cell))
    .sort((a, b) => b.quality - a.quality || a.cell - b.cell);
  const best = ranked[0];
  const chosen = entries.find((entry) => entry.cell === index);
  const rawLoss = Math.max(0, best.quality - chosen.quality);
  const loss = Math.max(0, rawLoss - uncertainty);
  // Before discovering any ship, legal exploration is not an error. Use exact
  // geometry here: a low sampled prior is not evidence that a square is water.
  const exploring = !knowledge.shots.some((shot) => shot === SHOT.HIT || shot === SHOT.SUNK);
  const plausible = knowledge.remainingShips.some((length) => allPlacements(length).some(
    (placement) => placement.includes(index) &&
      placement.every((cell) => knowledge.shots[cell] !== SHOT.MISS && knowledge.shots[cell] !== SHOT.SUNK),
  ));
  const openingExploration = exploring && plausible;
  const bestFinish = Math.max(...cells.map((cell) => maps.finish[cell]));
  const confidentFinish = bestFinish - uncertainty / 100;
  let symbol = loss >= 12 ? '?!' : 'i';
  if (confidentFinish >= 0.75 && maps.finish[index] < 0.4 && loss >= 15) symbol = '?';
  if (confidentFinish >= 0.95 && maps.finish[index] < 0.2 && loss >= 30) symbol = '??';
  if (!plausible) symbol = '??';
  if (openingExploration) symbol = 'i';
  const gap = ranked.length > 1 ? best.quality - ranked[1].quality : 0;
  const maxHit = Math.max(...cells.map((cell) => maps.hit[cell]));
  const highHitCell = cells.find((cell) => maps.hit[cell] === maxHit);
  const timelyFinish = maps.finish[index] - uncertainty / 100 >= 0.5 &&
    maps.finish[index] >= bestFinish * 0.85;
  const alternatives = ranked.filter((entry) => entry.cell !== index &&
    maps.hit[entry.cell] >= 0.15);
  const comparison = alternatives.length
    ? Math.max(...alternatives.map((entry) => entry.quality))
    : chosen.quality;
  // Following an already established ship body is routine. A pursuit mark
  // requires a real choice, uncertainty in direction, and a measurable edge.
  const goodPursuit = scope.mode === 'pursuit' && alternatives.length > 0 &&
    maps.hit[index] >= 0.4 && maps.hit[index] < 0.95 &&
    maps.hit[index] >= maxHit * 0.8 && rawLoss <= 5 &&
    chosen.quality - comparison >= 4 + uncertainty / 2;
  const goodProbe = scope.mode === 'search' && maps.information[index] >= 0.35 &&
    maps.information[index] > maps.information[highHitCell] + 0.05;
  if (!exploring && plausible && symbol === 'i' && rawLoss <= 8 && uncertainty <= 12 &&
      (timelyFinish || goodPursuit || goodProbe)) {
    symbol = '!';
    if (!timelyFinish && rawLoss <= 2 && uncertainty <= 6 && gap >= 20 &&
        knowledge.shots.filter((shot) => shot === SHOT.HIT).length >= 2 &&
        maxHit - maps.hit[index] >= 0.1 && goodProbe) symbol = '!!';
  }
  const reason = openingExploration
    ? '尚未发现舰船，此处仍能容纳剩余舰船，属于合理探索。统计分差仅供参考，不据此判失误。'
    : !plausible ? '根据已知空格和剩余舰长，此处已不可能有船。'
    : symbol === '!' ? timelyFinish ? '及时抓住了较好的击沉机会。'
      : goodPursuit ? '选择了较好的伤船追击位置；打空也不改变行动价值。'
      : '这次试探有较好的信息价值。'
    : !allowed.has(index)
    ? scope.mode === 'finish' ? '错过高概率收尾，转去搜索其他位置。' : '已有伤船，却离开了追击范围。'
    : scope.mode === 'finish' ? '优先处理高概率击沉机会。'
    : scope.mode === 'pursuit' && maps.hit[index] >= 0.95
      ? '沿已经明确的船身继续攻击，属于正常推进。'
    : scope.mode === 'pursuit' ? '在可能延续伤船的位置中比较命中、击沉和信息收益。'
    : '综合比较命中、击沉和信息收益；打空也可能是合理行动。';
  return {
    symbol, ...RATINGS[symbol], quality: chosen.quality, bestQuality: best.quality,
    loss, rawLoss, uncertainty, bestCell: best.cell, bestCoordinate: formatCoordinate(best.cell),
    mode: scope.mode, openingExploration, reason,
  };
}

function evaluateMove(knowledge, index) {
  const analysis = analyzeKnowledge(knowledge);
  if (!analysis.maps) return null;
  if (analysis.method === 'sampled' && analysis.count < 30) return null;
  // Conservative tolerance for sampled estimates, not a formal confidence interval:
  // the layout sampler is not guaranteed to be an unbiased independent draw.
  const uncertainty = analysis.method === 'exact' ? 0 : Math.max(5, 196 / Math.sqrt(analysis.count));
  return { ...rateMove(knowledge, index, analysis.maps, uncertainty),
    samples: analysis.count, analysisMethod: analysis.method };
}

module.exports = { RATINGS, evaluateMove, rateMove };
