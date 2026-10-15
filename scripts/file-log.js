// CLI-only adapter. EraElectron must never import this module.
const fs = require('fs');
const path = require('path');
function createFileMatchLog() {
  const directory = path.resolve(__dirname, '..', 'logs');
  const name = `match-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(16).slice(2, 8)}.jsonl`;
  const logger = { path: path.join(directory, name), error: null, ended: false };
  logger.write = (record) => {
    if (logger.error) return;
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.appendFileSync(logger.path, JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n', 'utf8');
    } catch (error) { logger.error = error.message; }
  };
  return logger;
}
module.exports = { createFileMatchLog };
