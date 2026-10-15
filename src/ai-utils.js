const { BOARD_SIZE } = require('./constants');
const { toIndex } = require('./board');

function allPlacements(length) {
  const placements = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (column + length <= BOARD_SIZE) {
        placements.push(
          Array.from({ length }, (_, offset) => toIndex(row, column + offset)),
        );
      }
      if (row + length <= BOARD_SIZE) {
        placements.push(
          Array.from({ length }, (_, offset) => toIndex(row + offset, column)),
        );
      }
    }
  }
  return placements;
}

function randomChoice(values, rng = Math.random) {
  if (!values.length) return null;
  return values[Math.floor(rng() * values.length)];
}

function shuffle(values, rng = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function weightedChoice(entries, weightOf, rng = Math.random) {
  const weighted = entries.map((entry) => ({
    entry,
    weight: Math.max(0, Number(weightOf(entry)) || 0),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return randomChoice(entries, rng);
  let cursor = rng() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.entry;
  }
  return weighted[weighted.length - 1].entry;
}

module.exports = {
  allPlacements,
  randomChoice,
  shuffle,
  weightedChoice,
};
