const { normalizeAiProfile } = require('./ai-profile');
const { isBoardReady, isShipSunk, shipAt } = require('./board');
const {
  ACTOR,
  PHASE,
  PLACEMENT_STYLE,
  SHOT,
  SKILL,
  TARGETING_STYLE,
} = require('./constants');
const {
  cancelPlacement,
  clearFleet,
  clickPlacementCell,
  createPlacementState,
} = require('./placement');
const {
  aiFire,
  beginPlayerTurn,
  beginSession,
  createSession,
  endPlayerTurn,
  playerFire,
} = require('./session');
const { surrender } = require('./game');
const { RATINGS } = require('./move-review');
const { createEngineMatchLog, finishMatchLog } = require('./match-log');

const CELL_BUTTON_BASE = 100;
const ATTACK_BUTTON_BASE = 200;

const BOARD_ROW_CONFIG = Object.freeze({
  gutter: 0,
  horizontalAlign: 'start',
  width: 10,
});

const COLOR = Object.freeze({
  candidate: '#ffffff',
  hit: '#e6a23c',
  miss: '#409eff',
  ship: '#67c23a',
  sunk: '#f56c6c',
  unknown: '#8c8c8c',
});

const SKILL_LABELS = Object.freeze({
  [SKILL.WEAK]: '较弱',
  [SKILL.COMPETENT]: '熟练',
  [SKILL.EXPERT]: '高手',
});

const TARGETING_LABELS = Object.freeze({
  [TARGETING_STYLE.OFFENSIVE]: '进攻型',
  [TARGETING_STYLE.STRATEGIC]: '策略型',
  [TARGETING_STYLE.INFORMATION]: '信息型',
});

const PLACEMENT_LABELS = Object.freeze({
  [PLACEMENT_STYLE.BALANCED]: '均衡',
  [PLACEMENT_STYLE.DISPERSED]: '分散',
  [PLACEMENT_STYLE.CLUSTERED]: '集中',
  [PLACEMENT_STYLE.EDGE]: '沿边',
  [PLACEMENT_STYLE.CORNER]: '角落',
});

function targetingProfileText(profile) {
  return `${SKILL_LABELS[profile.skill]} · ${TARGETING_LABELS[profile.style]}`;
}

function textCell(content, color, width = 2) {
  return {
    config: { align: 'center', color, width },
    content,
    type: 'text',
  };
}

function buttonCell(content, accelerator, buttonType, title) {
  return {
    accelerator,
    config: {
      align: 'center',
      buttonType,
      inTextAlign: 'center',
      showAcc: false,
      title,
      width: 2,
    },
    content,
    type: 'button',
  };
}

function shotPresentation(shot) {
  if (shot === SHOT.MISS) return { color: COLOR.miss, glyph: '×', label: '未命中' };
  if (shot === SHOT.HIT) return { color: COLOR.hit, glyph: '◆', label: '命中' };
  if (shot === SHOT.SUNK) return { color: COLOR.sunk, glyph: '■', label: '击沉' };
  return { color: COLOR.unknown, glyph: '■', label: '未知' };
}

function renderHeader(era) {
  era.printMultiColumns([
    textCell('', COLOR.unknown),
    ...Array.from({ length: 8 }, (_, column) =>
      textCell(String.fromCharCode(65 + column), COLOR.candidate),
    ),
  ], BOARD_ROW_CONFIG);
}

function renderPlacementBoard(era, board, state) {
  renderHeader(era);
  for (let row = 0; row < 8; row += 1) {
    const cells = [textCell(String(row + 1), COLOR.candidate)];
    for (let column = 0; column < 8; column += 1) {
      const index = row * 8 + column;
      const placedShip = shipAt(board, index);
      if (state.firstEndpoint === index) {
        cells.push(textCell('◆', COLOR.candidate));
      } else if (state.validEndpoints.includes(index)) {
        cells.push(buttonCell('◎', CELL_BUTTON_BASE + index, '', '合法终点'));
      } else if (placedShip) {
        cells.push(buttonCell('■', CELL_BUTTON_BASE + index, 'success', '重新放置这艘舰船'));
      } else if (state.firstEndpoint !== null) {
        cells.push(textCell('■', COLOR.unknown));
      } else {
        cells.push(buttonCell('■', CELL_BUTTON_BASE + index, 'info', '选择第一个端点'));
      }
    }
    era.printMultiColumns(cells, BOARD_ROW_CONFIG);
  }
}

function renderBattleBoard(era, board, options = {}) {
  renderHeader(era);
  for (let row = 0; row < 8; row += 1) {
    const cells = [textCell(String(row + 1), COLOR.candidate)];
    for (let column = 0; column < 8; column += 1) {
      const index = row * 8 + column;
      const shot = board.shots[index];
      if (shot !== null) {
        const visual = shotPresentation(shot);
        cells.push(textCell(visual.glyph, visual.color));
      } else if (options.revealShips && shipAt(board, index)) {
        cells.push(textCell('■', COLOR.ship));
      } else if (options.interactive) {
        cells.push(buttonCell('■', ATTACK_BUTTON_BASE + index, 'info', '攻击此坐标'));
      } else {
        cells.push(textCell('■', COLOR.unknown));
      }
    }
    era.printMultiColumns(cells, BOARD_ROW_CONFIG);
  }
}

function battleCell(board, index, options = {}) {
  const shot = board.shots[index];
  if (shot !== null) {
    const visual = shotPresentation(shot);
    return textCell(visual.glyph, visual.color);
  }
  if (options.revealShips && shipAt(board, index)) {
    return textCell('■', COLOR.ship);
  }
  if (options.interactive) {
    return buttonCell('■', ATTACK_BUTTON_BASE + index, 'info', '攻击此坐标');
  }
  return textCell('■', COLOR.unknown);
}

function centeredBoardRow(cells) {
  return [
    textCell('', COLOR.unknown, 3),
    ...cells,
    textCell('', COLOR.unknown, 3),
  ];
}

function buildBattleBoardColumn(board, options = {}) {
  const columns = [
    textCell(options.title || '', COLOR.candidate, 24),
    textCell(`舰队：${fleetSummary(board)}`, COLOR.candidate, 24),
    ...centeredBoardRow([
      textCell('', COLOR.unknown),
      ...Array.from({ length: 8 }, (_, column) =>
        textCell(String.fromCharCode(65 + column), COLOR.candidate),
      ),
    ]),
  ];
  for (let row = 0; row < 8; row += 1) {
    columns.push(
      ...centeredBoardRow([
        textCell(String(row + 1), COLOR.candidate),
        ...Array.from({ length: 8 }, (_, column) =>
          battleCell(board, row * 8 + column, options),
        ),
      ]),
    );
  }
  return {
    columns,
    config: { width: 12 },
  };
}

function renderBattleBoardsSideBySide(era, game, interactive) {
  era.printInColRows(
    buildBattleBoardColumn(game.playerBoard, {
      revealShips: true,
      title: '我方海域',
    }),
    buildBattleBoardColumn(game.aiBoard, {
      interactive,
      title: '敌方海域',
    }),
  );
}

function fleetSummary(board) {
  return board.ships
    .map((ship) => (isShipSunk(ship) ? `×${ship.length}` : `${ship.length}`))
    .join('　');
}

function outcomeText(result) {
  if (result === 'player_win') return '胜利——敌方舰队已全部击沉。';
  if (result === 'ai_win') return '败北——我方舰队已全部击沉。';
  if (result === 'surrender') return '你选择认输并结束了对局。';
  return '对局已经结束。';
}

function historyText(entry) {
  if (!entry) return null;
  const actor = entry.actor === ACTOR.PLAYER ? '你' : '对手';
  if (entry.outcome === SHOT.MISS) return `${actor}攻击 ${entry.coordinate}——未命中。`;
  if (entry.outcome === SHOT.HIT) return `${actor}攻击 ${entry.coordinate}——命中。`;
  return `${actor}攻击 ${entry.coordinate}——击沉长度 ${entry.shipLength} 的舰船。`;
}

function historyContent(entry) {
  const text = historyText(entry);
  if (!entry?.review) return text;
  return [
    { content: `${entry.review.symbol}  `, color: entry.review.color,
      fontWeight: 'bold', title: entry.review.label },
    { content: text, color: '#ffffff' },
  ];
}

async function showReview(era, game) {
  const pageSize = 10;
  const rounds = [...new Set(game.history.map((entry) => entry.round))];
  const pages = Math.max(1, Math.ceil(rounds.length / pageSize));
  let page = 0;
  while (true) {
    await era.clear();
    era.drawLine({ content: `对局复盘　${page + 1} / ${pages}` });
    era.print('依据开炮前的公开信息估算，双方使用同一标准；战果不决定评价。', {
      align: 'center', color: COLOR.unknown,
    });
    era.print(Object.entries(RATINGS).map(([symbol, rating]) => ({
      content: `${symbol} ${rating.label}　`, color: rating.color,
    })), { align: 'center' });
    for (const round of rounds.slice(page * pageSize, (page + 1) * pageSize)) {
      era.drawLine({ content: `ROUND ${round}` });
      for (const entry of game.history.filter((item) => item.round === round)) {
        era.print(historyContent(entry));
        const review = entry.review;
        if (!review) {
          era.print('本炮未能取得足够的分析样本。', { color: COLOR.unknown });
          continue;
        }
        era.print(`质量 ${review.quality.toFixed(1)} / 最佳 ${review.bestQuality.toFixed(1)}　损失 ${review.loss.toFixed(1)}　推荐 ${review.bestCoordinate}`, { color: COLOR.unknown });
        if (review.analysisMethod) era.print(
          review.analysisMethod === 'exact'
            ? `完整枚举：${review.samples} 种合法舰队布局`
            : `采样估算：${review.samples} 个布局，评分容差 ${review.uncertainty.toFixed(1)} 分`,
          { color: COLOR.unknown },
        );
        era.print(review.reason, { color: COLOR.unknown });
      }
    }
    era.printButton('上一页', 971, { disabled: page === 0 });
    era.printButton('下一页', 972, { disabled: page === pages - 1 });
    era.printButton('返回结算', 970, { align: 'right' });
    const input = Number(await era.input());
    if (input === 970) return;
    if (input === 971 && page > 0) page -= 1;
    if (input === 972 && page < pages - 1) page += 1;
  }
}

async function showSettlement(era, game) {
  while (true) {
    await era.clear();
    renderMatch(era, game, false);
    era.print(`对手本局布舰倾向：${PLACEMENT_LABELS[game.aiProfile.placement.style]}`, {
      align: 'center', color: COLOR.unknown,
    });
    era.print(outcomeText(game.result), { align: 'center', fontWeight: 'bold' });
    era.printButton('查看复盘', 960, { align: 'center', buttonType: 'primary' });
    era.printButton('返回开局设置', 961, { align: 'center' });
    const input = Number(await era.input());
    if (input === 961) return;
    if (input === 960) await showReview(era, game);
  }
}

function cycleFirstPlayer(choice) {
  if (choice === ACTOR.PLAYER) return ACTOR.AI;
  if (choice === ACTOR.AI) return 'random';
  return ACTOR.PLAYER;
}

function firstPlayerLabel(choice) {
  if (choice === ACTOR.PLAYER) return '玩家';
  if (choice === ACTOR.AI) return '对手';
  return '随机';
}

function buildResult(game) {
  const shotsBy = (actor) => game.history.filter((entry) => entry.actor === actor);
  const summarize = (actor) => {
    const entries = shotsBy(actor);
    return {
      hits: entries.filter((entry) => entry.outcome !== SHOT.MISS).length,
      shots: entries.length,
      sunk: entries.filter((entry) => entry.outcome === SHOT.SUNK).length,
    };
  };
  return {
    ai: summarize(ACTOR.AI),
    firstPlayer: game.firstPlayer,
    outcome: game.result,
    player: summarize(ACTOR.PLAYER),
    rounds: game.round,
  };
}

function renderMatch(
  era,
  game,
  interactive,
  statusOverride = null,
) {
  era.drawLine({ content: `BATTLEGRID　ROUND ${game.round}` });
  era.print(
    statusOverride ||
      (game.phase === PHASE.PLAYER_TURN
        ? '轮到你开火。'
        : game.phase === PHASE.PLAYER_END
          ? '你的战果已结算。'
        : game.phase === PHASE.AI_TURN
          ? '对手正在判断目标……'
          : game.phase === PHASE.AI_RESULT
            ? '对手行动结束。'
            : outcomeText(game.result)),
    { align: 'center', isParagraph: true },
  );
  era.print(`对手攻击：${targetingProfileText(game.aiProfile.targeting)}`, {
    align: 'center',
    color: COLOR.unknown,
  });
  renderBattleBoardsSideBySide(era, game, interactive);
  era.print(game.phase === PHASE.AI_TURN ? '思考中……' : '', {
    align: 'center',
    color: COLOR.unknown,
    flush: true,
  });
  const recent = game.history.slice(-2);
  if (recent.length) {
    era.drawLine({ content: '上一轮' });
    recent.forEach((entry, index) => era.print(historyContent(entry), {
      flush: index === recent.length - 1,
    }));
  }
}

async function renderTimedMatchFrame(era, game, delay, status) {
  await era.clear();
  renderMatch(era, game, false, status);
  // Output is buffered in the renderer. flush commits the frame; clear(0)
  // acknowledges earlier renderer messages without removing any lines.
  await era.clear(0);
  await era.delay(delay);
}

async function confirmPlayerResult(era, game, delay = 750) {
  const latest = game.history[game.history.length - 1];
  await renderTimedMatchFrame(era, game, delay, historyText(latest));
}

function createEraPage(era, options = {}) {
  const rng = options.rng || Math.random;
  const aiProfile = normalizeAiProfile(options.aiProfile);

  return async function pageBattlegrid() {
    const session = createSession({ aiProfile, logger: createEngineMatchLog(era) }, rng);
    const placement = createPlacementState(session.game.playerBoard);
    let firstPlayerChoice = options.firstPlayerChoice || ACTOR.PLAYER;

    while (session.game.phase === PHASE.PLACEMENT) {
      await era.clear();
      era.drawLine({ content: 'BATTLEGRID' });
      era.print('在 8×8 海域中布置长度为 4、3、3、2 的四艘舰船。', {
        align: 'center',
        isParagraph: true,
      });
      era.print(`对手攻击：${targetingProfileText(session.game.aiProfile.targeting)}`, {
        align: 'center',
        color: COLOR.hit,
      });
      era.print('对手布舰：倾向未知', { align: 'center', color: COLOR.unknown });
      era.printButton(`先手：${firstPlayerLabel(firstPlayerChoice)}`, 800, {
        align: 'center',
        buttonType: 'primary',
      });
      const selected = session.game.playerBoard.ships.find(
        (ship) => ship.id === placement.selectedShipId,
      );
      era.print(
        selected
          ? `当前布置：长度 ${selected.length}${placement.firstEndpoint !== null ? '　请选择白色终点' : ''}`
          : '舰队已经布置完毕。',
        { align: 'center' },
      );
      renderPlacementBoard(era, session.game.playerBoard, placement);
      era.drawLine();
      era.printMultiColumns([
        {
          accelerator: 900,
          config: {
            align: 'center',
            disabled:
              placement.firstEndpoint === null && placement.movingOriginalCells === null,
            width: 8,
          },
          content: '取消放置',
          type: 'button',
        },
        {
          accelerator: 901,
          config: { align: 'center', width: 8 },
          content: '清空全部',
          type: 'button',
        },
        {
          accelerator: 902,
          config: { align: 'center', disabled: !isBoardReady(session.game.playerBoard), width: 8 },
          content: '确认布舰',
          type: 'button',
        },
      ]);
      era.printButton('退出 BATTLEGRID', 999, { align: 'right' });
      const input = Number(await era.input());
      if (input === 999) return { outcome: 'aborted' };
      if (input === 800) firstPlayerChoice = cycleFirstPlayer(firstPlayerChoice);
      else if (input === 900) cancelPlacement(session.game.playerBoard, placement);
      else if (input === 901) clearFleet(session.game.playerBoard, placement);
      else if (input === 902 && isBoardReady(session.game.playerBoard)) {
        beginSession(session, firstPlayerChoice, rng);
      } else if (input >= CELL_BUTTON_BASE && input < CELL_BUTTON_BASE + 64) {
        clickPlacementCell(session.game.playerBoard, placement, input - CELL_BUTTON_BASE);
      }
    }

    let confirmSurrender = false;
    while (session.game.phase !== PHASE.FINISHED) {
      if (session.game.phase === PHASE.AI_TURN) {
        await renderTimedMatchFrame(
          era,
          session.game,
          options.aiDelay ?? 1000,
          '对手正在判断目标……',
        );
        aiFire(session, rng);
        continue;
      }

      if (session.game.phase === PHASE.AI_RESULT) {
        await renderTimedMatchFrame(
          era,
          session.game,
          options.aiResultDelay ?? 750,
          historyText(session.game.history[session.game.history.length - 1]),
        );
        beginPlayerTurn(session);
        continue;
      }

      if (session.game.phase === PHASE.PLAYER_END) {
        await confirmPlayerResult(era, session.game, options.playerResultDelay ?? 750);
        endPlayerTurn(session);
        continue;
      }

      await era.clear();
      renderMatch(era, session.game, true);

      if (confirmSurrender) {
        era.print('确定要认输并退出本局吗？', { align: 'center', color: COLOR.sunk });
        era.printMultiColumns([
          {
            accelerator: 990,
            config: { align: 'center', buttonType: 'danger', width: 12 },
            content: '确认认输',
            type: 'button',
          },
          {
            accelerator: 991,
            config: { align: 'center', width: 12 },
            content: '继续对局',
            type: 'button',
          },
        ]);
      } else {
        era.printButton('认输并退出', 999, {
          align: 'right',
          buttonType: 'danger',
        });
      }

      const input = Number(await era.input());
      if (input === 999) confirmSurrender = true;
      else if (input === 991) confirmSurrender = false;
      else if (input === 990 && confirmSurrender) surrender(session.game);
      else if (
        !confirmSurrender &&
        input >= ATTACK_BUTTON_BASE &&
        input < ATTACK_BUTTON_BASE + 64
      ) {
        playerFire(session, input - ATTACK_BUTTON_BASE);
      }
    }

    finishMatchLog(session);
    await session.log.pending;
    if (session.log.error) console.warn(`BATTLEGRID 日志写入失败：${session.log.error}`);
    await showSettlement(era, session.game);
    return buildResult(session.game);
  };
}

module.exports = {
  COLOR,
  buildBattleBoardColumn,
  buildResult,
  confirmPlayerResult,
  createEraPage,
  cycleFirstPlayer,
  firstPlayerLabel,
  fleetSummary,
  historyText,
  historyContent,
  showReview,
  showSettlement,
  renderBattleBoard,
  renderBattleBoardsSideBySide,
  renderMatch,
  renderTimedMatchFrame,
  renderPlacementBoard,
  shotPresentation,
  targetingProfileText,
};
