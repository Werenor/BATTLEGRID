const {
  CELL_COUNT,
  SHOT,
  SKILL,
  TARGETING_STYLE,
} = require('./constants');
const { allPlacements, randomChoice, shuffle, weightedChoice } = require('./ai-utils');

const DEFAULT_SAMPLE_COUNT = 360;
const CANDIDATE_NOISE = 45;
const SELECTION_TEMPERATURE = Object.freeze({
  [SKILL.WEAK]: 65,
  [SKILL.COMPETENT]: 30,
  [SKILL.EXPERT]: 10,
});

const STYLE_WEIGHTS = Object.freeze({
  [TARGETING_STYLE.OFFENSIVE]: Object.freeze({ hit: 65, information: 10, sink: 25 }),
  [TARGETING_STYLE.STRATEGIC]: Object.freeze({ hit: 30, information: 15, sink: 55 }),
  [TARGETING_STYLE.INFORMATION]: Object.freeze({ hit: 25, information: 65, sink: 10 }),
});

function unknownCells(knowledge) {
  return knowledge.shots
    .map((shot, index) => (shot === null ? index : -1))
    .filter((index) => index >= 0);
}

function blockedCells(knowledge) {
  return new Set(
    knowledge.shots
      .map((shot, index) =>
        shot === SHOT.MISS || shot === SHOT.SUNK ? index : -1,
      )
      .filter((index) => index >= 0),
  );
}

function hitCells(knowledge) {
  return new Set(
    knowledge.shots
      .map((shot, index) => (shot === SHOT.HIT ? index : -1))
      .filter((index) => index >= 0),
  );
}

function normalHeat(knowledge) {
  const heat = Array(CELL_COUNT).fill(0);
  const blocked = blockedCells(knowledge);
  const hits = hitCells(knowledge);
  knowledge.remainingShips.forEach((length) => {
    allPlacements(length).forEach((placement) => {
      if (placement.some((cell) => blocked.has(cell))) return;
      const coveredHits = placement.filter((cell) => hits.has(cell)).length;
      const weight = hits.size ? (coveredHits ? 1 + coveredHits * 10 : 0.15) : 1;
      placement.forEach((cell) => {
        if (knowledge.shots[cell] === null) heat[cell] += weight;
      });
    });
  });
  return heat;
}

function generateConsistentLayout(knowledge, rng = Math.random, maxNodes = 30000, stats = null) {
  const blocked = blockedCells(knowledge);
  const requiredHits = hitCells(knowledge);
  const ships = knowledge.remainingShips.map((length, index) => ({ length, index }));
  const occupied = new Set();
  const selected = [];
  let visited = 0;

  const candidatesByShip = ships.map((ship) =>
    allPlacements(ship.length).filter(
      (placement) =>
        !placement.some((cell) => blocked.has(cell)) &&
        !placement.every((cell) => requiredHits.has(cell)),
    ),
  );

  function search(shipIndex) {
    visited += 1;
    if (visited > maxNodes) return false;
    if (shipIndex === ships.length) {
      return [...requiredHits].every((cell) => occupied.has(cell));
    }
    const candidates = shuffle(candidatesByShip[shipIndex], rng);
    for (const placement of candidates) {
      if (placement.some((cell) => occupied.has(cell))) continue;
      placement.forEach((cell) => occupied.add(cell));
      selected.push(placement);
      if (search(shipIndex + 1)) return true;
      selected.pop();
      placement.forEach((cell) => occupied.delete(cell));
    }
    return false;
  }

  const layout = search(0) ? selected.map((placement) => [...placement]) : null;
  if (stats) stats.nodes = visited;
  return layout;
}

function sampleFleetLayouts(knowledge, count, rng = Math.random) {
  const layouts = [];
  const attempts = Math.max(count * 3, count);
  let remainingNodes = 120000;
  for (let attempt = 0; attempt < attempts && layouts.length < count && remainingNodes > 0; attempt += 1) {
    const stats = {};
    const layout = generateConsistentLayout(knowledge, rng, Math.min(30000, remainingNodes), stats);
    remainingNodes -= stats.nodes;
    if (layout) layouts.push(layout);
  }
  return layouts;
}

function enumerateFleetLayouts(knowledge, options = {}) {
  const maxNodes = options.maxNodes ?? 20000;
  const maxLayouts = options.maxLayouts ?? 5000;
  const blocked = blockedCells(knowledge), hits = hitCells(knowledge);
  const lengths = [...knowledge.remainingShips].sort((a, b) => b - a);
  const candidates = lengths.map((length) => allPlacements(length).filter(
    (ship) => !ship.some((cell) => blocked.has(cell)) && !ship.every((cell) => hits.has(cell)),
  ));
  const occupied = new Set(), selected = [], indices = [], layouts = [];
  let nodes = 0, complete = true;
  function visit(depth) {
    if (!complete) return;
    if (++nodes > maxNodes) { complete = false; return; }
    if (depth === lengths.length) {
      if (![...hits].every((cell) => occupied.has(cell))) return;
      if (layouts.length >= maxLayouts) { complete = false; return; }
      layouts.push(selected.map((ship) => [...ship]));
      return;
    }
    // Identical ships are indistinguishable; count each unordered pair once.
    const start = depth > 0 && lengths[depth] === lengths[depth - 1] ? indices[depth - 1] + 1 : 0;
    for (let i = start; i < candidates[depth].length && complete; i += 1) {
      const ship = candidates[depth][i];
      if (ship.some((cell) => occupied.has(cell))) continue;
      ship.forEach((cell) => occupied.add(cell));
      selected.push(ship); indices[depth] = i;
      const uncovered = [...hits].filter((cell) => !occupied.has(cell));
      const possible = uncovered.every((cell) => candidates.slice(depth + 1).some(
        (ships) => ships.some((other) => other.includes(cell) && !other.some((c) => occupied.has(c))),
      ));
      if (possible) visit(depth + 1);
      selected.pop(); ship.forEach((cell) => occupied.delete(cell));
    }
  }
  visit(0);
  // Partial DFS output is never treated as a probability distribution.
  return { complete, layouts: complete ? layouts : [], nodes };
}

const analysisCache = new Map();
function analyzeKnowledge(knowledge, options = {}) {
  const key = JSON.stringify([knowledge.shots, [...knowledge.remainingShips].sort(),
    options.sampleCount || DEFAULT_SAMPLE_COUNT, options.maxNodes ?? 20000, options.maxLayouts ?? 5000]);
  if (analysisCache.has(key)) return analysisCache.get(key);
  let state = 2166136261;
  for (const char of key) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = Math.imul(state ^ (state >>> 15), state | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
  const enumeration = enumerateFleetLayouts(knowledge, options);
  const layouts = enumeration.complete ? enumeration.layouts :
    sampleFleetLayouts(knowledge, options.sampleCount || DEFAULT_SAMPLE_COUNT, rng);
  const analysis = { maps: layouts.length ? buildTargetMaps(knowledge, layouts) : null,
    method: enumeration.complete ? 'exact' : 'sampled', count: layouts.length,
    nodes: enumeration.nodes };
  if (analysis.maps) analysis.maps.allowFinish = analysis.method === 'exact' || analysis.count >= 30;
  analysisCache.set(key, analysis);
  if (analysisCache.size > 128) analysisCache.delete(analysisCache.keys().next().value);
  return analysis;
}

function outcomeSignature(knowledge, layout, cell) {
  const ship = layout.find((placement) => placement.includes(cell));
  if (!ship) return 'miss';
  const sinks = ship.every(
    (shipCell) => shipCell === cell || knowledge.shots[shipCell] === SHOT.HIT,
  );
  return sinks ? `sunk:${[...ship].sort((a, b) => a - b).join(',')}` : 'hit';
}

function sinkingOpportunity(knowledge, layout, cell) {
  const ship = layout.find((placement) => placement.includes(cell));
  if (!ship) return 0;
  const existingHits = ship.filter(
    (shipCell) => knowledge.shots[shipCell] === SHOT.HIT,
  ).length;
  if (existingHits + 1 === ship.length) return 1;
  if (!existingHits) return 0;
  return ((existingHits + 1) / ship.length) * 0.5;
}

function buildTargetMaps(knowledge, layouts) {
  const hit = Array(CELL_COUNT).fill(0);
  const sink = Array(CELL_COUNT).fill(0);
  const information = Array(CELL_COUNT).fill(0);
  const pursuit = Array(CELL_COUNT).fill(0);
  const finish = Array(CELL_COUNT).fill(0);
  if (!layouts.length) return { hit, information, sink, pursuit, finish };

  for (const cell of unknownCells(knowledge)) {
    const outcomes = new Map();
    for (const layout of layouts) {
      const signature = outcomeSignature(knowledge, layout, cell);
      outcomes.set(signature, (outcomes.get(signature) || 0) + 1);
      if (signature !== 'miss') hit[cell] += 1;
      sink[cell] += sinkingOpportunity(knowledge, layout, cell);
      const ship = layout.find((placement) => placement.includes(cell));
      if (ship?.some((shipCell) => knowledge.shots[shipCell] === SHOT.HIT)) {
        pursuit[cell] += 1;
      }
      if (signature.startsWith('sunk:')) finish[cell] += 1;
    }
    hit[cell] /= layouts.length;
    sink[cell] /= layouts.length;
    pursuit[cell] /= layouts.length;
    finish[cell] /= layouts.length;
    information[cell] = 1 - [...outcomes.values()].reduce(
      (sum, count) => sum + (count / layouts.length) ** 2,
      0,
    );
  }
  return { hit, information, sink, pursuit, finish };
}

function fallbackPursuit(knowledge) {
  const pursuit = Array(CELL_COUNT).fill(0);
  const hits = hitCells(knowledge);
  const blocked = blockedCells(knowledge);
  for (const length of knowledge.remainingShips) {
    for (const placement of allPlacements(length)) {
      if (placement.some((cell) => blocked.has(cell))) continue;
      if (!placement.some((cell) => hits.has(cell))) continue;
      for (const cell of placement) {
        if (knowledge.shots[cell] === null) pursuit[cell] += 1;
      }
    }
  }
  return pursuit;
}

function targetScope(maps, knowledge) {
  const unknown = unknownCells(knowledge);
  const closeout = maps.allowFinish === false ? [] : unknown.filter((cell) => maps.finish[cell] >= 0.95);
  if (closeout.length) return { cells: closeout, mode: 'finish' };
  if (knowledge.shots.includes(SHOT.HIT)) {
    const pursuit = unknown.filter((cell) => maps.pursuit[cell] > 0);
    if (pursuit.length) return { cells: pursuit, mode: 'pursuit' };
  }
  return { cells: unknown, mode: 'search' };
}

function hardHeat(knowledge, rng = Math.random, sampleCount = DEFAULT_SAMPLE_COUNT) {
  const layouts = sampleFleetLayouts(knowledge, sampleCount, rng);
  if (!layouts.length) return normalHeat(knowledge);
  return buildTargetMaps(knowledge, layouts).hit;
}

function normalizeMap(values, cells) {
  const maximum = Math.max(0, ...cells.map((cell) => values[cell]));
  if (maximum <= 0) return Array(CELL_COUNT).fill(0);
  return values.map((value) => (value / maximum) * 100);
}

function weightsFor(style, knowledge) {
  const base = STYLE_WEIGHTS[style] || STYLE_WEIGHTS[TARGETING_STYLE.STRATEGIC];
  if (knowledge.shots.includes(SHOT.HIT)) return base;
  return { hit: base.hit + base.sink, information: base.information, sink: 0 };
}

function topCell(values, cells) {
  return cells.reduce(
    (best, cell) => (best === null || values[cell] > values[best] ? cell : best),
    null,
  );
}

function noisyTopCell(values, cells, rng, noise = CANDIDATE_NOISE) {
  return cells.reduce((best, cell) => {
    const score = values[cell] + (rng() * 2 - 1) * noise;
    return best === null || score > best.score ? { cell, score } : best;
  }, null)?.cell ?? null;
}

function buildCandidatePool(maps, knowledge, rng = Math.random, noise = CANDIDATE_NOISE, allowedCells = unknownCells(knowledge)) {
  const unknown = allowedCells;
  const pool = new Set();
  for (const values of [maps.hit, maps.sink, maps.information]) {
    if (Math.max(0, ...unknown.map((cell) => values[cell])) <= 0) continue;
    pool.add(topCell(values, unknown));
    pool.add(noisyTopCell(values, unknown, rng, noise));
  }
  const shuffled = shuffle(unknown, rng);
  while (pool.size < Math.min(4, unknown.length)) pool.add(shuffled.pop());
  return [...pool].filter((cell) => cell !== null);
}

function scoreCandidates(maps, knowledge, style, candidates) {
  const unknown = unknownCells(knowledge);
  const normalized = {
    hit: normalizeMap(maps.hit, unknown),
    information: normalizeMap(maps.information, unknown),
    sink: normalizeMap(maps.sink, unknown),
  };
  const weights = weightsFor(style, knowledge);
  return candidates.map((cell) => ({
    cell,
    hit: normalized.hit[cell],
    information: normalized.information[cell],
    quality:
      (normalized.hit[cell] * weights.hit +
        normalized.sink[cell] * weights.sink +
        normalized.information[cell] * weights.information) /
      100,
    sink: normalized.sink[cell],
  }));
}

function chooseTargetDecision(knowledge, config = {}, rng = Math.random) {
  const unknown = unknownCells(knowledge);
  if (!unknown.length) return null;
  const skill = config.skill || SKILL.COMPETENT;
  const style = config.style || TARGETING_STYLE.STRATEGIC;
  const analysis = analyzeKnowledge(knowledge);
  const maps = analysis.maps
    ? analysis.maps
    : {
        hit: normalHeat(knowledge),
        information: Array(CELL_COUNT).fill(0),
        sink: Array(CELL_COUNT).fill(0),
        pursuit: fallbackPursuit(knowledge),
        finish: Array(CELL_COUNT).fill(0),
      };
  const scope = targetScope(maps, knowledge);
  const candidates = buildCandidatePool(
    maps,
    knowledge,
    rng,
    config.candidateNoise ?? CANDIDATE_NOISE,
    scope.cells,
  );
  const scored = scoreCandidates(maps, knowledge, style, candidates);
  const bestQuality = Math.max(...scored.map((candidate) => candidate.quality));
  const temperature = config.temperature || SELECTION_TEMPERATURE[skill];
  const chosen = weightedChoice(
    scored,
    (candidate) => Math.exp((candidate.quality - bestQuality) / temperature),
    rng,
  );
  return {
    bestQuality,
    candidates: scored,
    chosenQuality: chosen.quality,
    index: chosen.cell,
    mode: scope.mode,
    layoutsConsidered: analysis.count,
    analysisMethod: analysis.method,
    regret: bestQuality - chosen.quality,
  };
}

function chooseTarget(knowledge, config = {}, rng = Math.random) {
  return chooseTargetDecision(knowledge, config, rng)?.index ?? randomChoice(unknownCells(knowledge), rng);
}

module.exports = {
  STYLE_WEIGHTS,
  analyzeKnowledge,
  enumerateFleetLayouts,
  buildCandidatePool,
  buildTargetMaps,
  chooseTarget,
  chooseTargetDecision,
  generateConsistentLayout,
  hardHeat,
  normalHeat,
  outcomeSignature,
  sampleFleetLayouts,
  scoreCandidates,
  sinkingOpportunity,
  targetScope,
  unknownCells,
  weightsFor,
};
