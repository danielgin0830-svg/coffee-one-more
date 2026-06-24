function getPlainNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function formatRatioNumber(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getActualRatioValue(doseGrams, totalWater) {
  const dose = getPlainNumber(doseGrams);
  const water = getPlainNumber(totalWater);
  if (!dose || !water) return null;
  return Math.round((water / dose) * 10) / 10;
}

function formatActualRatioText(doseGrams, totalWater, fallback = '') {
  const ratio = getActualRatioValue(doseGrams, totalWater);
  if (ratio === null) return fallback;
  return `1:${formatRatioNumber(ratio)}`;
}

function formatRecipeRatioText(recipe = {}, fallback = '') {
  const actualText = formatActualRatioText(recipe.doseGrams, recipe.totalWater);
  if (actualText) return actualText;
  if (recipe.ratioText) return String(recipe.ratioText);
  if (recipe.ratio) {
    const ratioText = String(recipe.ratio);
    return ratioText.includes(':') ? ratioText : `1:${ratioText}`;
  }
  return fallback;
}

module.exports = {
  formatActualRatioText,
  formatRecipeRatioText,
  getActualRatioValue
};
