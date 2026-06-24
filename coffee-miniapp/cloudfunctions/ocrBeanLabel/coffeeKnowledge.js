const ORIGIN_GROUPS = [
  {
    country: '埃塞俄比亚',
    countryEn: 'Ethiopia',
    aliases: ['埃塞俄比亚', '衣索比亚', 'Ethiopia', 'Ethiopian'],
    regions: [
      { name: '耶加雪菲', en: 'Yirgacheffe', aliases: ['耶加雪菲', '耶加雪啡', '耶加', 'Yirgacheffe', 'Yirgachefe'] },
      { name: '西达摩', en: 'Sidamo / Sidama', aliases: ['西达摩', '西达马', 'Sidamo', 'Sidama'] },
      { name: '古吉', en: 'Guji', aliases: ['古吉', 'Guji'] },
      { name: '科契尔', en: 'Kochere', aliases: ['科契尔', '科切尔', 'Kochere'] },
      { name: '歌迪贝', en: 'Gedeb', aliases: ['歌迪贝', '洁蒂普', 'Gedeb'] },
      { name: '阿尔西', en: 'Arsi', aliases: ['阿尔西', 'Arsi'] },
      { name: '利姆', en: 'Limu', aliases: ['利姆', 'Limu'] },
      { name: '哈拉尔', en: 'Harrar', aliases: ['哈拉尔', 'Harrar', 'Harar'] }
    ]
  },
  {
    country: '肯尼亚',
    countryEn: 'Kenya',
    aliases: ['肯尼亚', 'Kenya', 'Kenyan'],
    regions: [
      { name: '涅里', en: 'Nyeri', aliases: ['涅里', 'Nyeri'] },
      { name: '基安布', en: 'Kiambu', aliases: ['基安布', 'Kiambu'] },
      { name: '麒麟雅加', en: 'Kirinyaga', aliases: ['麒麟雅加', 'Kirinyaga'] },
      { name: '穆兰加', en: 'Muranga', aliases: ['穆兰加', 'Muranga', "Murang'a"] },
      { name: '恩布', en: 'Embu', aliases: ['恩布', 'Embu'] }
    ]
  },
  {
    country: '哥伦比亚',
    countryEn: 'Colombia',
    aliases: ['哥伦比亚', 'Colombia', 'Colombian'],
    regions: [
      { name: '蕙兰', en: 'Huila', aliases: ['蕙兰', '慧兰', 'Huila'] },
      { name: '考卡', en: 'Cauca', aliases: ['考卡', 'Cauca'] },
      { name: '纳里尼奥', en: 'Narino / Nariño', aliases: ['纳里尼奥', 'Nariño', 'Narino'] },
      { name: '托利马', en: 'Tolima', aliases: ['托利马', 'Tolima'] },
      { name: '金迪奥', en: 'Quindio', aliases: ['金迪奥', 'Quindio', 'Quindío'] }
    ]
  },
  {
    country: '巴拿马',
    countryEn: 'Panama',
    aliases: ['巴拿马', 'Panama', 'Panamanian'],
    regions: [
      { name: '波奎特', en: 'Boquete', aliases: ['波奎特', 'Boquete'] },
      { name: '奇里基', en: 'Chiriqui / Chiriquí', aliases: ['奇里基', 'Chiriqui', 'Chiriquí'] },
      { name: '翡翠庄园', en: 'Esmeralda', aliases: ['翡翠庄园', '翡翠', 'Esmeralda'] }
    ]
  },
  {
    country: '哥斯达黎加',
    countryEn: 'Costa Rica',
    aliases: ['哥斯达黎加', 'Costa Rica', 'Costa Rican'],
    regions: [
      { name: '塔拉珠', en: 'Tarrazu / Tarrazú', aliases: ['塔拉珠', 'Tarrazu', 'Tarrazú'] },
      { name: '中央谷', en: 'Central Valley', aliases: ['中央谷', 'Central Valley'] },
      { name: '西部谷', en: 'West Valley', aliases: ['西部谷', 'West Valley'] }
    ]
  },
  {
    country: '危地马拉',
    countryEn: 'Guatemala',
    aliases: ['危地马拉', 'Guatemala', 'Guatemalan'],
    regions: [
      { name: '安提瓜', en: 'Antigua', aliases: ['安提瓜', 'Antigua'] },
      { name: '薇薇特南果', en: 'Huehuetenango', aliases: ['薇薇特南果', '韦韦特南果', 'Huehuetenango'] },
      { name: '阿蒂特兰', en: 'Atitlan / Atitlán', aliases: ['阿蒂特兰', 'Atitlan', 'Atitlán'] }
    ]
  },
  { country: '洪都拉斯', countryEn: 'Honduras', aliases: ['洪都拉斯', 'Honduras', 'Honduran'], regions: [] },
  { country: '萨尔瓦多', countryEn: 'El Salvador', aliases: ['萨尔瓦多', 'El Salvador', 'Salvador'], regions: [] },
  { country: '尼加拉瓜', countryEn: 'Nicaragua', aliases: ['尼加拉瓜', 'Nicaragua'], regions: [] },
  { country: '巴西', countryEn: 'Brazil', aliases: ['巴西', 'Brazil', 'Brazilian'], regions: [] },
  { country: '秘鲁', countryEn: 'Peru', aliases: ['秘鲁', 'Peru', 'Peruvian'], regions: [] },
  { country: '卢旺达', countryEn: 'Rwanda', aliases: ['卢旺达', 'Rwanda'], regions: [] },
  { country: '布隆迪', countryEn: 'Burundi', aliases: ['布隆迪', 'Burundi'], regions: [] },
  { country: '印尼', countryEn: 'Indonesia', aliases: ['印尼', '印度尼西亚', 'Indonesia', 'Indonesian', '苏门答腊', 'Sumatra'], regions: [] },
  { country: '中国云南', countryEn: 'Yunnan, China', aliases: ['云南', '中国云南', '普洱', '保山', 'Yunnan'], regions: [] }
];

const PROCESSING_GROUPS = [
  { id: 'other', label: '特殊处理', labelEn: 'Special / Experimental', aliases: ['厌氧', '厌氧发酵', '重发酵', '发酵', '红酒处理', '乳酸发酵', '酵母发酵', '二氧化碳浸渍', 'carbonic', 'anaerobic', 'fermented', 'experimental', 'wine process'] },
  { id: 'washed', label: '水洗', labelEn: 'Washed', aliases: ['水洗', 'washed', 'wash process', 'fully washed'] },
  { id: 'natural', label: '日晒', labelEn: 'Natural', aliases: ['日晒', '自然处理', 'natural', 'dry process', 'sundried', 'sun dried'] },
  { id: 'honey', label: '蜜处理', labelEn: 'Honey', aliases: ['蜜处理', '黄蜜', '红蜜', '黑蜜', '白蜜', 'honey', 'yellow honey', 'red honey', 'black honey', 'white honey'] }
];

const ROAST_LEVEL_GROUPS = [
  { id: 'ultra_light', label: '极浅烘', labelEn: 'Ultra Light', aliases: ['极浅', '极浅烘', '极浅烘焙', 'ultra light'] },
  { id: 'light', label: '浅烘', labelEn: 'Light', aliases: ['浅烘', '浅度', '浅度烘焙', '中浅', '中浅烘', 'light roast', 'light'] },
  { id: 'medium', label: '中烘', labelEn: 'Medium', aliases: ['中烘', '中度', '中度烘焙', 'medium roast', 'medium'] },
  { id: 'ultra_dark', label: '极度深烘', labelEn: 'Ultra Dark', aliases: ['极深', '极度深烘', '法式', '意式深烘', 'ultra dark', 'french roast', 'italian roast'] },
  { id: 'dark', label: '深烘', labelEn: 'Dark', aliases: ['中深', '中深烘', '深烘', '深度', 'dark roast', 'dark'] }
];

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

function matchOrigin(text) {
  const source = normalizeText(text);
  let matchedCountry = null;
  let matchedRegion = null;

  ORIGIN_GROUPS.forEach(group => {
    if (!matchedCountry && hasAlias(source, group.aliases)) {
      matchedCountry = group;
    }
    (group.regions || []).forEach(region => {
      if (!matchedRegion && hasAlias(source, region.aliases)) {
        matchedRegion = {
          ...region,
          country: group.country,
          countryEn: group.countryEn
        };
        matchedCountry = matchedCountry || group;
      }
    });
  });

  if (!matchedCountry && !matchedRegion) return null;
  const country = matchedCountry || { country: matchedRegion.country, countryEn: matchedRegion.countryEn };
  return {
    country: country.country,
    countryEn: country.countryEn,
    region: matchedRegion ? matchedRegion.name : '',
    regionEn: matchedRegion ? matchedRegion.en : '',
    originText: matchedRegion ? `${country.country} ${matchedRegion.name}` : country.country
  };
}

function matchProcessing(text) {
  return matchFirstGroup(text, PROCESSING_GROUPS);
}

function matchRoastLevel(text) {
  return matchFirstGroup(text, ROAST_LEVEL_GROUPS);
}

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

function buildFlavorNotes(text) {
  return matchFlavorGroups(text).map(item => item.label).join('、');
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

function matchFirstGroup(text, groups) {
  const source = normalizeText(text);
  return groups.find(group => hasAlias(source, group.aliases)) || null;
}

function hasAlias(source, aliases = []) {
  return aliases.some(alias => source.includes(normalizeText(alias)));
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

module.exports = {
  ORIGIN_GROUPS,
  PROCESSING_GROUPS,
  ROAST_LEVEL_GROUPS,
  FLAVOR_GROUPS,
  analyzeFlavorText,
  buildFlavorNotes,
  matchFlavorGroups,
  matchOrigin,
  matchProcessing,
  matchRoastLevel
};
