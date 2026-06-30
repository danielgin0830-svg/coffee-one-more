// 冲煮消费流水：每次冲煮扣库存时追加一条记录，供后续消费趋势 / 咖啡人格统计使用。
// 注意：只能从埋点上线后开始累积，历史冲煮无法回溯。
const {
  getUserStorageSync,
  setUserStorageSync
} = require('./auth.js');

const BREW_LOG_KEY = 'brewLogs';
const MAX_BREW_LOGS = 1000;

// 追加一条冲煮记录。缺少 beanId 或有效克数时跳过，不写脏数据
function appendBrewLog(entry = {}) {
  const beanId = entry.beanId;
  const grams = Number(entry.grams);
  if (!beanId || !Number.isFinite(grams) || grams <= 0) return null;

  const log = {
    beanId,
    beanName: String(entry.beanName || '').trim(),
    grams: Math.round(grams * 10) / 10,
    processing: String(entry.processing || '').trim(),
    roastLevel: String(entry.roastLevel || '').trim(),
    at: entry.at || new Date().toISOString()
  };

  const logs = getUserStorageSync(BREW_LOG_KEY, []);
  const next = logs.concat(log);
  const trimmed = next.length > MAX_BREW_LOGS
    ? next.slice(next.length - MAX_BREW_LOGS)
    : next;
  setUserStorageSync(BREW_LOG_KEY, trimmed);
  return log;
}

function getBrewLogs() {
  return getUserStorageSync(BREW_LOG_KEY, []);
}

module.exports = {
  BREW_LOG_KEY,
  appendBrewLog,
  getBrewLogs
};
