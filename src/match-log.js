function createMatchLog() {
  const logger = { records: [], error: null, ended: false };
  logger.write = (record) => logger.records.push(
    JSON.parse(JSON.stringify({ at: new Date().toISOString(), ...record })),
  );
  return logger;
}

function createEngineMatchLog(era) {
  const logger = createMatchLog();
  let archive = [];
  try {
    const saved = era.get('global:0');
    if (typeof saved === 'string') archive = JSON.parse(saved);
    if (!Array.isArray(archive)) archive = [];
  } catch (_) { archive = []; }
  // Keep the most recent 20 matches, including interrupted sessions.
  archive = archive.slice(-19);
  archive.push({ id: new Date().toISOString(), records: logger.records });
  logger.pending = Promise.resolve();
  const memoryWrite = logger.write;
  logger.write = (record) => {
    memoryWrite(record);
    logger.pending = logger.pending.then(async () => {
      if (logger.error) return;
      try {
        era.set('global:0', JSON.stringify(archive));
        if (await era.saveGlobal() === false) logger.error = '引擎保存对局日志失败';
      } catch (error) { logger.error = error.message; }
    });
  };
  return logger;
}

function finishMatchLog(session) {
  const logger = session.log;
  if (!logger || logger.ended) return;
  logger.write({ type: 'finish', outcome: session.game.result,
    rounds: session.game.round, shots: session.game.history.length });
  logger.ended = true;
}

function logAction(session, actor, knowledge, result, decision = null) {
  if (!session.log || !result.ok) return;
  const entry = session.game.history[session.game.history.length - 1];
  session.log.write({ type: 'shot', actor, round: entry.round,
    knowledge, result, review: entry.review, decision });
  if (result.gameOver) finishMatchLog(session);
}

module.exports = { createMatchLog, createEngineMatchLog, finishMatchLog, logAction };
