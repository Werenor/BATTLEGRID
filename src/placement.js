const {
  cellsBetween,
  getShip,
  isBoardReady,
  placeShip,
  shipAt,
  validEndpoints,
} = require('./board');

function firstUnplacedShip(board) {
  return board.ships.find((ship) => ship.cells.length !== ship.length) || null;
}

function createPlacementState(board) {
  return {
    firstEndpoint: null,
    movingOriginalCells: null,
    selectedShipId: firstUnplacedShip(board)?.id || null,
    validEndpoints: [],
  };
}

function resetEndpoint(state) {
  state.firstEndpoint = null;
  state.validEndpoints = [];
}

function selectShip(board, state, shipId) {
  const ship = getShip(board, shipId);
  if (!ship) return { ok: false, reason: 'unknown_ship' };
  if (state.movingOriginalCells) cancelPlacement(board, state);
  state.selectedShipId = shipId;
  resetEndpoint(state);
  return { ok: true };
}

function liftPlacedShip(board, state, shipId) {
  const ship = getShip(board, shipId);
  if (!ship || ship.cells.length !== ship.length) {
    return { ok: false, reason: 'ship_not_placed' };
  }
  if (state.movingOriginalCells) cancelPlacement(board, state);
  state.selectedShipId = shipId;
  state.movingOriginalCells = [...ship.cells];
  ship.cells = [];
  ship.hits = [];
  resetEndpoint(state);
  return { ok: true };
}

function clickPlacementCell(board, state, index) {
  if (state.firstEndpoint !== null) {
    if (!state.validEndpoints.includes(index)) {
      return { ok: false, reason: 'invalid_endpoint' };
    }
    const cells = cellsBetween(state.firstEndpoint, index);
    const result = placeShip(board, state.selectedShipId, cells);
    if (!result.ok) return result;
    state.movingOriginalCells = null;
    resetEndpoint(state);
    state.selectedShipId = firstUnplacedShip(board)?.id || null;
    return { complete: isBoardReady(board), ok: true, placedShipId: result.ship.id };
  }

  const placed = shipAt(board, index);
  if (placed) return liftPlacedShip(board, state, placed.id);
  if (!state.selectedShipId) return { ok: false, reason: 'no_ship_selected' };

  const endpoints = validEndpoints(board, state.selectedShipId, index);
  if (!endpoints.length) return { ok: false, reason: 'no_valid_endpoint' };
  state.firstEndpoint = index;
  state.validEndpoints = endpoints;
  return { ok: true, selectedFirstEndpoint: index };
}

function cancelPlacement(board, state) {
  if (state.movingOriginalCells) {
    const original = [...state.movingOriginalCells];
    const shipId = state.selectedShipId;
    state.movingOriginalCells = null;
    resetEndpoint(state);
    const restored = placeShip(board, shipId, original);
    state.selectedShipId = firstUnplacedShip(board)?.id || null;
    return { ok: restored.ok, restoredShipId: shipId };
  }
  const hadEndpoint = state.firstEndpoint !== null;
  resetEndpoint(state);
  return { cancelledEndpoint: hadEndpoint, ok: true };
}

function clearFleet(board, state) {
  board.ships.forEach((ship) => {
    ship.cells = [];
    ship.hits = [];
  });
  board.shots.fill(null);
  state.movingOriginalCells = null;
  resetEndpoint(state);
  state.selectedShipId = firstUnplacedShip(board)?.id || null;
  return { ok: true };
}

module.exports = {
  cancelPlacement,
  clearFleet,
  clickPlacementCell,
  createPlacementState,
  firstUnplacedShip,
  liftPlacedShip,
  selectShip,
};
