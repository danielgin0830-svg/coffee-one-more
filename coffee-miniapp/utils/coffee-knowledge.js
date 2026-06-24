const FLAVOR_GROUPS = [
  { id: 'floral', label: '花香', labelEn: 'Floral', aliases: ['花香', '白花', '茉莉', '橙花', '玫瑰', '桂花', '紫罗兰', 'floral', 'flower', 'jasmine', 'orange blossom', 'rose', 'osmanthus', 'violet'] },
  { id: 'citrus', label: '柑橘', labelEn: 'Citrus', aliases: ['柑橘', '橙子', '橙', '血橙', '柠檬', '莱姆', '青柠', '葡萄柚', '西柚', '佛手柑', '柚子', 'citrus', 'orange', 'lemon', 'lime', 'grapefruit', 'bergamot', 'pomelo'] },
  { id: 'berry', label: '莓果', labelEn: 'Berry', aliases: ['莓果', '草莓', '蓝莓', '黑莓', '覆盆子', '蔓越莓', '醋栗', '黑加仑', 'berry', 'strawberry', 'blueberry', 'blackberry', 'raspberry', 'cranberry', 'currant', 'cassis'] },
  { id: 'tropical', label: '热带水果', labelEn: 'Tropical Fruit', aliases: ['热带', '芒果', '菠萝', '凤梨', '百香果', '番石榴', '荔枝', '椰子', '木瓜', 'tropical', 'mango', 'pineapple', 'passion fruit', 'guava', 'lychee', 'coconut', 'papaya'] },
  { id: 'stoneFruit', label: '核果', labelEn: 'Stone Fruit', aliases: ['桃', '黄桃', '水蜜桃', '杏', '李子', '樱桃', 'peach', 'apricot', 'plum', 'cherry', 'nectarine'] },
  { id: 'applePear', label: '苹果梨', labelEn: 'Apple / Pear', aliases: ['苹果', '青苹果', '梨', 'apple', 'green apple', 'pear'] },
  { id: 'tea', label: '茶感', labelEn: 'Tea-like', aliases: ['茶感', '红茶', '乌龙', '绿茶', '伯爵茶', 'tea', 'black tea', 'oolong', 'green tea', 'earl grey'] },
  { id: 'sweet', label: '甜感', labelEn: 'Sweet', aliases: ['甜', '蜂蜜', '焦糖', '太妃糖', '红糖', '黑糖', '枫糖', '糖浆', 'sweet', 'honey', 'caramel', 'toffee', 'brown sugar', 'maple syrup', 'syrup'] },
  { id: 'chocolate', label: '巧克力', labelEn: 'Chocolate', aliases: ['巧克力', '黑巧', '可可', '可可粉', 'chocolate', 'dark chocolate', 'cocoa', 'cacao'] },
  { id: 'nutty', label: '坚果', labelEn: 'Nutty', aliases: ['坚果', '杏仁', '榛果', '榛子', '花生', '核桃', 'nutty', 'almond', 'hazelnut', 'peanut', 'walnut'] },
  { id: 'creamy', label: '奶油', labelEn: 'Creamy', aliases: ['奶油', '黄油', '牛奶', 'cream', 'creamy', 'butter', 'milk'] },
  { id: 'spice', label: '香料', labelEn: 'Spice', aliases: ['香料', '肉桂', '丁香', '香草', 'spice', 'cinnamon', 'clove', 'vanilla'] },
  { id: 'fermented', label: '发酵感', labelEn: 'Fermented', aliases: ['酒香', '酒酿', '发酵', '果酱', '熟果', '葡萄酒', '红酒', 'winey', 'wine', 'rum', 'brandy', 'fermented', 'jammy', 'overripe'] },
  { id: 'tailRisk', label: '尾段风险', labelEn: 'Tail Risk', aliases: ['木质', '木头', '苦', '苦味', '涩', '草本', '烟熏', '泥土', 'woody', 'bitter', 'astringent', 'herbal', 'smoky', 'earthy'] }
];

function matchFlavorGroups(text) {
  const source = normalizeText(text);
  return FLAVOR_GROUPS.map(group => {
    const matched = (group.aliases || []).filter(alias => source.includes(normalizeText(alias)));
    if (!matched.length) return null;
    return {
      id: group.id,
      label: group.label,
      labelEn: group.labelEn,
      matched
    };
  }).filter(Boolean);
}

function analyzeFlavorText(text) {
  const matches = matchFlavorGroups(text);
  const ids = new Set(matches.map(item => item.id));
  const matchedText = matches.map(item => item.label).join('、');

  if (ids.has('tailRisk')) return { family: 'tailRisk', matchedText, matches };
  if (ids.has('fermented') || ids.has('tropical') || ids.has('berry')) return { family: 'fermented', matchedText, matches };
  if (ids.has('floral') || ids.has('citrus') || ids.has('tea') || ids.has('stoneFruit') || ids.has('applePear')) return { family: 'brightDisplay', matchedText, matches };
  if (ids.has('sweet') || ids.has('chocolate') || ids.has('nutty') || ids.has('creamy') || ids.has('spice')) return { family: 'sweetClean', matchedText, matches };
  return { family: 'neutral', matchedText: '', matches };
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

module.exports = {
  FLAVOR_GROUPS,
  analyzeFlavorText,
  matchFlavorGroups
};
