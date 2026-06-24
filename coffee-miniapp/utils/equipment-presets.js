const CUP_CATEGORY_LABELS = {
  regular_cone: '常规锥形（V60）',
  regular_flat: '常规平底（Kalita蛋糕杯、泰摩B75）',
  low_bypass_cone: '低旁通锥形（Hario无限）',
  low_bypass_flat: '低旁通平底（Orea系列、SD1R、SOLO）',
  immersion: '浸泡式（暂不参与当前手冲方案）',
  mixed: '其他/混合型（暂不参与当前手冲方案）'
};

function cup(id, brand, model, note, category, brewCupId = category) {
  return {
    id,
    type: 'cup',
    brand,
    model,
    note,
    category,
    mapping: CUP_CATEGORY_LABELS[category] || '',
    brewCupId,
    preset: true
  };
}

const CUP_PRESETS = [
  // 旁通锥形
  cup('preset-cup-hario-v60', 'Hario', 'V60 01/02', '旁通锥形基准 · 60度锥形大开孔', 'regular_cone'),
  cup('preset-cup-hario-v60-suiren', 'Hario', 'V60 Suiren', '旁通锥形 · 花瓣结构增加空气通道', 'regular_cone'),
  cup('preset-cup-hario-w60', 'Hario', 'W60', '旁通锥形 · V60结构，可叠加树脂滤网', 'regular_cone'),
  cup('preset-cup-cafec-flower', 'CAFEC', 'Flower Dripper', '旁通锥形 · 花瓣肋骨，甜感和香气型', 'regular_cone'),
  cup('preset-cup-cafec-deep27', 'CAFEC', 'Deep 27', '旁通锥形 · 深窄小粉量高粉床', 'regular_cone'),
  cup('preset-cup-kono-meimon', 'KONO', 'Meimon / MDN / MDK', '旁通锥形 · 半肋/短肋变速锥形', 'regular_cone'),
  cup('preset-cup-origami', 'Origami', '折纸滤杯', '旁通锥形 · 旧版预设兼容，默认按V60锥形滤纸联动', 'regular_cone'),
  cup('preset-cup-origami-v60', 'Origami', '折纸滤杯 + V60锥形滤纸', '旁通锥形 · 大量侧壁空气通道', 'regular_cone'),
  cup('preset-cup-kinto-oct', 'Kinto', 'OCT', '旁通锥形 · 八角锥形结构', 'regular_cone'),
  cup('preset-cup-timemore-crystal-eye-cone', '泰摩', 'Crystal Eye 锥形', '旁通锥形 · 国产常见V60类', 'regular_cone'),
  cup('preset-cup-mhw3bomber-cone', 'MHW-3BOMBER', '轰炸机锥形 / Crystal Eye类', '旁通锥形 · 肋骨支撑滤纸', 'regular_cone'),
  cup('preset-cup-brewista-tornado-duo', 'Brewista', 'Tornado Duo', '旁通锥形 · 立体肋骨增强排气', 'regular_cone'),
  cup('preset-cup-loveramics-v-shaped', 'Loveramics', 'Brewers V-shaped', '旁通锥形 · V型滤杯', 'regular_cone'),
  cup('preset-cup-graycano', 'Graycano', 'Graycano', '旁通锥形 · 侧壁立柱，高流速高热稳定', 'regular_cone'),
  cup('preset-cup-chemex', 'Classic', 'Chemex', '旁通锥形 · 厚滤纸，高干净度', 'regular_cone'),

  // 旁通平底
  cup('preset-cup-kalita-wave', 'Kalita', 'Wave 155/185', '旁通平底基准 · 平底三孔', 'regular_flat'),
  cup('preset-cup-timemore-b75', '泰摩', 'B75 金龙', '旁通平底 · 大孔快流甜感型', 'regular_flat'),
  cup('preset-cup-orea-baby-o-wave', 'Orea', 'Baby O + Wave', '旁通平底 · 小平底，保留侧壁空间', 'regular_flat'),
  cup('preset-cup-orea-v3-v4-wave', 'Orea', 'V3/V4 + Wave', '旁通平底 · Wave滤纸玩法', 'regular_flat'),
  cup('preset-cup-origami-wave', 'Origami', '折纸滤杯 + Wave蛋糕滤纸', '旁通平底 · 折纸杯形成平底粉床', 'regular_flat'),
  cup('preset-cup-april-brewer', 'April', 'April Brewer', '旁通平底 · 双孔，甜感和均匀萃取', 'regular_flat'),
  cup('preset-cup-fellow-stagg', 'Fellow', 'Stagg X / XF', '旁通平底 · 陡壁保温，粉床厚', 'regular_flat'),
  cup('preset-cup-notneutral-gino', 'notNeutral', 'Gino Dripper', '旁通平底 · 玻璃滤杯，类Kalita思路', 'regular_flat'),
  cup('preset-cup-blue-bottle-dripper', 'Blue Bottle', 'Dripper', '旁通平底 · 单孔控流，稳定取向', 'regular_flat'),
  cup('preset-cup-torch-donut', 'Torch', 'Donut Dripper', '旁通平底 · 蛋糕滤纸系统', 'regular_flat'),
  cup('preset-cup-loveramics-flatbed', 'Loveramics', 'Brewers Flatbed', '旁通平底 · 平底滤杯', 'regular_flat'),
  cup('preset-cup-december-dripper', 'December', 'Dripper', '旁通平底 · 可调孔径，Wave滤纸', 'regular_flat'),

  // 低旁通锥形
  cup('preset-cup-hario-mugen', 'Hario', 'V60 Mugen 十字星无限滤杯', '低旁通锥形 · 平滑杯壁，滤纸更贴壁', 'low_bypass_cone'),
  cup('preset-cup-hario-mugen-switch', 'Hario', 'Mugen + Switch底座', '低旁通锥形 · 低旁通杯体 + 阀门释放', 'low_bypass_cone'),
  cup('preset-cup-cofil-fuji', 'Cofil', 'Fuji', '低旁通锥形 · 低肋骨/高贴合倾向', 'low_bypass_cone'),
  cup('preset-cup-nextlevel-lvl10', 'NextLevel', 'LVL-10', '低旁通锥形 · 早期低旁通系统', 'low_bypass_cone'),
  cup('preset-cup-hario-mugen-drip-assist', 'Hario', 'Mugen + Melodrip / Drip Assist', '低旁通锥形 · 降扰动布水组合', 'low_bypass_cone'),

  // 低旁通平底
  cup('preset-cup-orea-v4', 'Orea', 'V4/V3/BabyO', '低旁通平底 · 旧版预设兼容，默认按贴壁低旁通玩法联动', 'low_bypass_flat'),
  cup('preset-cup-orea-baby-o-flat', 'Orea', 'Baby O + Flat贴壁', '低旁通平底 · Flat滤纸贴壁', 'low_bypass_flat'),
  cup('preset-cup-orea-v3-v4-negotiator-flat', 'Orea', 'V3/V4 + Negotiator + Flat', '低旁通平底 · Negotiator压纸贴壁', 'low_bypass_flat'),
  cup('preset-cup-orea-o1-flat', 'Orea', 'O1 / O1A + Flat', '低旁通平底 · 小尺寸贴壁玩法', 'low_bypass_flat'),
  cup('preset-cup-orea-z1', 'Orea', 'Z1', '低旁通平底 · 低旁通/布水系统', 'low_bypass_flat'),
  cup('preset-cup-cafec-sd1r', 'Suprima', 'SD1R', '低旁通平底 · 高流速，半浸泡感', 'low_bypass_flat'),
  cup('preset-cup-nextlevel-pulsar', 'NextLevel', 'Pulsar', '低旁通平底 · no-bypass，阀门控流', 'low_bypass_flat'),
  cup('preset-cup-nextlevel-mini-pulsar', 'NextLevel', 'Mini Pulsar', '低旁通平底 · 小粉量no-bypass', 'low_bypass_flat'),
  cup('preset-cup-tricolate', 'Tricolate', 'Tricolate', '低旁通平底 · 圆柱粉床，淋浴头布水', 'low_bypass_flat'),
  cup('preset-cup-ceado-hoop', 'Ceado', 'Hoop', '低旁通平底 · 环形注水，中心粉仓', 'low_bypass_flat'),
  cup('preset-cup-sworks-bottomless', 'Sworks', 'Bottomless / 低旁通平底系统', '低旁通平底 · 平底贴壁玩法', 'low_bypass_flat'),

  // 浸泡式
  cup('preset-cup-clever-dripper', 'Clever', '聪明杯', '浸泡式 · 阀门释放，适合求稳', 'immersion', ''),
  cup('preset-cup-hario-switch', 'Hario', 'Switch 聪明杯', '浸泡式 · V60杯体 + 阀门，默认按V60杯体联动', 'immersion', 'regular_cone'),
  cup('preset-cup-hario-immersion', 'Hario', 'Immersion Dripper', '浸泡式 · Hario浸泡释放结构', 'immersion', ''),
  cup('preset-cup-bonavita-immersion', 'Bonavita', 'Immersion Dripper', '浸泡式 · 阀门释放', 'immersion', ''),
  cup('preset-cup-aeropress', 'AeroPress', 'AeroPress', '浸泡式 · 浸泡 + 压滤', 'immersion', ''),
  cup('preset-cup-goat-story-gina', 'Goat Story', 'GINA', '浸泡式 · 阀门可控浸泡/滴滤', 'immersion', ''),
  cup('preset-cup-vietnamese-phin', 'Vietnamese', 'Phin 越南滴滤壶', '浸泡式 · 金属腔体重力滴滤', 'immersion', ''),
  cup('preset-cup-french-press', 'French Press', '法压壶', '浸泡式 · 全浸泡 + 金属滤网', 'immersion', ''),

  // 其他/混合型
  cup('preset-cup-melitta-trapezoid', 'Melitta', '1x1 / 1x2', '其他/混合型 · 梯形单孔', 'mixed', ''),
  cup('preset-cup-kalita-trapezoid', 'Kalita', '101 / 102 梯形', '其他/混合型 · 梯形三孔', 'mixed', ''),
  cup('preset-cup-bee-house', 'Bee House', 'Dripper', '其他/混合型 · 梯形双孔', 'mixed', ''),
  cup('preset-cup-hario-pegasus', 'Hario', 'Pegasus', '其他/混合型 · 梯形/楔形结构', 'mixed', ''),
  cup('preset-cup-sanyo-trapezoid', '三洋', '梯形滤杯', '其他/混合型 · 梯形结构', 'mixed', ''),
  cup('preset-cup-torch-mountain', 'Torch', 'Mountain Dripper', '其他/混合型 · 梯形/楔形木架结构', 'mixed', ''),
  cup('preset-cup-hario-woodneck', 'Hario', 'Woodneck / Nel Drip', '其他/混合型 · 布滤框架', 'mixed', ''),
  cup('preset-cup-metal-filter', '通用', '金属滤网滤杯', '其他/混合型 · 无纸滤逻辑', 'mixed', ''),
  cup('preset-cup-portable-drip-bag-holder', '通用', '挂耳滤杯 / 便携折叠滤架', '其他/混合型 · 便携支架', 'mixed', ''),
  cup('preset-cup-cold-drip', '通用', 'Cold Drip 冰滴壶', '其他/混合型 · 冷萃器具', 'mixed', '')
];

const PAPER_PRESETS = [
  { id: 'preset-paper-chemex-bonded', type: 'paper', brand: 'Chemex', model: 'Chemex Bonded滤纸', note: '厚滤纸 · 高干净度', mapping: '低速', preset: true },
  { id: 'preset-paper-kalita-wave', type: 'paper', brand: 'Kalita', model: '蛋糕滤纸 155/185', note: '平底滤纸 · 蛋糕杯/Orea/B75 常用', mapping: '中速', preset: true },
  { id: 'preset-paper-cafec-t90', type: 'paper', brand: '三洋', model: 'T-90', note: '稳定中速 · 日常推荐', mapping: '中速', preset: true },
  { id: 'preset-paper-cafec-t92', type: 'paper', brand: '三洋', model: 'T-92', note: '粗研磨 深烘/日晒等', mapping: '低速', preset: true },
  { id: 'preset-paper-cafec-t83', type: 'paper', brand: '三洋', model: 'T-83', note: '细研磨 浅烘/水洗等', mapping: '高速', preset: true },
  { id: 'preset-paper-hario-fast', type: 'paper', brand: 'Hario', model: 'Sibarist / Fast V60', note: '高速滤纸', mapping: '高速', preset: true }
];

const GRINDER_PROFILE_LABELS = {
  balanced: '均衡层次型',
  high_resolution: '高解析展示型',
  sweet_body: '厚甜融合型',
  entry: '入门/口粮稳定型',
  versatile: '家用全能型',
  commercial: '商用/实验室锚点',
  calibrate: '需实物杯测对位'
};

function grinder(id, brand, model, note, profile, reference = {}) {
  return {
    id,
    type: 'grinder',
    brand,
    model,
    note,
    profile,
    mapping: GRINDER_PROFILE_LABELS[profile] || '',
    cupping: reference.cupping || '',
    aliases: reference.aliases || [],
    grinderReference: reference,
    preset: true
  };
}

const GRINDER_PRESETS = [
  grinder('preset-grinder-comandante-c40', 'Comandante', 'C40 MK4', '当前框架主坐标 · Daniel个人杯测锚点21格', 'balanced', { cupping: '杯测约21格', unit: '格', step: 1, base: 21, aliases: ['c40', 'mk4'] }),
  grinder('preset-grinder-comandante-c60', 'Comandante', 'C60', '更大刀盘 · 暂不单独建坐标，建议按C40样品对位', 'balanced', { cupping: '暂无稳定公开杯测范围，建议从C40视觉粒径对位', aliases: ['c60'] }),
  grinder('preset-grinder-1zpresso-zp6', '1Zpresso', 'ZP6 Special', '高解析、干净、酸质和风味强度突出', 'high_resolution', { cupping: '杯测常见约5.0圈附近', unit: '圈', step: 0.2, baseMin: 4.8, baseMax: 5.2, aliases: ['zp6', 'zp6 special'] }),
  grinder('preset-grinder-1zpresso-k-ultra', '1Zpresso', 'K-Ultra / K-Max / K-Plus', '甜感和饱满度更强 · 日晒/蜜处理/特殊处理更稳', 'sweet_body', { cupping: '玩家杯测常见约5.0-7.0圈', unit: '圈', step: 0.2, baseMin: 5.0, baseMax: 7.0, aliases: ['k-ultra', 'kultra', 'k-max', 'kmax', 'k-plus', 'kplus'] }),
  grinder('preset-grinder-1zpresso-x-pro', '1Zpresso', 'X-Pro / X-Ultra', '清爽、酸质明确，口感轻盈圆润', 'high_resolution', { cupping: '建议从4.5-6.0圈试杯测附近', unit: '圈', step: 0.2, baseMin: 4.5, baseMax: 6.0, aliases: ['x-pro', 'xpro', 'x-ultra', 'xultra'] }),
  grinder('preset-grinder-1zpresso-q2', '1Zpresso', 'Q2 / Q Air', '旅行/小粉量可用 · 优先自行杯测对位', 'entry', { cupping: '公开杯测范围不稳定，建议按官方中粗段视觉对位', aliases: ['q2', 'q air', 'qair'] }),
  grinder('preset-grinder-timemore-c2', '泰摩', '栗子 C2 / C2S', '入门手摇 · 风味相对融合', 'entry', { cupping: 'C2杯测约15-26格，常见滤冲14-20格', unit: '格', step: 1, baseMin: 15, baseMax: 26, aliases: ['timemore c2', 'chestnut c2', '栗子c2', 'c2s'] }),
  grinder('preset-grinder-timemore-c3', '泰摩', '栗子 C3 / C3S / C3 Max', '比C2略更细致，甜感尚可，整体仍偏融合', 'entry', { cupping: '杯测约13-22格，常见滤冲16-22格', unit: '格', step: 1, baseMin: 13, baseMax: 22, aliases: ['timemore c3', 'chestnut c3', '栗子c3', 'c3s', 'c3 max'] }),
  grinder('preset-grinder-timemore-s3', '泰摩', 'S3', '偏滤冲 · 均匀度比C系列好，香气和干净度更强', 'balanced', { cupping: '杯测约1.5-6.0，滤冲约1.0-6.9', unit: '档', step: 0.2, baseMin: 1.5, baseMax: 6.0, aliases: ['timemore s3', '栗子s3'] }),
  grinder('preset-grinder-timemore-x', '泰摩', 'Chestnut X / X Lite', '甜感和干净度提升，整体偏均衡', 'balanced', { cupping: '公开杯测范围不统一，建议实物杯测对位', aliases: ['chestnut x', 'x lite', '栗子x'] }),
  grinder('preset-grinder-kingrinder-k6', '汉匠', 'K6', '预算型高表现 · 清晰度和果酸不错', 'balanced', { cupping: '官方中等段90-120 clicks，常用V60约90-110 clicks', unit: '格', step: 5, baseMin: 90, baseMax: 110, aliases: ['kingrinder k6', 'k6', '汉匠k6'] }),
  grinder('preset-grinder-kingrinder-k4', '汉匠', 'K4', '偏甜厚和意式，中深烘表现更好', 'sweet_body', { cupping: '官方中等段约80-100 clicks，杯测需实物对位', unit: '格', step: 5, baseMin: 80, baseMax: 100, aliases: ['kingrinder k4', 'k4', '汉匠k4'] }),
  grinder('preset-grinder-kingrinder-k7', '汉匠', 'K7', '偏中段和口感，暂列观察', 'calibrate', { cupping: '官方中等段约60-80 clicks，公开杯测样本少', aliases: ['kingrinder k7', 'k7', '汉匠k7'] }),
  grinder('preset-grinder-mhw3bomber-r3', 'MHW-3BOMBER', 'R3 / R3 Pro', '国产高性价比 · 具体随刀盘版本差异较大', 'calibrate', { cupping: '公开杯测数据不足，需实物对位', aliases: ['mhw-3bomber r3', 'mhw3bomber r3', '轰炸机r3'] }),
  grinder('preset-grinder-varia-evo-hand', 'Varia', 'EVO Hand / VS3 手磨类', '偏甜感、body和易喝度，解析不是极端型', 'sweet_body', { cupping: '公开杯测数据不足，需实物对位', aliases: ['varia evo hand', 'evo hand', 'vs3 hand'] }),

  grinder('preset-grinder-fellow-ode2', 'Fellow', 'Ode Gen 2', '家用滤冲很适合 · 均衡平刀参考', 'balanced', { cupping: '杯测约3.1-7.1，官方手冲建议约5起', unit: '档', step: 0.5, baseMin: 5.0, baseMax: 6.0, aliases: ['ode gen 2', 'ode2', 'ode gen2'] }),
  grinder('preset-grinder-fellow-ode-ssp-mp', 'Fellow', 'Ode + SSP MP', '高解析、风味分离强，酸质亮', 'high_resolution', { cupping: '需按装刀和零点校准，通常与Gen2刀盘刻度不同', aliases: ['ode ssp', 'ode mp', 'ssp mp'] }),
  grinder('preset-grinder-fellow-opus', 'Fellow', 'Opus', '入门全能锥刀，甜感和body可以，清晰度有限', 'entry', { cupping: '公开样本多在滤冲6-8，杯测建议实物对位', unit: '档', step: 0.5, baseMin: 6.0, baseMax: 8.0, aliases: ['fellow opus', 'opus'] }),
  grinder('preset-grinder-baratza-encore', 'Baratza', 'Encore', '稳定耐用易用，风味较融合，清晰度一般', 'entry', { cupping: '公开表杯测约9-25，玩家杯测常见约20', unit: '格', step: 1, baseMin: 18, baseMax: 22, aliases: ['baratza encore', 'encore'] }),
  grinder('preset-grinder-baratza-encore-esp', 'Baratza', 'Encore ESP', '一机多用 · 手冲需防细粉带来的涩', 'versatile', { cupping: '滤冲起点约25，公开表杯测约20-28', unit: '格', step: 1, baseMin: 20, baseMax: 28, aliases: ['encore esp'] }),
  grinder('preset-grinder-baratza-virtuoso', 'Baratza', 'Virtuoso+', '比Encore更均匀，甜感和清晰度略好', 'entry', { cupping: '官方V60起点约15，公开表杯测约12-28', unit: '格', step: 1, baseMin: 12, baseMax: 28, aliases: ['virtuoso', 'virtuoso+'] }),
  grinder('preset-grinder-timemore-078', '泰摩', '雕刻家 078', '滤冲专向 · 低细粉、干净、顺滑，甜感好', 'balanced', { cupping: '杯测约2-9.5，玩家滤冲常用约6-9', unit: '档', step: 0.5, baseMin: 6.0, baseMax: 9.0, aliases: ['timemore 078', 'sculptor 078', '雕刻家078'] }),
  grinder('preset-grinder-timemore-078s', '泰摩', '雕刻家 078S', '全能偏意式，滤冲可用但不如078专注', 'versatile', { cupping: '公开表杯测约4.1-11', unit: '档', step: 0.5, baseMin: 4.1, baseMax: 11.0, aliases: ['timemore 078s', 'sculptor 078s', '雕刻家078s'] }),
  grinder('preset-grinder-timemore-064s', '泰摩', '雕刻家 064S', '家用全能，平衡可饮', 'versatile', { cupping: '公开杯测范围需按机器校准，滤冲范围依赖刀盘', aliases: ['timemore 064s', 'sculptor 064s', '雕刻家064s'] }),
  grinder('preset-grinder-df54', 'DF', 'DF54', '预算型平刀电磨 · 零点差异大，必须实物对位', 'versatile', { cupping: '公开表杯测约40-84，玩家滤冲常用45-65', unit: '格', step: 5, baseMin: 45, baseMax: 65, aliases: ['df54'] }),
  grinder('preset-grinder-df64-gen2', 'DF', 'DF64 Gen 2 / G-iota', '随刀盘变化极大，必须标刀盘版本', 'calibrate', { cupping: '公开表杯测约29-69，玩家滤冲常用50-70', unit: '格', step: 5, baseMin: 50, baseMax: 70, aliases: ['df64 gen2', 'df64 gen 2', 'g-iota', 'giota'] }),
  grinder('preset-grinder-df64v-df83', 'DF', 'DF64V / DF83', '可玩性高，刀盘和转速决定风味', 'calibrate', { cupping: '公开杯测需按刀盘和转速校准', aliases: ['df64v', 'df83'] }),
  grinder('preset-grinder-niche-zero', 'Niche', 'Zero', '厚、甜、融合，手冲清晰度不是优势', 'sweet_body', { cupping: '公开表杯测约0.38-0.68圈，实际需重标零点', unit: '圈', step: 0.05, baseMin: 0.38, baseMax: 0.68, aliases: ['niche zero'] }),
  grinder('preset-grinder-niche-duo', 'Niche', 'Duo', '滤冲刀盘比Zero更清晰，仍偏易喝', 'sweet_body', { cupping: '公开杯测样本不足，按刀盘对位', aliases: ['niche duo'] }),
  grinder('preset-grinder-varia-vs3', 'Varia', 'VS3', '小型锥刀，甜感/body明显，清晰度中等', 'sweet_body', { cupping: '公开杯测范围不稳定，需实物对位', aliases: ['varia vs3', 'vs3'] }),
  grinder('preset-grinder-option-o-lagom-mini', 'Option-O', 'Lagom Mini', 'Moonshine刀盘干净、高解析、酸质优雅', 'high_resolution', { cupping: 'Moonshine刀盘杯测约46-85 dots，官方滤冲常见约1.5圈附近', unit: 'dots', step: 5, baseMin: 46, baseMax: 85, aliases: ['lagom mini', 'option-o mini', 'moonshine'] }),
  grinder('preset-grinder-option-o-lagom-p64', 'Option-O', 'Lagom P64', '刀盘决定风味：SSP MP高解析，HU更厚，Cast更甜圆', 'high_resolution', { cupping: '公开表杯测约2.2-6.0，具体看SSP / Mizen刀盘', unit: '档', step: 0.2, baseMin: 2.2, baseMax: 6.0, aliases: ['lagom p64', 'p64'] }),
  grinder('preset-grinder-mazzer-philos-i200d', 'Mazzer', 'Philos i200D', '清晰明亮，花果分离好，中等body', 'high_resolution', { cupping: '滤冲多从80起，玩家杯测约120-130附近', unit: '格', step: 5, baseMin: 120, baseMax: 130, aliases: ['philos i200d', 'i200d'] }),
  grinder('preset-grinder-mazzer-philos-i189d', 'Mazzer', 'Philos i189D', '更厚、更传统，适合中烘和意式', 'sweet_body', { cupping: '同Philos机身，按刀盘重新对位', aliases: ['philos i189d', 'i189d'] }),
  grinder('preset-grinder-mahlkonig-ek43', 'Mahlkönig', 'EK43 / EK43S', '商业杯测标准感 · 刻度差异极大', 'commercial', { cupping: '需以筛网或杯测样品对位，不给绝对刻度', aliases: ['mahlkonig ek43', 'mahlkönig ek43', 'ek43', 'ek43s'] }),
  grinder('preset-grinder-eureka-mignon', 'Eureka', 'Mignon Filtro / Specialita / Oro', '家用全能，手冲清晰度视刀盘和机型而定', 'versatile', { cupping: '公开杯测数据不足，按滤冲范围实物对位', aliases: ['eureka mignon', 'mignon filtro', 'specialita', 'oro'] }),
  grinder('preset-grinder-wilfa-uniform', 'Wilfa', 'Uniform', '家用滤冲平刀，甜感和干净度好', 'balanced', { cupping: '公开杯测范围需实物对位', aliases: ['wilfa uniform', 'uniform'] })
];

const PRESET_EQUIPMENTS = [
  ...CUP_PRESETS,
  ...PAPER_PRESETS,
  ...GRINDER_PRESETS
];

function getEquipmentDisplayName(item) {
  const brand = String(item.brand || '').trim();
  const model = String(item.model || item.name || '').trim();
  if (!brand) return model;
  if (!model) return brand;
  if (model.toLowerCase().startsWith(brand.toLowerCase())) return model;
  return `${brand} ${model}`;
}

const EQUIPMENT_DEFAULT_MAPPINGS = {
  cup: CUP_PRESETS.reduce((result, item) => {
    if (item.brewCupId) result[item.id] = item.brewCupId;
    return result;
  }, {}),
  paper: {
    'preset-paper-chemex-bonded': 'slow',
    'preset-paper-kalita-wave': 'medium',
    'preset-paper-cafec-t90': 'medium',
    'preset-paper-cafec-t92': 'slow',
    'preset-paper-cafec-t83': 'fast',
    'preset-paper-hario-fast': 'fast'
  }
};

const EQUIPMENT_DEFAULT_LABELS = PRESET_EQUIPMENTS.reduce((result, item) => {
  result[item.id] = getEquipmentDisplayName(item);
  return result;
}, {});

const GRINDER_REFERENCES = GRINDER_PRESETS.reduce((result, item) => {
  const reference = item.grinderReference || {};
  result[item.id] = {
    name: getEquipmentDisplayName(item),
    cupping: item.cupping || reference.cupping || '请自行标定杯测刻度',
    flavorProfile: item.mapping,
    note: item.note,
    aliases: item.aliases || [],
    ...reference
  };
  return result;
}, {});

module.exports = {
  CUP_CATEGORY_LABELS,
  CUP_PRESETS,
  EQUIPMENT_DEFAULT_LABELS,
  EQUIPMENT_DEFAULT_MAPPINGS,
  GRINDER_PROFILE_LABELS,
  GRINDER_PRESETS,
  GRINDER_REFERENCES,
  PAPER_PRESETS,
  PRESET_EQUIPMENTS
};
