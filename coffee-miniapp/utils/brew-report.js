const {
  getBrewLogs
} = require('./brew-log.js');

const REPORT_CONFIG = {
  weekly: {
    type: 'weekly',
    title: '咖啡周报',
    label: '周报',
    days: 7,
    minActiveDays: 3,
    emptyMessage: '还要多喝几天才能看到周报哦'
  },
  monthly: {
    type: 'monthly',
    title: '咖啡月报',
    label: '月报',
    days: 30,
    minActiveDays: 10,
    emptyMessage: '还要多喝几天才能看到月报哦'
  }
};

const PROCESSING_LABELS = {
  washed: '水洗',
  natural: '日晒',
  honey: '蜜处理',
  anaerobic: '厌氧/重发酵',
  other: '其他'
};

const ROAST_LABELS = {
  ultra_light: '极浅烘',
  light: '浅烘',
  medium: '中烘',
  dark: '深烘',
  ultra_dark: '极深烘'
};

function buildBrewReport(type = 'weekly') {
  return buildReportFromLogs(getBrewLogs(), type);
}

function buildReportFromLogs(logs = [], type = 'weekly', now = new Date()) {
  const config = getReportConfig(type);
  const { start, end } = getPeriodRange(config.days, now);
  const periodLogs = normalizeLogs(logs).filter(log => log.date >= start && log.date <= end);
  const activeDayKeys = getUniqueValues(periodLogs, log => log.dateKey);
  const activeDays = activeDayKeys.length;
  const totalCups = periodLogs.length;
  const totalGramsValue = periodLogs.reduce((sum, log) => sum + log.grams, 0);
  const daily = buildDailySeries(start, config.days, periodLogs);
  const topBean = getTopValue(periodLogs, log => log.beanName || '未命名豆子');
  const topProcessing = getTopValue(periodLogs, log => formatMappedLabel(log.processing, PROCESSING_LABELS));
  const topRoast = getTopValue(periodLogs, log => formatMappedLabel(log.roastLevel, ROAST_LABELS));
  const available = activeDays >= config.minActiveDays;

  return {
    type: config.type,
    title: config.title,
    label: config.label,
    available,
    emptyMessage: config.emptyMessage,
    periodLabel: `${formatShortDate(start)} - ${formatShortDate(end)}`,
    progressText: available ? `已记录 ${activeDays} 天` : `已记录 ${activeDays}/${config.minActiveDays} 天`,
    days: config.days,
    minActiveDays: config.minActiveDays,
    totalCups,
    totalGrams: formatNumber(totalGramsValue),
    activeDays,
    avgGrams: totalCups ? formatNumber(totalGramsValue / totalCups) : '0',
    topBeanLabel: topBean.label,
    topBeanCups: topBean.count,
    topProcessingLabel: topProcessing.label,
    topProcessingCups: topProcessing.count,
    topRoastLabel: topRoast.label,
    topRoastCups: topRoast.count,
    daily,
    heroTitle: buildHeroTitle(config, totalCups, activeDays),
    summary: buildSummary(config, totalCups, totalGramsValue, activeDays, topBean.label)
  };
}

function getReportConfig(type) {
  return REPORT_CONFIG[type] || REPORT_CONFIG.weekly;
}

function normalizeLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs.reduce((result, log) => {
    const grams = Number(log && log.grams);
    const date = new Date(log && log.at);
    if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(date.getTime())) return result;
    result.push({
      ...log,
      grams,
      date,
      dateKey: formatDateKey(date)
    });
    return result;
  }, []);
}

function getPeriodRange(days, now) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function buildDailySeries(start, days, logs) {
  const bucket = logs.reduce((map, log) => {
    if (!map[log.dateKey]) {
      map[log.dateKey] = {
        cups: 0,
        grams: 0
      };
    }
    map[log.dateKey].cups += 1;
    map[log.dateKey].grams += log.grams;
    return map;
  }, {});

  const rows = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = formatDateKey(date);
    const value = bucket[dateKey] || { cups: 0, grams: 0 };
    rows.push({
      dateKey,
      label: formatShortDate(date),
      cups: value.cups,
      grams: formatNumber(value.grams)
    });
  }

  const maxGrams = rows.reduce((max, row) => Math.max(max, Number(row.grams)), 0);
  return rows.map(row => ({
    ...row,
    barWidth: row.cups && maxGrams ? Math.max(8, Math.round((Number(row.grams) / maxGrams) * 100)) : 0
  }));
}

function getTopValue(logs, selector) {
  const counts = logs.reduce((map, log) => {
    const label = selector(log) || '未记录';
    if (!map[label]) {
      map[label] = {
        label,
        count: 0
      };
    }
    map[label].count += 1;
    return map;
  }, {});
  const sorted = Object.keys(counts).map(key => counts[key]).sort((a, b) => b.count - a.count);
  return sorted[0] || {
    label: '暂无记录',
    count: 0
  };
}

function getUniqueValues(items, selector) {
  return Object.keys(items.reduce((map, item) => {
    const value = selector(item);
    if (value) map[value] = true;
    return map;
  }, {}));
}

function formatMappedLabel(value, labels) {
  const text = String(value || '').trim();
  if (!text) return '未记录';
  return labels[text] || text;
}

function buildHeroTitle(config, totalCups, activeDays) {
  if (!totalCups) return `${config.label}还在酝酿中`;
  return `${config.label}喝了 ${totalCups} 杯，点亮 ${activeDays} 天`;
}

function buildSummary(config, totalCups, totalGrams, activeDays, topBeanLabel) {
  if (!totalCups) return `最近 ${config.days} 天还没有冲煮记录。`;
  const topText = topBeanLabel && topBeanLabel !== '暂无记录' ? `最常出现的是「${topBeanLabel}」。` : '';
  return `最近 ${config.days} 天记录了 ${activeDays} 个喝咖啡的日子，共消耗 ${formatNumber(totalGrams)}g 咖啡豆。${topText}`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatNumber(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

module.exports = {
  REPORT_CONFIG,
  buildBrewReport,
  buildReportFromLogs,
  getReportConfig
};
