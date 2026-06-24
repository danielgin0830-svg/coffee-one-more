const DAY_MS = 24 * 60 * 60 * 1000;

const ROAST_LEVEL_OPTIONS = [
  { id: 'ultra_light', label: '极浅烘' },
  { id: 'light', label: '浅烘' },
  { id: 'medium', label: '中烘' },
  { id: 'dark', label: '深烘' },
  { id: 'ultra_dark', label: '极度深烘' }
];

function buildBeanViewList(beans = [], selectedBatchIds = []) {
  return beans
    .map(bean => enrichBean(bean, selectedBatchIds))
    .sort(compareBeansByStock);
}

function enrichBean(bean = {}, selectedBatchIds = []) {
  const roastAgeDays = getRoastAgeDays(bean.roastDate);
  const roastLevelLabel = getRoastLevelLabel(bean.roastLevel);
  const stockNumber = getStockNumber(bean.stockGrams);
  const stockDisplay = stockNumber === null ? '' : formatNumber(stockNumber);
  return {
    ...bean,
    stockDisplay,
    stockText: stockDisplay === '' ? '未填' : `${stockDisplay}克`,
    stockSort: stockNumber,
    stockKnown: stockNumber !== null,
    roastLevelLabel,
    roastAgeDays,
    roastAgeSort: roastAgeDays >= 0 ? roastAgeDays : -1,
    roastAgeLabel: roastAgeDays >= 0 ? `烘焙后 ${roastAgeDays} 天` : '未记录烘焙日期',
    roastAgeClass: getRoastAgeClass(roastAgeDays),
    batchSelected: selectedBatchIds.includes(bean.id)
  };
}

function compareBeansByStock(a, b) {
  const aStock = getStockNumber(a.stockGrams);
  const bStock = getStockNumber(b.stockGrams);
  if ((aStock === null) !== (bStock === null)) return aStock === null ? 1 : -1;
  if (aStock === null && bStock === null) return compareBeansByRoastAge(a, b);
  const stockDiff = bStock - aStock;
  if (stockDiff !== 0) return stockDiff;
  return compareBeansByRoastAge(a, b);
}

function compareBeansByRoastAge(a, b) {
  if (b.roastAgeSort !== a.roastAgeSort) {
    return b.roastAgeSort - a.roastAgeSort;
  }
  return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
}

function splitBeansByStock(beans = []) {
  return {
    activeBeans: beans.filter(bean => {
      const stock = getStockNumber(bean.stockGrams);
      return stock === null || stock > 0;
    }),
    finishedBeans: beans.filter(bean => {
      const stock = getStockNumber(bean.stockGrams);
      return stock !== null && stock <= 0;
    })
  };
}

function getRoastAgeDays(roastDate) {
  const date = parseLocalDate(roastDate);
  if (!date) return -1;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = todayStart.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / DAY_MS));
}

function parseLocalDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRoastAgeClass(days) {
  if (days < 0) return 'unknown';
  if (days >= 30) return 'old';
  if (days <= 10) return 'fresh';
  return 'ready';
}

function getRoastLevelLabel(roastLevel) {
  const option = ROAST_LEVEL_OPTIONS.find(item => item.id === roastLevel);
  return option ? option.label : '';
}

function getRoastLevelIndex(roastLevel) {
  const index = ROAST_LEVEL_OPTIONS.findIndex(item => item.id === roastLevel);
  return index >= 0 ? index : 0;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getStockNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.round(number));
}

function formatNumber(value) {
  return Number.isInteger(value) ? value : Number(value.toFixed(1));
}

module.exports = {
  ROAST_LEVEL_OPTIONS,
  buildBeanViewList,
  enrichBean,
  formatNumber,
  getRoastAgeClass,
  getRoastAgeDays,
  getRoastLevelIndex,
  getRoastLevelLabel,
  getStockNumber,
  splitBeansByStock,
  toNumber
};
