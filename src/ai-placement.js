const {
  BOARD_SIZE,
  PLACEMENT_STYLE,
  SHIP_DEFINITIONS,
  SKILL,
} = require('./constants');
const { createBoard, fromIndex, placeShip } = require('./board');
const { allPlacements, shuffle, weightedChoice } = require('./ai-utils');

const CANDIDATE_COUNTS = Object.freeze({
  [SKILL.WEAK]: 24,
  [SKILL.COMPETENT]: 120,
  [SKILL.EXPERT]: 480,
});

const TEMPERATURES = Object.freeze({
  [SKILL.WEAK]: 0.8,
  [SKILL.COMPETENT]: 0.35,
  [SKILL.EXPERT]: 0.15,
});

function generateRandomLayout(rng = Math.random) {
  const occupied = new Set();
  const selected = new Map();

  function search(shipIndex) {
    if (shipIndex === SHIP_DEFINITIONS.length) return true;
    const ship = SHIP_DEFINITIONS[shipIndex];
    const candidates = shuffle(allPlacements(ship.length), rng);
    for (const cells of candidates) {
      if (cells.some((cell) => occupied.has(cell))) continue;
      cells.forEach((cell) => occupied.add(cell));
      selected.set(ship.id, cells);
      if (search(shipIndex + 1)) return true;
      selected.delete(ship.id);
      cells.forEach((cell) => occupied.delete(cell));
    }
    return false;
  }

  if (!search(0)) throw new Error('Unable to generate a legal layout');
  const board = createBoard();
  SHIP_DEFINITIONS.forEach((ship) => placeShip(board, ship.id, selected.get(ship.id)));
  return board;
}

function minimumShipDistance(first, second) {
  let minimum = Infinity;
  first.cells.forEach((left) => {
    const a = fromIndex(left);
    second.cells.forEach((right) => {
      const b = fromIndex(right);
      minimum = Math.min(
        minimum,
        Math.max(Math.abs(a.row - b.row), Math.abs(a.column - b.column)),
      );
    });
  });
  return minimum;
}

function layoutFeatures(board, corner) {
  const cells = board.ships.flatMap((ship) => ship.cells);
  const pairs = [];
  for (let left = 0; left < board.ships.length; left += 1) {
    for (let right = left + 1; right < board.ships.length; right += 1) {
      pairs.push(minimumShipDistance(board.ships[left], board.ships[right]));
    }
  }
  const averageDistance = pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
  const positions = cells.map(fromIndex);
  const edge =
    positions.filter(
      ({ row, column }) =>
        row === 0 || row === BOARD_SIZE - 1 || column === 0 || column === BOARD_SIZE - 1,
    ).length / cells.length;
  const cornerAffinity =
    positions.reduce(
      (sum, { row, column }) =>
        sum +
        (1 -
          (Math.abs(row - corner.row) + Math.abs(column - corner.column)) /
            ((BOARD_SIZE - 1) * 2)),
      0,
    ) / cells.length;
  const center =
    positions.reduce((sum, { row, column }) => {
      const distance = Math.abs(row - 3.5) + Math.abs(column - 3.5);
      return sum + (1 - distance / 7);
    }, 0) / cells.length;
  const orientations = board.ships.map((ship) => {
    const first = fromIndex(ship.cells[0]);
    const last = fromIndex(ship.cells[ship.cells.length - 1]);
    return first.row === last.row ? 'horizontal' : 'vertical';
  });
  const sameOrientation = Math.max(
    orientations.filter((value) => value === 'horizontal').length,
    orientations.filter((value) => value === 'vertical').length,
  ) / board.ships.length;

  return {
    center,
    cluster: pairs.reduce((sum, value) => sum + 1 / value, 0) / pairs.length,
    corner: cornerAffinity,
    dispersion: Math.min(1, averageDistance / (BOARD_SIZE / 2)),
    edge,
    patternPenalty: Math.max(0, sameOrientation - 0.5),
  };
}

function scoreLayout(features, style) {
  const patternCost = features.patternPenalty * 0.25;
  switch (style) {
    case PLACEMENT_STYLE.DISPERSED:
      return features.dispersion * 2 - features.cluster * 0.5 - patternCost;
    case PLACEMENT_STYLE.CLUSTERED:
      return features.cluster * 2 - patternCost;
    case PLACEMENT_STYLE.EDGE:
      return features.edge * 2 + features.dispersion * 0.25 - patternCost;
    case PLACEMENT_STYLE.CORNER:
      return features.corner * 2 + features.cluster * 0.35 - patternCost;
    case PLACEMENT_STYLE.BALANCED:
    default:
      return (
        features.edge * 0.2 +
        features.dispersion * 0.35 +
        features.cluster * 0.1 -
        features.center * 0.1 -
        patternCost
      );
  }
}

function chooseAiLayout(config = {}, rng = Math.random) {
  const skill = config.skill || SKILL.COMPETENT;
  const style = config.style || PLACEMENT_STYLE.BALANCED;
  const count = CANDIDATE_COUNTS[skill] || CANDIDATE_COUNTS[SKILL.COMPETENT];
  const temperature = TEMPERATURES[skill] || TEMPERATURES[SKILL.COMPETENT];
  const corners = [
    { row: 0, column: 0 },
    { row: 0, column: BOARD_SIZE - 1 },
    { row: BOARD_SIZE - 1, column: 0 },
    { row: BOARD_SIZE - 1, column: BOARD_SIZE - 1 },
  ];
  const corner = corners[Math.floor(rng() * corners.length)];
  const candidates = Array.from({ length: count }, () => {
    const board = generateRandomLayout(rng);
    return { board, score: scoreLayout(layoutFeatures(board, corner), style) };
  });
  const maximum = Math.max(...candidates.map((candidate) => candidate.score));
  return weightedChoice(
    candidates,
    (candidate) => Math.exp((candidate.score - maximum) / temperature),
    rng,
  ).board;
}

module.exports = {
  chooseAiLayout,
  generateRandomLayout,
  layoutFeatures,
  minimumShipDistance,
  scoreLayout,
};
