const {
  BOARD_SIZE,
  CELL_COUNT,
  SHIP_DEFINITIONS,
  SHOT,
} = require('./constants');

function isInteger(value) {
  return Number.isInteger(value);
}

function isValidIndex(index) {
  return isInteger(index) && index >= 0 && index < CELL_COUNT;
}

function toIndex(row, column) {
  if (
    !isInteger(row) ||
    !isInteger(column) ||
    row < 0 ||
    row >= BOARD_SIZE ||
    column < 0 ||
    column >= BOARD_SIZE
  ) {
    throw new RangeError(`Invalid board coordinate: ${row},${column}`);
  }
  return row * BOARD_SIZE + column;
}

function fromIndex(index) {
  if (!isValidIndex(index)) throw new RangeError(`Invalid board index: ${index}`);
  return {
    column: index % BOARD_SIZE,
    row: Math.floor(index / BOARD_SIZE),
  };
}

function formatCoordinate(index) {
  const { column, row } = fromIndex(index);
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

function createBoard() {
  return {
    ships: SHIP_DEFINITIONS.map(({ id, length }) => ({
      cells: [],
      hits: [],
      id,
      length,
    })),
    shots: Array(CELL_COUNT).fill(null),
  };
}

function getShip(board, shipId) {
  return board.ships.find((ship) => ship.id === shipId) || null;
}

function shipAt(board, index, exceptShipId = null) {
  return (
    board.ships.find(
      (ship) => ship.id !== exceptShipId && ship.cells.includes(index),
    ) || null
  );
}

function cellsBetween(start, end) {
  const first = fromIndex(start);
  const last = fromIndex(end);
  if (first.row !== last.row && first.column !== last.column) return [];

  const rowStep = Math.sign(last.row - first.row);
  const columnStep = Math.sign(last.column - first.column);
  const distance = Math.max(
    Math.abs(last.row - first.row),
    Math.abs(last.column - first.column),
  );

  return Array.from({ length: distance + 1 }, (_, offset) =>
    toIndex(
      first.row + rowStep * offset,
      first.column + columnStep * offset,
    ),
  );
}

function validatePlacement(board, shipId, cells) {
  const ship = getShip(board, shipId);
  if (!ship) return { ok: false, reason: 'unknown_ship' };
  if (!Array.isArray(cells) || cells.length !== ship.length) {
    return { ok: false, reason: 'wrong_length' };
  }
  if (new Set(cells).size !== cells.length || cells.some((cell) => !isValidIndex(cell))) {
    return { ok: false, reason: 'invalid_cells' };
  }

  const line = cellsBetween(cells[0], cells[cells.length - 1]);
  if (line.length !== cells.length || line.some((cell) => !cells.includes(cell))) {
    return { ok: false, reason: 'not_straight_contiguous' };
  }
  if (cells.some((cell) => shipAt(board, cell, shipId))) {
    return { ok: false, reason: 'overlap' };
  }
  return { ok: true };
}

function placeShip(board, shipId, cells) {
  const validation = validatePlacement(board, shipId, cells);
  if (!validation.ok) return validation;
  const ship = getShip(board, shipId);
  ship.cells = [...cells].sort((left, right) => left - right);
  ship.hits = [];
  return { ok: true, ship };
}

function validEndpoints(board, shipId, start) {
  if (!isValidIndex(start)) return [];
  const ship = getShip(board, shipId);
  if (!ship) return [];
  const { row, column } = fromIndex(start);
  const distance = ship.length - 1;
  const candidates = [
    [row - distance, column],
    [row + distance, column],
    [row, column - distance],
    [row, column + distance],
  ];

  return candidates
    .filter(
      ([candidateRow, candidateColumn]) =>
        candidateRow >= 0 &&
        candidateRow < BOARD_SIZE &&
        candidateColumn >= 0 &&
        candidateColumn < BOARD_SIZE,
    )
    .map(([candidateRow, candidateColumn]) =>
      toIndex(candidateRow, candidateColumn),
    )
    .filter((end) => validatePlacement(board, shipId, cellsBetween(start, end)).ok);
}

function isBoardReady(board) {
  return board.ships.every((ship) => ship.cells.length === ship.length);
}

function isShipSunk(ship) {
  return ship.cells.length === ship.length && ship.hits.length === ship.length;
}

function areAllShipsSunk(board) {
  return isBoardReady(board) && board.ships.every(isShipSunk);
}

function attack(board, index) {
  if (!isValidIndex(index)) return { ok: false, reason: 'invalid_coordinate' };
  if (board.shots[index] !== null) return { ok: false, reason: 'already_attacked' };

  const ship = shipAt(board, index);
  if (!ship) {
    board.shots[index] = SHOT.MISS;
    return { coordinate: formatCoordinate(index), index, ok: true, outcome: SHOT.MISS };
  }

  if (!ship.hits.includes(index)) ship.hits.push(index);
  if (isShipSunk(ship)) {
    ship.cells.forEach((cell) => {
      board.shots[cell] = SHOT.SUNK;
    });
    return {
      coordinate: formatCoordinate(index),
      index,
      ok: true,
      outcome: SHOT.SUNK,
      shipId: ship.id,
      shipLength: ship.length,
    };
  }

  board.shots[index] = SHOT.HIT;
  return {
    coordinate: formatCoordinate(index),
    index,
    ok: true,
    outcome: SHOT.HIT,
    shipId: ship.id,
    shipLength: ship.length,
  };
}

function publicKnowledge(board) {
  return {
    remainingShips: board.ships
      .filter((ship) => !isShipSunk(ship))
      .map((ship) => ship.length),
    shots: [...board.shots],
  };
}

module.exports = {
  areAllShipsSunk,
  attack,
  cellsBetween,
  createBoard,
  formatCoordinate,
  fromIndex,
  getShip,
  isBoardReady,
  isShipSunk,
  isValidIndex,
  placeShip,
  publicKnowledge,
  shipAt,
  toIndex,
  validEndpoints,
  validatePlacement,
};
