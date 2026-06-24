// 搞杯喝的 - 5步冲煮流程逻辑
// 设计稿: 375×812, 5 step flow

const app = getApp();
const CLASSIC_METHODS = require('../../data/standard-brew-methods.js');
const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../utils/auth.js');
const {
  buildBeanViewList,
  getRoastAgeDays,
  splitBeansByStock
} = require('../../utils/beans.js');
const {
  analyzeFlavorText
} = require('../../utils/coffee-knowledge.js');
const {
  formatActualRatioText,
  getActualRatioValue
} = require('../../utils/ratio.js');
const {
  buildSharePayload,
  buildTimelinePayload,
  closeRecipeShareCard,
  createRecipeShareCard,
  saveRecipeShareCard
} = require('../../utils/share-card.js');
const { syncCustomTabBar } = require('../../utils/tabbar.js');
const {
  EQUIPMENT_DEFAULT_LABELS,
  EQUIPMENT_DEFAULT_MAPPINGS,
  GRINDER_REFERENCES
} = require('../../utils/equipment-presets.js');

const REBREW_ARCHIVE_KEY = 'coffeePendingRebrewRecipe';
const ACTIVE_BREW_TIMER_KEY = 'coffeeActiveBrewTimerRecipe';
const STAGE_POUR_STYLE = '液面缓慢上升或基本稳定为合格；绕圈提高萃取强度，中心小圈控制尾段。';

const CUP_OPTIONS = [
  {
    id: 'regular_cone',
    label: '常规锥形（V60）',
    desc: '按 Wave 展示路线处理',
    route: '展示',
    filterShape: 'Wave',
    grindDelta: 0,
    risk: '常规锥形按展示路线起手，优先保留清晰度，避免冲边造成旁通过大'
  },
  {
    id: 'low_bypass_cone',
    label: '低旁通锥形（Hario无限）',
    desc: '按无限 + T90 求稳路线处理',
    route: '求稳',
    filterShape: 'T90',
    grindDelta: 1,
    risk: '低旁通锥形按求稳路线起手，不盲目细磨，优先控制尾段涩感'
  },
  {
    id: 'regular_flat',
    label: '常规平底（Kalita蛋糕杯、泰摩B75）',
    desc: '按稳定均匀萃取路线处理',
    route: '求稳',
    filterShape: 'T90',
    grindDelta: 0,
    risk: '常规平底优先保证覆盖均匀，不用风味词硬解释局部过萃'
  },
  {
    id: 'low_bypass_flat',
    label: '低旁通平底（Orea系列、SD1R、SOLO）',
    desc: '按 Flat 贴壁低旁通路线处理',
    route: '追求口味',
    filterShape: 'Flat 贴壁',
    grindDelta: 1,
    risk: 'Flat 贴壁要按低旁通思路处理，不继续细磨，优先控制后段扰动'
  }
];

const PAPER_OPTIONS = [
  { id: 'slow', label: '低速', desc: '偏 T90 稳定思路', grindDelta: 1, risk: '低速滤纸若尾段拖长，第一动作是 cut-off 10g 或粗 1格' },
  { id: 'medium', label: '中速', desc: '通用起手', grindDelta: 0, risk: '中速滤纸按标准节奏起手，重点观察总时间和尾段干净度' },
  { id: 'fast', label: '高速', desc: '偏 Wave 展示思路', grindDelta: -1, risk: '高速滤纸若干净但薄，可细 1格；若已有涩木，不继续细磨' }
];

const DOSE_OPTIONS = [
  { grams: 10, title: '10克', desc: '尝个咸淡' },
  { grams: 15, title: '15克', desc: '本本分分' },
  { grams: 20, title: '20克', desc: '分享快乐' }
];

const WATER_OPTIONS = [
  { id: 'nongfu', name: '农夫山泉饮用天然水', tds: 45, desc: '低矿物质，适合清晰明亮路线' },
  { id: 'cestbon', name: '怡宝纯净水', tds: 8, desc: '极低 TDS，适合做对照，容易显薄' },
  { id: 'wahaha', name: '娃哈哈纯净水', tds: 8, desc: '极低 TDS，建议先按软水修正' },
  { id: 'ganten', name: '百岁山天然矿泉水', tds: 120, desc: '中等矿物感，适合甜感和均衡表达' },
  { id: 'kunlun', name: '昆仑山雪山矿泉水', tds: 160, desc: '偏高 TDS，优先控制尾段沉重感' },
  { id: 'evian', name: 'Evian 依云天然矿泉水', tds: 300, desc: '高 TDS，容易压低清晰度，谨慎使用' },
  { id: 'custom', name: '手动填写 TDS', tds: '', desc: '用水质笔实测后填写，优先采用实测值' }
];

const V2_WATER_TEMP = 92;

const ROAST_LEVEL_PROFILES = {
  ultra_light: {
    label: '极浅烘',
    grindMove: -1,
    waterMove: 0,
    tempDelta: 1,
    note: '极浅烘按保守增强萃取处理：水温略高、研磨略细，但不改变器具主路线'
  },
  light: {
    label: '浅烘',
    grindMove: 0,
    waterMove: 0,
    tempDelta: 0,
    note: '浅烘按当前框架基准处理，优先观察风味反馈再修正'
  },
  medium: {
    label: '中烘',
    grindMove: 0,
    waterMove: 0,
    tempDelta: -1,
    note: '中烘轻微降低水温，避免把甜感推成尾段钝感'
  },
  dark: {
    label: '深烘',
    grindMove: 1,
    waterMove: -5,
    tempDelta: -3,
    note: '深烘优先控制苦涩和木质尾段：降水温、略粗研磨并轻微收水量'
  },
  ultra_dark: {
    label: '极度深烘',
    grindMove: 2,
    waterMove: -10,
    tempDelta: -5,
    note: '极度深烘按高风险尾段处理：明显降水温、粗研磨并减少总水量'
  }
};

const FEEDBACK_OPTIONS = {
  justRight: {
    label: '这杯正好',
    grindMove: 0,
    waterMove: 0,
    tone: 'good',
    resetAdjustment: true,
    text: '这杯表现稳定，不需要继续修正。下一杯会回到这颗豆子的当前基准参数，不叠加额外感官偏移。',
    direction: {
      grind: '保持当前刻度',
      brew: '保存当前参数作为这颗豆子的稳定基准。',
      reminder: '下次只在风味明显变化时再修正。'
    }
  },
  sourThin: {
    label: '味道寡淡',
    grindMove: -1,
    waterMove: 0,
    tone: 'warning',
    text: '味道寡淡通常说明主体萃取不足。下一杯先细 1格；若杯子干净但仍薄，也可总水量减 10g。',
    direction: {
      grind: '略细一点',
      brew: '提高主体萃取；杯子干净但仍薄时，再考虑略减总水量。',
      reminder: '先小步修正，避免一次改太多。'
    }
  },
  aromaWeak: {
    label: '花香不明显',
    grindMove: -1,
    waterMove: 0,
    tone: 'warning',
    text: '花香不明显但没有苦涩木质时，优先略细 1格或加强中段注水；先不要升水温。',
    direction: {
      grind: '略细或保持',
      brew: '加强中段注水稳定性，先不要主动升水温。',
      reminder: '如果同时有苦涩木头味，应按苦涩方向处理。'
    }
  },
  sweetnessLow: {
    label: '甜感不足',
    grindMove: -1,
    waterMove: 0,
    tone: 'warning',
    text: '甜感不足多半是主体萃取不够。下一杯细 1格；如果同时显薄，总水量减 10g。',
    direction: {
      grind: '略细一点',
      brew: '提高主体萃取；如果同时显薄，再略减总水量。',
      reminder: '甜感不足不要直接加大扰动。'
    }
  },
  bitterAstringent: {
    label: '有苦涩感和木头味',
    grindMove: 1,
    waterMove: -10,
    tone: 'alert',
    text: '苦涩感和木头味属于尾段风险。下一杯先粗 1格或 cut-off 10g，不继续细磨。',
    direction: {
      grind: '略粗一点',
      brew: '降低尾段萃取，必要时减少后段水量。',
      reminder: '不要继续细磨，尤其是低旁通和小粉量。'
    }
  },
  heavyTight: {
    label: '口感浑浊/厚重',
    grindMove: 1,
    waterMove: 0,
    tone: 'alert',
    text: '口感浑浊或厚重时，下一杯粗 1格；必要时用粉量 1 倍的 bypass 放松口感。',
    direction: {
      grind: '略粗或保持',
      brew: '降低后段扰动，让口感放松。',
      reminder: '如果只是浓但不苦，可先保持研磨。'
    }
  }
};

Page({
  data: {
    currentStep: 1,
    // Step 1: 选豆子
    beans: [],
    filteredBeans: [],
    archivedBeans: [],
    archivedBeansExpanded: false,
    allBeanCount: 0,
    selectedBean: null,
    luckyBeanCount: 0,
    filterProcessing: 'all',
    // Step 2: 选器具
    cups: CUP_OPTIONS,
    papers: PAPER_OPTIONS,
    selectedCup: 'regular_cone',
    selectedPaper: 'medium',
    selectedCupEquipmentId: '',
    selectedPaperEquipmentId: '',
    // Step 3: 定粉量
    doseOptions: DOSE_OPTIONS,
    doseGrams: 15,
    waterOptions: WATER_OPTIONS,
    selectedWaterId: 'nongfu',
    customWaterTds: '',
    showCustomWaterTds: false,
    customWaterFocus: false,
    waterScrollTarget: '',
    // Step 4: 选方案
    selectedPlanType: '',
    selectedClassicMethodId: '',
    classicMethods: CLASSIC_METHODS,
    classicMethodCount: CLASSIC_METHODS.length,
    // Step 5: 方案
    recipe: null,
    canProceed: false,
    shareCardVisible: false,
    shareCardImage: '',
    shareCardRecipe: null,
    rebrewArchiveMode: false,
    rebrewArchiveId: ''
  },

  onLoad() {
    if (this.loadPendingRebrewRecipe()) return;
    this.applyEquipmentDefaults();
    this.loadBeans();
  },

  onShow() {
    syncCustomTabBar(this, 'pages/brew/brew');
    if (this.loadPendingRebrewRecipe()) return;
    if (this.data.rebrewArchiveMode && this.data.currentStep === 6 && this.data.recipe) return;
    // 每次回到页面刷新豆子列表
    this.applyEquipmentDefaults();
    this.loadBeans();
  },

  loadPendingRebrewRecipe() {
    const pending = wx.getStorageSync(REBREW_ARCHIVE_KEY);
    if (!pending || !pending.fromArchiveRebrew || !pending.archiveId) return false;
    wx.removeStorageSync(REBREW_ARCHIVE_KEY);
    const archivedRecipe = this.findArchivedRecipeById(pending.archiveId);
    if (!archivedRecipe) {
      wx.showToast({
        title: '未找到方案',
        icon: 'none'
      });
      return false;
    }
    const recipe = this.prepareRebrewRecipe(archivedRecipe, pending.archiveId);
    this.setData({
      recipe,
      currentStep: 6,
      canProceed: false,
      rebrewArchiveMode: true,
      rebrewArchiveId: pending.archiveId
    });
    return true;
  },

  getRecipeArchiveId(recipe = {}, index = 0) {
    return recipe.archiveId || recipe.id || recipe.savedAt || recipe.createdAt || `recipe-${index}`;
  },

  findArchivedRecipeById(archiveId) {
    const recipes = getUserStorageSync('recipes', []);
    return recipes.find((recipe, index) => this.getRecipeArchiveId(recipe, index) === archiveId) || null;
  },

  prepareRebrewRecipe(recipe, archiveId) {
    const bean = this.getArchivedRecipeBean(recipe);
    return {
      ...recipe,
      archiveId,
      beanFlavorNotes: recipe.beanFlavorNotes || this.formatBeanFlavorNotes(bean),
      beanExtraInfo: recipe.beanExtraInfo || this.formatBeanExtraInfo(bean),
      fromArchiveRebrew: true,
      saved: true,
      feedbackOptions: recipe.feedbackOptions && recipe.feedbackOptions.length ? recipe.feedbackOptions : this.getFeedbackOptions()
    };
  },

  applyEquipmentDefaults() {
    const defaults = getUserStorageSync('equipmentDefaults', {});
    const selectedCup = this.resolveDefaultCup(defaults.cup);
    const selectedPaper = this.resolveDefaultPaper(defaults.paper);
    const nextData = {};

    if (selectedCup) {
      nextData.selectedCup = selectedCup;
      nextData.selectedCupEquipmentId = defaults.cup || '';
    }
    if (selectedPaper) {
      nextData.selectedPaper = selectedPaper;
      nextData.selectedPaperEquipmentId = defaults.paper || '';
    }

    if (Object.keys(nextData).length) {
      this.setData({
        ...nextData,
        canProceed: this.checkCanProceed(this.data.currentStep, nextData)
      });
    }
  },

  resolveDefaultCup(equipmentId) {
    if (!equipmentId) return '';
    if (EQUIPMENT_DEFAULT_MAPPINGS.cup[equipmentId]) {
      return EQUIPMENT_DEFAULT_MAPPINGS.cup[equipmentId];
    }
    const equipment = this.getCustomEquipment(equipmentId);
    if (!equipment) return '';
    const text = this.normalizeEquipmentText(equipment);
    if (text.includes('switch')) return 'regular_cone';
    if (text.includes('clever') || text.includes('aeropress') || text.includes('法压') || text.includes('phin') || text.includes('immersion') || text.includes('浸泡') || text.includes('聪明杯') || text.includes('gina')) return '';
    if (text.includes('melitta') || text.includes('pegasus') || text.includes('woodneck') || text.includes('nel drip') || text.includes('cold drip')) return '';
    if (text.includes('orea') && (text.includes('wave') || text.includes('蛋糕'))) return 'regular_flat';
    if (text.includes('origami') && (text.includes('wave') || text.includes('蛋糕'))) return 'regular_flat';
    if (text.includes('mugen') || text.includes('infinite') || text.includes('无限') || text.includes('fuji') || text.includes('lvl-10')) return 'low_bypass_cone';
    if (text.includes('orea') || text.includes('solo') || text.includes('sd1r') || text.includes('pulsar') || text.includes('tricolate') || text.includes('hoop') || text.includes('bottomless') || text.includes('no-bypass') || text.includes('no bypass') || text.includes('贴壁') || text.includes('z1')) return 'low_bypass_flat';
    if (text.includes('kalita') || text.includes('b75') || text.includes('wave') || text.includes('april') || text.includes('stagg') || text.includes('gino') || text.includes('blue bottle') || text.includes('donut') || text.includes('flatbed') || text.includes('december')) return 'regular_flat';
    if (text.includes('v60') || text.includes('hario') || text.includes('chemex') || text.includes('origami') || text.includes('flower') || text.includes('deep 27') || text.includes('kono') || text.includes('oct') || text.includes('crystal eye') || text.includes('tornado') || text.includes('graycano')) return 'regular_cone';
    return '';
  },

  resolveDefaultPaper(equipmentId) {
    if (!equipmentId) return '';
    if (EQUIPMENT_DEFAULT_MAPPINGS.paper[equipmentId]) {
      return EQUIPMENT_DEFAULT_MAPPINGS.paper[equipmentId];
    }
    const equipment = this.getCustomEquipment(equipmentId);
    if (!equipment) return '';
    const text = this.normalizeEquipmentText(equipment);
    if (text.includes('chemex') || text.includes('dark') || text.includes('slow')) return 'slow';
    if (text.includes('abaca') || text.includes('t90') || text.includes('sibarist') || text.includes('fast')) return 'fast';
    return 'medium';
  },

  getCustomEquipment(equipmentId) {
    return getUserStorageSync('equipment', []).find(e => e.id === equipmentId);
  },

  normalizeEquipmentText(equipment) {
    return `${equipment.brand || ''} ${equipment.model || ''} ${equipment.name || ''} ${equipment.note || ''}`.toLowerCase();
  },

  formatSelectedEquipmentText(type, equipmentId, categoryLabel) {
    const equipmentLabel = this.getSelectedEquipmentLabel(type, equipmentId);
    if (!equipmentLabel) return categoryLabel;
    if (equipmentLabel.includes(categoryLabel)) return equipmentLabel;
    return `${equipmentLabel} · ${categoryLabel}`;
  },

  getSelectedEquipmentLabel(type, equipmentId) {
    if (!equipmentId) return '';
    if (EQUIPMENT_DEFAULT_LABELS[equipmentId]) return EQUIPMENT_DEFAULT_LABELS[equipmentId];
    const equipment = this.getCustomEquipment(equipmentId);
    if (!equipment || equipment.type !== type) return '';
    const name = [equipment.brand, equipment.model || equipment.name].filter(Boolean).join(' ');
    return name || equipment.note || '';
  },

  // ===== 数据加载 =====
  loadBeans() {
    try {
      const allBeans = buildBeanViewList(getUserStorageSync('beans', []));
      const { activeBeans, finishedBeans } = splitBeansByStock(allBeans);
      const selectedBean = this.refreshSelectedBean(activeBeans);
      this.setData({
        beans: activeBeans,
        archivedBeans: finishedBeans,
        allBeanCount: allBeans.length,
        selectedBean,
        luckyBeanCount: this.getLuckyBeanCandidates(activeBeans).length,
        canProceed: this.checkCanProceed(this.data.currentStep, { selectedBean })
      }, () => {
        this.applyFilter();
      });
    } catch (e) {
      console.error('加载豆子失败:', e);
    }
  },

  refreshSelectedBean(beans) {
    const selectedBean = this.data.selectedBean;
    if (!selectedBean || !selectedBean.id) return selectedBean;
    return beans.find(bean => bean.id === selectedBean.id) || null;
  },

  applyFilter() {
    const { beans, filterProcessing } = this.data;
    let filtered = beans;
    if (filterProcessing !== 'all') {
      filtered = beans.filter(b => b.processing === filterProcessing);
    }
    this.setData({ filteredBeans: filtered });
  },

  // ===== Step 1: 选豆子 =====
  onFilter(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterProcessing: type }, () => {
      this.applyFilter();
    });
  },

  onSelectBean(e) {
    const bean = e.detail.bean;
    if (!bean) {
      wx.showToast({
        title: '请选择咖啡豆',
        icon: 'none'
      });
      return;
    }
    this.setData({
      selectedBean: bean,
      canProceed: this.checkCanProceed(this.data.currentStep, { selectedBean: bean })
    });
  },

  onLuckyBeanPick() {
    const candidates = this.getLuckyBeanCandidates();
    if (!candidates.length) {
      wx.showToast({
        title: '暂无适合抽取的豆子',
        icon: 'none'
      });
      return;
    }
    const bean = candidates[Math.floor(Math.random() * candidates.length)];
    this.setData({
      filterProcessing: 'all',
      selectedBean: bean,
      canProceed: this.checkCanProceed(this.data.currentStep, { selectedBean: bean })
    }, () => {
      this.applyFilter();
      wx.showToast({
        title: `抽中了：${bean.name || '未命名豆子'}`,
        icon: 'none'
      });
    });
  },

  onEmptyQuickAddBean() {
    if (!requireLogin('登录后可使用秒拍入库，并保存到你的豆仓。')) return;
    wx.navigateTo({
      url: '/pages/beans/edit/edit?quickAdd=1'
    });
  },

  onEmptyAddBean() {
    if (!requireLogin('登录后可添加咖啡豆到你的豆仓。')) return;
    wx.navigateTo({
      url: '/pages/beans/edit/edit'
    });
  },

  onToggleArchivedBeans() {
    this.setData({
      archivedBeansExpanded: !this.data.archivedBeansExpanded
    });
  },

  onTapArchivedBean() {
    wx.showToast({
      title: '这款豆子库存为0，先补库存再开喝',
      icon: 'none'
    });
  },

  getLuckyBeanCandidates(beans = this.data.beans) {
    return (beans || []).filter(bean => {
      const stock = Number(bean.stockGrams);
      const directAge = Number(bean.roastAgeDays);
      const hasDirectAge = bean.roastAgeDays !== null && bean.roastAgeDays !== undefined && bean.roastAgeDays !== '';
      const age = hasDirectAge && Number.isFinite(directAge) ? directAge : getRoastAgeDays(bean.roastDate);
      return Number.isFinite(stock) && stock > 0 && age >= 10;
    });
  },

  // ===== Step 2: 选器具 =====
  onSelectCup(e) {
    const selectedCup = e.currentTarget.dataset.cup;
    this.setData({
      selectedCup,
      selectedCupEquipmentId: '',
      canProceed: this.checkCanProceed(this.data.currentStep, { selectedCup })
    });
  },

  onSelectPaper(e) {
    const selectedPaper = e.currentTarget.dataset.paper;
    this.setData({
      selectedPaper,
      selectedPaperEquipmentId: '',
      canProceed: this.checkCanProceed(this.data.currentStep, { selectedPaper })
    });
  },

  // ===== Step 3: 定粉量 =====
  onSelectDose(e) {
    const dose = parseInt(e.currentTarget.dataset.dose);
    this.setData({
      doseGrams: dose,
      canProceed: this.checkCanProceed(this.data.currentStep, { doseGrams: dose })
    });
  },

  onSelectWater(e) {
    const selectedWaterId = e.currentTarget.dataset.water;
    const isCustomWater = selectedWaterId === 'custom';
    this.setData({
      selectedWaterId,
      showCustomWaterTds: isCustomWater,
      customWaterFocus: isCustomWater,
      waterScrollTarget: isCustomWater ? 'custom-tds-input' : '',
      canProceed: this.checkCanProceed(this.data.currentStep, { selectedWaterId })
    });
  },

  onCustomWaterTdsInput(e) {
    const customWaterTds = e.detail.value;
    this.setData({
      customWaterTds,
      canProceed: this.checkCanProceed(this.data.currentStep, { customWaterTds })
    });
  },

  // ===== Step 4: 选方案 =====
  onSelectPlanType(e) {
    const selectedPlanType = e.currentTarget.dataset.type;
    this.setData({
      selectedPlanType,
      selectedClassicMethodId: selectedPlanType === 'classic' ? this.data.selectedClassicMethodId : '',
      canProceed: this.checkCanProceed(this.data.currentStep, { selectedPlanType })
    });
  },

  onSelectClassicMethod(e) {
    const selectedClassicMethodId = e.currentTarget.dataset.id;
    this.setData({
      selectedClassicMethodId,
      canProceed: this.checkCanProceed(this.data.currentStep, {
        selectedPlanType: 'classic',
        selectedClassicMethodId
      })
    });
  },

  // ===== 步骤导航 =====
  onPrevStep() {
    const step = Math.max(1, this.data.currentStep - 1);
    this.setData({
      currentStep: step,
      canProceed: this.checkCanProceed(step)
    });
  },

  onNextStep() {
    const canProceed = this.checkCanProceed(this.data.currentStep);
    if (!canProceed) {
      wx.showToast({
        title: this.getStepErrorText(this.data.currentStep),
        icon: 'none'
      });
      this.setData({ canProceed: false });
      return;
    }

    if (this.data.currentStep === 5) {
      if (this.data.selectedPlanType === 'classic') {
        this.generateClassicRecipe();
      } else {
        this.generateRecipe();
      }
      return;
    }

    const step = this.data.currentStep + 1;
    this.setData({
      currentStep: step,
      canProceed: this.checkCanProceed(step)
    });
  },

  checkCanProceed(step, nextData = {}) {
    const data = { ...this.data, ...nextData };
    switch (step) {
      case 1: return !!data.selectedBean;
      case 2: return !!data.selectedBean && !!(data.selectedCup && data.selectedPaper);
      case 3: return !!data.selectedBean && this.isValidDose(data.doseGrams);
      case 4: return !!data.selectedBean && this.hasValidWaterSelection(data);
      case 5: return !!data.selectedBean && (data.selectedPlanType === 'personal' || (data.selectedPlanType === 'classic' && !!data.selectedClassicMethodId));
      default: return false;
    }
  },

  isValidDose(doseGrams) {
    const dose = Number(doseGrams);
    return DOSE_OPTIONS.some(option => option.grams === dose);
  },

  hasValidWaterSelection(data = this.data) {
    if (!data.selectedWaterId) return false;
    if (data.selectedWaterId !== 'custom') return true;
    const tds = Number(data.customWaterTds);
    return Number.isFinite(tds) && tds >= 0 && tds <= 500;
  },

  // ===== 生成冲煮方案 =====
  getStepErrorText(step) {
    switch (step) {
      case 1: return '请先选择咖啡豆';
      case 2: return '请先选择滤杯和滤纸';
      case 3: return '请先选择粉量';
      case 4: return '请先选择冲煮水，手动填写时 TDS 需为 0-500';
      case 5: return this.data.selectedPlanType === 'classic' ? '请先选择经典方案' : '请先选择方案类型';
      default: return '当前步骤未完成';
    }
  },

  generateRecipe() {
    const { selectedBean, selectedCup, selectedPaper, doseGrams } = this.data;
    if (!selectedBean || !selectedCup || !selectedPaper || !this.isValidDose(doseGrams)) {
      wx.showToast({
        title: '生成参数不完整',
        icon: 'none'
      });
      return;
    }

    const flavorProfile = this.analyzeFlavor(selectedBean.flavorNotes);
    const category = this.classifyBean(selectedBean.processing, flavorProfile);
    const cupProfile = this.getCupProfile(selectedCup);
    const paperProfile = this.getPaperProfile(selectedPaper);
    const cupText = this.formatSelectedEquipmentText('cup', this.data.selectedCupEquipmentId, cupProfile.label);
    const paperText = this.formatSelectedEquipmentText('paper', this.data.selectedPaperEquipmentId, paperProfile.label);
    const brewProfile = this.resolveBrewProfile(cupProfile, paperProfile, flavorProfile);
    const feedbackAdjustment = this.getBeanFeedbackAdjustment(selectedBean.id);
    const waterProfile = this.getSelectedWaterProfile();
    const waterAdjustment = this.getWaterTdsAdjustment(waterProfile.tds);
    const roastProfile = this.getRoastLevelProfile(selectedBean.roastLevel);
    const ratio = this.getV2Ratio(category, brewProfile);
    const totalWater = this.getV2TotalWater(doseGrams, ratio, brewProfile, flavorProfile, feedbackAdjustment, waterAdjustment, roastProfile);
    const actualRatio = getActualRatioValue(doseGrams, totalWater) || ratio;
    const actualRatioText = formatActualRatioText(doseGrams, totalWater, `1:${ratio}`);
    const grindDelta = this.getV2GrindDelta(category, selectedBean.processing, doseGrams, brewProfile, paperProfile, flavorProfile, feedbackAdjustment, waterAdjustment, roastProfile, selectedBean);
    const grinderProfile = this.getSelectedGrinderProfile();
    const grindSetting = this.formatSelectedGrinderSetting(grinderProfile, grindDelta);
    const grinderReference = this.formatGrinderReference(grinderProfile, grindDelta);
    const waterTemp = this.getV2WaterTemp(roastProfile);

    // 生成注水阶段
    const stages = this.generateStages(category, brewProfile, doseGrams, totalWater, selectedBean);

    // 风险提示
    const risks = this.generateRisks(category, selectedBean.processing, doseGrams, brewProfile, paperProfile, grindDelta, flavorProfile, feedbackAdjustment, roastProfile, selectedBean);

    const recipe = {
      beanId: selectedBean.id,
      beanName: selectedBean.name || '未命名豆子',
      beanFlavorNotes: this.formatBeanFlavorNotes(selectedBean),
      beanExtraInfo: this.formatBeanExtraInfo(selectedBean),
      methodName: '创建个人方案',
      methodSource: '当前框架',
      grindLabel: '研磨度',
      grindSetting: grindSetting,
      grinderReference,
      grinderNote: '当前框架仍以 C40 杯测为锚点；不同磨豆机刻度不等距，建议自行确认自己的杯测研磨度。',
      grindDelta,
      waterTemp: waterTemp,
      roastLevel: roastProfile.label,
      waterName: waterProfile.name,
      waterTds: waterProfile.tds,
      waterAdjustmentNote: waterAdjustment.note,
      doseGrams,
      totalWater: totalWater,
      ratio: actualRatio,
      ratioText: actualRatioText,
      stages: stages,
      risks: risks,
      cup: cupText,
      paper: `${paperText} · ${brewProfile.filterShape}`,
      cupCategory: cupProfile.label,
      paperCategory: paperProfile.label,
      beanCategory: category,
      route: brewProfile.route,
      targetTime: this.getV2TargetTime(doseGrams, brewProfile),
      flavorPriority: flavorProfile.priority,
      appliedFeedback: feedbackAdjustment,
      feedbackOptions: this.getFeedbackOptions(),
      bookmarked: false,
      createdAt: new Date().toISOString()
    };

    this.setData({
      recipe,
      currentStep: 6,
      canProceed: false,
      rebrewArchiveMode: false,
      rebrewArchiveId: ''
    });
  },

  generateClassicRecipe() {
    const { selectedBean, selectedCup, selectedPaper, doseGrams } = this.data;
    if (!selectedBean || !selectedCup || !selectedPaper || !this.isValidDose(doseGrams)) {
      wx.showToast({
        title: '生成参数不完整',
        icon: 'none'
      });
      return;
    }

    const method = this.getSelectedClassicMethod();
    const params = method.default_params || {};
    const cupProfile = this.getCupProfile(selectedCup);
    const paperProfile = this.getPaperProfile(selectedPaper);
    const cupText = this.formatSelectedEquipmentText('cup', this.data.selectedCupEquipmentId, cupProfile.label);
    const paperText = this.formatSelectedEquipmentText('paper', this.data.selectedPaperEquipmentId, paperProfile.label);
    const ratio = this.getClassicRatio(params.ratio);
    const totalWater = this.roundWaterToDisplay(doseGrams * ratio);
    const actualRatio = getActualRatioValue(doseGrams, totalWater) || ratio;
    const actualRatioText = formatActualRatioText(doseGrams, totalWater, this.formatClassicRatioText(params.ratio, ratio));
    const defaultDose = this.getNumberValue(params.dose_g) || doseGrams;
    const defaultWater = this.getNumberValue(params.water_g) || Math.round(defaultDose * ratio);
    const waterScale = defaultWater ? totalWater / defaultWater : 1;
    const grinderProfile = this.getSelectedGrinderProfile();
    const roastProfile = this.getRoastLevelProfile(selectedBean.roastLevel);
    const classicBaseGrindDelta = this.getClassicGrindDelta(params.grind_size) + roastProfile.grindMove;
    const classicGrindDelta = this.clampClassicGrindDelta(this.applySmallDoseGrindRule(classicBaseGrindDelta, doseGrams, cupProfile, selectedBean.processing, roastProfile, selectedBean));
    const waterProfile = this.getSelectedWaterProfile();
    const classicWaterTemp = this.adjustTemperatureByRoastLevel(this.formatClassicTemperature(params.temperature_c, selectedBean), roastProfile);

    const recipe = {
      beanId: selectedBean.id,
      beanName: selectedBean.name || '未命名豆子',
      beanFlavorNotes: this.formatBeanFlavorNotes(selectedBean),
      beanExtraInfo: this.formatBeanExtraInfo(selectedBean),
      methodName: method.method_name || method.short_name || '经典方案',
      methodSource: '经典方案库',
      grindLabel: '研磨度',
      grindSetting: this.formatClassicGrinderSetting(grinderProfile, classicGrindDelta, params.grind_size),
      grinderReference: this.formatClassicGrinderReference(grinderProfile, classicGrindDelta, params.grind_size),
      grinderNote: '经典方案来自标准方案库；不同磨豆机刻度不等距，建议自行确认磨豆机杯测研磨度以增加方案准确性。',
      grindDelta: classicGrindDelta,
      waterTemp: classicWaterTemp,
      roastLevel: roastProfile.label,
      waterName: waterProfile.name,
      waterTds: waterProfile.tds,
      waterAdjustmentNote: '经典方案不自动按 TDS 改写，只记录本次冲煮水',
      doseGrams,
      totalWater,
      ratio: actualRatio,
      ratioText: actualRatioText,
      stages: this.generateClassicStages(method.steps || [], waterScale),
      risks: this.generateClassicRisks(method, selectedBean, roastProfile, doseGrams, cupProfile),
      cup: cupText,
      paper: paperText,
      cupCategory: cupProfile.label,
      paperCategory: paperProfile.label,
      beanCategory: method.category || '经典方案',
      route: method.short_name || method.method_name || '经典方案',
      targetTime: params.target_time || '',
      feedbackOptions: this.getFeedbackOptions(),
      bookmarked: false,
      createdAt: new Date().toISOString()
    };

    this.setData({
      recipe,
      currentStep: 6,
      canProceed: false,
      rebrewArchiveMode: false,
      rebrewArchiveId: ''
    });
  },

  getSelectedClassicMethod() {
    return CLASSIC_METHODS.find(method => method._id === this.data.selectedClassicMethodId) || CLASSIC_METHODS[0];
  },

  generateClassicStages(steps, waterScale) {
    return steps.map((step, index) => {
      const waterText = this.scaleClassicWater(step.water_to_g, waterScale);
      const timeNode = this.getClassicStageDisplayTime(steps, index);
      const parts = [];
      if (step.time) parts.push(`时间：${step.time}`);
      if (waterText) parts.push(`注水到：${waterText}`);
      if (step.description) parts.push(step.description);

      return {
        name: step.title || `步骤${step.step}`,
        water: waterText || '',
        duration: '',
        timeNode,
        timeLabel: this.getClassicStageTimeLabel(steps, index, timeNode),
        pourStyle: this.isBloomStageName(step.title) ? STAGE_POUR_STYLE : '',
        detail: parts.join(' · ')
      };
    });
  },

  hasClassicWaterStep(step = {}) {
    return step.water_to_g !== null && step.water_to_g !== undefined && step.water_to_g !== '';
  },

  getClassicStageDisplayTime(steps = [], index = 0) {
    const step = steps[index] || {};
    if (!this.hasClassicWaterStep(step)) return step.time || '';

    const nextWaterStep = steps.slice(index + 1).find(item => this.hasClassicWaterStep(item) && item.time);
    if (nextWaterStep) return this.getClassicTimeStart(nextWaterStep.time) || nextWaterStep.time || '';

    return this.getClassicTimeEnd(step.time) || this.getClassicTimeStart(step.time) || step.time || '';
  },

  getClassicStageTimeLabel(steps = [], index = 0, timeNode = '') {
    if (!timeNode) return '';
    const step = steps[index] || {};
    const lastWaterIndex = this.findLastClassicWaterStepIndex(steps);
    if (!this.hasClassicWaterStep(step)) {
      return index > lastWaterIndex ? '预计完成时间' : '时间节点';
    }
    return index >= lastWaterIndex ? '预计完成时间' : '下一段注水';
  },

  findLastClassicWaterStepIndex(steps = []) {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      if (this.hasClassicWaterStep(steps[index])) return index;
    }
    return -1;
  },

  getClassicTimeStart(value) {
    const match = String(value || '').match(/\d{1,2}:\d{1,2}/);
    return match ? match[0] : '';
  },

  getClassicTimeEnd(value) {
    const matches = String(value || '').match(/\d{1,2}:\d{1,2}/g);
    return matches && matches.length ? matches[matches.length - 1] : '';
  },

  isBloomStageName(name = '') {
    const text = String(name || '');
    return text.includes('闷蒸') || text.includes('预浸');
  },

  generateClassicRisks(method, selectedBean, roastProfile = null, doseGrams = 0, cupProfile = null) {
    const flavorProfile = this.analyzeFlavor(selectedBean.flavorNotes);
    const category = this.classifyBean(selectedBean.processing, flavorProfile);
    const roast = roastProfile || this.getRoastLevelProfile(selectedBean.roastLevel);
    const risks = [
      'C40锚点：经典方案保留原方法研磨描述，请先确认自己的杯测研磨度再换算',
      `风味辅助判断：经典方案由用户人工匹配；当前豆子风味识别为 ${flavorProfile.note}`,
      `烘焙度联动：${roast.label}，${roast.note}`,
      '是否应用上次感官反馈：否，经典方案不自动套用当前框架感官修正',
      `豆子分类：${this.formatBeanCategory(category)}`
    ];
    const smallDoseRule = this.getSmallDoseGrindRule(doseGrams, cupProfile || {}, selectedBean.processing, roast, selectedBean);
    if (smallDoseRule && smallDoseRule.note) risks.splice(3, 0, smallDoseRule.note);
    return risks;
  },

  scaleClassicWater(value, scale) {
    if (value === null || value === undefined || value === '') return '';
    const text = String(value);
    return text.replace(/\d+(\.\d+)?/g, match => `${this.roundWaterToDisplay(Number(match) * scale)}`);
  },

  roundWaterToDisplay(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.round(numericValue / 5) * 5;
  },

  getClassicRatio(ratioText) {
    const text = String(ratioText || '1:15');
    const ratioMatches = [...text.matchAll(/1:(\d+(\.\d+)?)/g)].map(match => Number(match[1]));
    if (ratioMatches.length > 1) {
      return ratioMatches.reduce((sum, value) => sum + value, 0) / ratioMatches.length;
    }
    if (ratioMatches.length === 1) return ratioMatches[0];
    const matches = [...text.matchAll(/\d+(\.\d+)?/g)].map(match => Number(match[0]));
    if (matches.length >= 2) return matches[1];
    return 15;
  },

  formatClassicRatioText(ratioText, ratio) {
    if (ratioText) return String(ratioText);
    return `1:${ratio}`;
  },

  formatClassicTemperature(temperature, selectedBean) {
    if (!temperature) return V2_WATER_TEMP;
    if (typeof temperature === 'string' || typeof temperature === 'number') return temperature;
    const roastKey = this.getClassicTemperatureKey(selectedBean.roastLevel);
    if (roastKey && temperature[roastKey]) return temperature[roastKey];
    return temperature.general || temperature.medium_roast || temperature.light_roast || temperature.dark_roast || V2_WATER_TEMP;
  },

  getClassicTemperatureKey(roastLevel) {
    if (roastLevel === 'ultra_light' || roastLevel === 'light') return 'light_roast';
    if (roastLevel === 'medium') return 'medium_roast';
    if (roastLevel === 'dark' || roastLevel === 'ultra_dark') return 'dark_roast';
    return '';
  },

  getRoastLevelProfile(roastLevel) {
    return ROAST_LEVEL_PROFILES[roastLevel] || {
      label: '未记录烘焙度',
      grindMove: 0,
      waterMove: 0,
      tempDelta: 0,
      note: '未记录烘焙度，本杯不应用烘焙度修正'
    };
  },

  getV2WaterTemp(roastProfile) {
    return this.clampWaterTemp(V2_WATER_TEMP + (roastProfile ? roastProfile.tempDelta || 0 : 0));
  },

  adjustTemperatureByRoastLevel(temperature, roastProfile) {
    const number = Number(temperature);
    if (!Number.isFinite(number)) return temperature || this.getV2WaterTemp(roastProfile);
    return this.clampWaterTemp(number + (roastProfile ? roastProfile.tempDelta || 0 : 0));
  },

  clampWaterTemp(value) {
    return Math.max(86, Math.min(94, Math.round(value)));
  },

  clampClassicGrindDelta(delta) {
    return Math.max(-4, Math.min(7, delta));
  },

  getNumberValue(value) {
    const matches = [...String(value || '').matchAll(/\d+(\.\d+)?/g)].map(match => Number(match[0]));
    if (matches.length > 1 && matches[0] !== 1) {
      return matches.reduce((sum, number) => sum + number, 0) / matches.length;
    }
    return matches[0] || 0;
  },

  classifyBean(processing, flavorProfile = {}) {
    const p = (processing || '').toLowerCase();
    if (p === 'washed' || p === 'honey' || p === '水洗' || p === '蜜处理' || p === '密处理') return 'A';
    if (p === 'natural' || p === 'other' || p === '日晒' || p === '其他' || p.includes('厌氧') || p.includes('重发酵') || p.includes('发酵') || p.includes('酒') || p.includes('实验')) return 'B';

    if (flavorProfile.family === 'fermented' || flavorProfile.family === 'tailRisk') return 'B';
    if (flavorProfile.family === 'brightDisplay' || flavorProfile.family === 'sweetClean') return 'A';
    return 'B';
  },

  formatBeanCategory(category) {
    if (category === 'A') {
      return 'A类：水洗 / 干净蜜处理为主，风味描述只作辅助修正';
    }
    return 'B类：日晒 / 特殊处理为主，风味描述只作辅助修正';
  },

  analyzeFlavor(flavorNotes = '') {
    const knowledgeProfile = analyzeFlavorText(flavorNotes);
    const matchedText = knowledgeProfile.matchedText ? `（命中：${knowledgeProfile.matchedText}）` : '';

    if (knowledgeProfile.family === 'tailRisk') {
      return {
        family: 'tailRisk',
        priority: 'guided',
        route: '求稳',
        filterShape: 'T90',
        grindDelta: 1,
        waterDelta: -5,
        note: `风味描述出现尾段风险词${matchedText}，仅作为辅助修正：轻微控尾段，不直接覆盖器具路线`
      };
    }
    if (knowledgeProfile.family === 'fermented') {
      return {
        family: 'fermented',
        priority: 'guided',
        route: '求稳',
        filterShape: 'T90',
        grindDelta: 1,
        waterDelta: -5,
        note: `风味描述偏成熟水果/发酵调${matchedText}，仅作为辅助修正：轻微控制发酵杂味`
      };
    }
    if (knowledgeProfile.family === 'brightDisplay') {
      return {
        family: 'brightDisplay',
        priority: 'guided',
        route: '展示',
        filterShape: 'Wave',
        grindDelta: -1,
        waterDelta: 0,
        note: `风味描述偏花香、柑橘或茶感${matchedText}，仅作为辅助修正：在器具允许时提高表达`
      };
    }
    if (knowledgeProfile.family === 'sweetClean') {
      return {
        family: 'sweetClean',
        priority: 'guided',
        route: '追求口味',
        filterShape: 'Flat 贴壁',
        grindDelta: 0,
        waterDelta: 0,
        note: `风味描述偏甜感和醇厚${matchedText}，仅作为辅助修正：保持甜感与完整度`
      };
    }
    return {
      family: 'neutral',
      priority: 'neutral',
      route: '',
      filterShape: '',
      grindDelta: 0,
      waterDelta: 0,
      note: '风味描述未触发特殊方向，按处理法、器具和滤纸映射当前框架'
    };
  },

  resolveBrewProfile(cupProfile, paperProfile, flavorProfile) {
    const profile = { ...cupProfile };
    if (paperProfile.id === 'fast' && flavorProfile.family === 'brightDisplay') {
      profile.route = '展示';
      profile.filterShape = 'Wave';
    }
    if (paperProfile.id === 'slow' && flavorProfile.family !== 'brightDisplay') {
      profile.route = '求稳';
      profile.filterShape = 'T90';
    }
    if (flavorProfile.family && flavorProfile.family !== 'neutral') {
      profile.risk = `${cupProfile.risk}；${flavorProfile.note}`;
    }
    return profile;
  },

  formatBeanFlavorNotes(bean = {}) {
    return String(bean.flavorNotes || '')
      .replace(/\r?\n+/g, '、')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/、{2,}/g, '、')
      .replace(/^、|、$/g, '')
      .trim();
  },

  formatBeanExtraInfo(bean = {}) {
    const fields = [
      ['产地', bean.origin],
      ['产区/地块', bean.regionLot],
      ['海拔', bean.altitude],
      ['豆种', bean.variety],
      ['烘焙商', bean.roaster]
    ];
    return fields
      .map(([label, value]) => {
        const text = String(value || '').trim();
        return text ? `${label}：${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  },

  getCupProfile(id) {
    return CUP_OPTIONS.find(cup => cup.id === id) || CUP_OPTIONS[0];
  },

  getPaperProfile(id) {
    return PAPER_OPTIONS.find(paper => paper.id === id) || PAPER_OPTIONS[1];
  },

  getSelectedWaterProfile() {
    const selected = WATER_OPTIONS.find(water => water.id === this.data.selectedWaterId) || WATER_OPTIONS[0];
    if (selected.id !== 'custom') return selected;
    const tds = Number(this.data.customWaterTds);
    return {
      ...selected,
      name: `手动 TDS ${tds} ppm`,
      tds
    };
  },

  getWaterTdsAdjustment(tds) {
    const value = Number(tds);
    if (!Number.isFinite(value)) {
      return { grindMove: 0, waterMove: 0, note: '未读取到有效 TDS，不参与当前框架修正' };
    }
    if (value <= 30) {
      return { grindMove: -1, waterMove: -5, note: 'TDS 偏低，轻微细磨并减少总水量，避免酸薄' };
    }
    if (value <= 80) {
      return { grindMove: 0, waterMove: 0, note: 'TDS 偏软，保持当前框架基准参数' };
    }
    if (value <= 150) {
      return { grindMove: 0, waterMove: 0, note: 'TDS 均衡，适合直接映射当前框架参数' };
    }
    if (value <= 250) {
      return { grindMove: 0, waterMove: -5, note: 'TDS 偏高，略收总水量，控制尾段钝感' };
    }
    return { grindMove: 1, waterMove: -10, note: 'TDS 很高，粗 1 格并减少总水量，优先保清晰度' };
  },

  getV2Ratio(category, cupProfile) {
    if (category === 'A') {
      return cupProfile.route === '展示' ? 15.5 : 15;
    }
    return cupProfile.route === '展示' ? 15.5 : 15;
  },

  getV2TotalWater(doseGrams, ratio, cupProfile, flavorProfile, feedbackAdjustment = null, waterAdjustment = null, roastProfile = null) {
    const sd1r = {
      8: 120,
      10: 150,
      12: 180,
      15: 225,
      20: 300
    };
    const babyO = {
      8: 120,
      10: 155,
      12: 185,
      15: 225,
      20: 300
    };
    const table = cupProfile.filterShape === 'T90' ? sd1r : babyO;
    const baseWater = table[doseGrams] || this.roundWaterToDisplay(doseGrams * ratio);
    const adjusted = baseWater
      + (flavorProfile.waterDelta || 0)
      + (feedbackAdjustment ? feedbackAdjustment.waterMove || 0 : 0)
      + (waterAdjustment ? waterAdjustment.waterMove || 0 : 0)
      + (roastProfile ? roastProfile.waterMove || 0 : 0);
    return this.roundWaterToDisplay(Math.max(doseGrams * 14, adjusted));
  },

  getV2GrindDelta(category, processing, doseGrams, cupProfile, paperProfile, flavorProfile, feedbackAdjustment = null, waterAdjustment = null, roastProfile = null, bean = {}) {
    const p = (processing || '').toLowerCase();
    const isSpecial = p === 'other' || p.includes('厌氧') || p.includes('重发酵') || p.includes('发酵') || p.includes('酒') || p.includes('实验');
    let delta = category === 'A' ? 0 : (isSpecial ? 4 : 3);

    delta += cupProfile.grindDelta
      + paperProfile.grindDelta
      + (flavorProfile.grindDelta || 0)
      + (waterAdjustment ? waterAdjustment.grindMove || 0 : 0)
      + (roastProfile ? roastProfile.grindMove || 0 : 0);

    if (doseGrams >= 15 && cupProfile.filterShape !== 'Wave') {
      delta += 1;
    }

    delta = this.applySmallDoseGrindRule(delta, doseGrams, cupProfile, processing, roastProfile, bean);
    delta += feedbackAdjustment ? feedbackAdjustment.grindMove || 0 : 0;
    return this.clampV2GrindDelta(delta, category, isSpecial);
  },

  applySmallDoseGrindRule(delta, doseGrams, cupProfile, processing, roastProfile, bean = {}) {
    const rule = this.getSmallDoseGrindRule(doseGrams, cupProfile, processing, roastProfile, bean);
    if (!rule || rule.keep) return delta;
    return this.clampNumber(delta, rule.min, rule.max);
  },

  getSmallDoseGrindRule(doseGrams, cupProfile = {}, processing = '', roastProfile = null, bean = {}) {
    if (Number(doseGrams) !== 10) return null;
    if (this.isLowBypassCup(cupProfile)) {
      return {
        keep: true,
        note: '10g 小粉量：低旁通滤杯本身萃取效率高，不额外细磨补粉床厚度，避免涩、木、紧。'
      };
    }

    if (this.isMediumOrOldBean(roastProfile, bean)) {
      return {
        min: 3,
        max: 6,
        note: '10g 小粉量：常规滤杯用研磨补粉床厚度；中烘或老豆按 C40杯测 +3格以上起手。'
      };
    }
    if (this.isSpecialFermentation(processing)) {
      return {
        min: 2,
        max: 4,
        note: '10g 小粉量：常规滤杯用研磨补粉床厚度；厌氧 / 重发酵按 C40杯测 +2 到 +4格。'
      };
    }
    if (this.isNaturalProcessing(processing)) {
      return {
        min: 1,
        max: 2,
        note: '10g 小粉量：常规滤杯用研磨补粉床厚度；日晒按 C40杯测 +1 到 +2格。'
      };
    }
    return {
      min: -1,
      max: 0,
      note: '10g 小粉量：常规滤杯用研磨补粉床厚度；水洗 / 蜜处理按 C40杯测 -1 到 ±0格。'
    };
  },

  isLowBypassCup(cupProfile = {}) {
    return cupProfile.id === 'low_bypass_cone'
      || cupProfile.id === 'low_bypass_flat'
      || String(cupProfile.label || '').includes('低旁通');
  },

  isNaturalProcessing(processing = '') {
    const text = String(processing || '').toLowerCase();
    return text === 'natural' || text.includes('日晒');
  },

  isSpecialFermentation(processing = '') {
    const text = String(processing || '').toLowerCase();
    return text === 'other'
      || text.includes('厌氧')
      || text.includes('重发酵')
      || text.includes('发酵')
      || text.includes('酒')
      || text.includes('实验');
  },

  isMediumOrOldBean(roastProfile = null, bean = {}) {
    const roastLevel = String(bean.roastLevel || '').toLowerCase();
    const roastLabel = String((roastProfile && roastProfile.label) || bean.roastLevelLabel || '');
    const isMediumOrDarker = ['medium', 'dark', 'ultra_dark'].includes(roastLevel)
      || roastLabel.includes('中烘')
      || roastLabel.includes('深烘');
    const directAgeDays = Number(bean.roastAgeDays);
    const roastAgeDays = Number.isFinite(directAgeDays) ? directAgeDays : getRoastAgeDays(bean.roastDate);
    return isMediumOrDarker || roastAgeDays >= 30;
  },

  clampV2GrindDelta(delta, category, isSpecial) {
    if (category === 'A') {
      return Math.max(-4, Math.min(4, delta));
    }
    return isSpecial
      ? Math.max(1, Math.min(6, delta))
      : Math.max(0, Math.min(6, delta));
  },

  formatC40Grind(delta) {
    if (delta === 0) return '【C40杯测 ±0格】';
    return `【C40杯测 ${delta > 0 ? '+' : ''}${delta}格】`;
  },

  formatSelectedGrinderSetting(grinderProfile, c40Delta) {
    const target = this.getGrinderTargetText(grinderProfile, c40Delta);
    if (target) return `${grinderProfile.name} ${target}`;
    return `${grinderProfile.name} ${this.formatGrinderMoveText(c40Delta)}`;
  },

  getGrinderTargetText(grinderProfile, c40Delta) {
    if (!grinderProfile) return '';

    const step = Number(grinderProfile.step);
    const unitStep = Number.isFinite(step) ? step : 1;
    const offset = c40Delta * unitStep;
    const unit = grinderProfile.unit || '';
    const base = Number(grinderProfile.base);
    const baseMin = Number(grinderProfile.baseMin);
    const baseMax = Number(grinderProfile.baseMax);

    if (Number.isFinite(base)) {
      return `约 ${this.formatGrinderNumber(base + offset, unitStep)}${unit}`;
    }

    if (Number.isFinite(baseMin) && Number.isFinite(baseMax)) {
      const min = this.formatGrinderNumber(baseMin + offset, unitStep);
      const max = this.formatGrinderNumber(baseMax + offset, unitStep);
      return `约 ${min}-${max}${unit}`;
    }

    return '';
  },

  formatGrinderNumber(value, step) {
    const rounded = Math.round(value * 10) / 10;
    if (!Number.isFinite(rounded)) return '';
    if (Math.abs(step) < 1) return rounded.toFixed(1);
    return `${Math.round(rounded)}`;
  },

  formatGrinderMoveText(c40Delta) {
    if (c40Delta === 0) return '杯测刻度';
    const sign = c40Delta > 0 ? '+' : '';
    return `杯测 ${sign}${c40Delta}格方向`;
  },

  getSelectedGrinderProfile() {
    const defaults = getUserStorageSync('equipmentDefaults', {});
    const grinderId = defaults.grinder || 'preset-grinder-comandante-c40';
    const known = GRINDER_REFERENCES[grinderId];
    if (known) return known;

    const custom = getUserStorageSync('equipment', []).find(e => e.id === grinderId);
    if (custom) {
      const name = custom.brand ? `${custom.brand} ${custom.model}` : custom.model;
      const matched = this.resolveKnownGrinderByText(name);
      if (matched) return matched;

      return {
        name,
        cupping: '请自行标定杯测刻度',
        unit: '格',
        step: 1
      };
    }

    return GRINDER_REFERENCES['preset-grinder-comandante-c40'];
  },

  resolveKnownGrinderByText(text) {
    const value = this.normalizeGrinderMatchText(text);
    if (!value) return null;
    return Object.keys(GRINDER_REFERENCES)
      .map(id => GRINDER_REFERENCES[id])
      .find(profile => {
        const matchers = [profile.name, ...(profile.aliases || [])];
        return matchers.some(alias => {
          const normalizedAlias = this.normalizeGrinderMatchText(alias);
          return normalizedAlias && value.includes(normalizedAlias);
        });
      }) || null;
  },

  normalizeGrinderMatchText(value) {
    return `${value || ''}`
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[-_+/]/g, '');
  },

  formatGrinderReference(grinderProfile, c40Delta) {
    const target = this.getGrinderTargetText(grinderProfile, c40Delta);
    const c40Anchor = this.formatC40Grind(c40Delta);
    if (target) {
      return `${grinderProfile.name}：杯测参考：${grinderProfile.cupping}；本杯建议 ${target}（${c40Anchor}）`;
    }
    if (grinderProfile.cupping && grinderProfile.cupping !== '请自行标定杯测刻度') {
      return `${grinderProfile.name}：杯测参考：${grinderProfile.cupping}；建议先自行确认杯测刻度，本杯按 ${c40Anchor} 方向换算`;
    }
    return `${grinderProfile.name}：请先自行标定杯测刻度；本杯按 ${c40Anchor} 换算`;
  },

  getClassicGrindDelta(grindSize) {
    const text = `${grindSize || ''}`;
    if (!text) return 0;
    if (text.includes('中粗到粗') || text.includes('更粗') || text.includes('粗')) return 3;
    if (text.includes('略细') || text.includes('中细') || text.includes('细砂糖')) return -1;
    if (text.includes('中等') || text.includes('中等研磨')) return 0;
    return 0;
  },

  formatClassicGrinderSetting(grinderProfile, c40Delta, originalGrindSize) {
    const selectedSetting = this.formatSelectedGrinderSetting(grinderProfile, c40Delta);
    if (!originalGrindSize) return selectedSetting;
    return `${selectedSetting}（${originalGrindSize}）`;
  },

  formatClassicGrinderReference(grinderProfile, c40Delta, originalGrindSize) {
    const target = this.getGrinderTargetText(grinderProfile, c40Delta);
    const c40Anchor = this.formatC40Grind(c40Delta);
    const classicText = originalGrindSize || '未提供研磨描述';
    if (target) {
      return `${grinderProfile.name}：经典方案“${classicText}”按 ${target} 参考（${c40Anchor}）`;
    }
    if (grinderProfile.cupping && grinderProfile.cupping !== '请自行标定杯测刻度') {
      return `${grinderProfile.name}：经典方案“${classicText}”；杯测参考：${grinderProfile.cupping}；请先标定杯测刻度后按 ${c40Anchor} 换算`;
    }
    return `${grinderProfile.name}：经典方案“${classicText}”，请先标定杯测刻度后按 ${c40Anchor} 换算`;
  },

  getFeedbackOptions() {
    return Object.keys(FEEDBACK_OPTIONS).map(key => ({
      key,
      label: FEEDBACK_OPTIONS[key].label,
      tone: FEEDBACK_OPTIONS[key].tone || 'warning'
    }));
  },

  getFeedbackSuggestion(type, recipe) {
    const option = FEEDBACK_OPTIONS[type];
    if (!option) return null;
    const grinderProfile = this.getSelectedGrinderProfile();
    let grind = '不调整研磨；保持当前杯测锚点';
    if (option.grindMove) {
      const c40Move = option.grindMove > 0 ? '【C40杯测 +1格】（更粗）' : '【C40杯测 -1格】（更细）';
      const grinderMove = this.formatSelectedGrinderSetting(grinderProfile, option.grindMove);
      grind = `${c40Move}；${grinderMove}`;
    }

    return {
      type,
      label: option.label,
      tone: option.tone || 'warning',
      text: option.text,
      direction: option.direction,
      grind,
      grindMove: option.grindMove,
      waterMove: option.waterMove || 0,
      resetAdjustment: !!option.resetAdjustment,
      note: '同一反馈可在下一杯继续选择并叠加；不同磨豆机刻度不等距，请以你自己确认的杯测研磨度为锚点修正。'
    };
  },

  getBeanFeedbackAdjustment(beanId) {
    if (!beanId) return null;
    const adjustments = getUserStorageSync('beanFeedbackAdjustments', {});
    return adjustments[beanId] || null;
  },

  saveBeanFeedbackAdjustment(recipe, feedback) {
    if (!recipe || !recipe.beanId || !feedback) return null;
    const adjustments = getUserStorageSync('beanFeedbackAdjustments', {});
    const previous = adjustments[recipe.beanId] || {};
    const sameFeedbackStreak = feedback.resetAdjustment
      ? 0
      : (previous.type === feedback.type ? (previous.sameFeedbackStreak || 1) + 1 : 1);
    const grindMove = feedback.resetAdjustment ? 0 : this.clampNumber((previous.grindMove || 0) + (feedback.grindMove || 0), -4, 4);
    const waterMove = feedback.resetAdjustment ? 0 : this.clampNumber((previous.waterMove || 0) + (feedback.waterMove || 0), -40, 20);
    const nextAdjustment = {
      beanId: recipe.beanId,
      label: feedback.label,
      type: feedback.type,
      grindMove,
      waterMove,
      sameFeedbackStreak,
      count: (previous.count || 0) + 1,
      note: feedback.resetAdjustment
        ? `最近反馈：${feedback.label}；已重置累计修正。`
        : `最近反馈：${feedback.label}；同类连续 ${sameFeedbackStreak} 次；累计修正：${this.formatSignedMove(grindMove, '格')}、${this.formatSignedMove(waterMove, 'g')}。`,
      updatedAt: new Date().toISOString()
    };
    adjustments[recipe.beanId] = nextAdjustment;
    setUserStorageSync('beanFeedbackAdjustments', adjustments);
    return nextAdjustment;
  },

  clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  formatSignedMove(value, unit) {
    if (!value) return `±0${unit}`;
    return `${value > 0 ? '+' : ''}${value}${unit}`;
  },

  getV2TargetTime(doseGrams, cupProfile) {
    if (cupProfile.filterShape === 'T90') {
      if (doseGrams <= 10) return '1:40-2:10';
      if (doseGrams <= 15) return '2:00-2:35';
      return '2:10-2:45';
    }
    if (doseGrams <= 10) return '1:45-2:15';
    if (doseGrams <= 15) return '2:00-2:35';
    return '2:10-2:45';
  },

  generateStages(category, cupProfile, doseGrams, totalWater, bean = {}) {
    const bloomWater = this.roundWaterToDisplay(doseGrams * 3);
    const bloomTime = this.getBloomTimeByRoastAge(bean);
    const durationProfile = this.getStageDurationProfile(category, doseGrams);
    const midNode = this.roundWaterToDisplay(totalWater * 0.64);
    const pourNotes = this.getPourControlStageNotes(category, cupProfile, bean);

    const stages = [{
      name: '闷蒸',
      water: bloomWater,
      duration: bloomTime,
      pourStyle: pourNotes.bloom,
      showNote: true
    }];

    if (category === 'A') {
      const secondNode = this.roundWaterToDisplay(totalWater * 0.82);
      stages.push({
        name: '第1段注水',
        water: midNode,
        duration: durationProfile[0],
        pourStyle: pourNotes.first,
        showNote: true
      });
      stages.push({
        name: '第2段注水',
        water: secondNode,
        duration: durationProfile[1],
        pourStyle: pourNotes.middle,
        showNote: true
      });
      stages.push({
        name: '第3段注水',
        water: totalWater,
        duration: durationProfile[2],
        pourStyle: pourNotes.tail,
        showNote: true
      });
    } else {
      stages.push({
        name: '第1段注水',
        water: midNode,
        duration: durationProfile[0],
        pourStyle: pourNotes.first,
        showNote: true
      });
      stages.push({
        name: '第2段注水',
        water: totalWater,
        duration: durationProfile[1],
        pourStyle: pourNotes.tail,
        showNote: true
      });
    }

    return stages;
  },

  getPourControlStageNotes(category, cupProfile = {}, bean = {}) {
    const roastAgeDays = Number.isFinite(Number(bean.roastAgeDays))
      ? Number(bean.roastAgeDays)
      : getRoastAgeDays(bean.roastDate);
    const bloomAgeHint = Number.isFinite(roastAgeDays)
      ? (roastAgeDays <= 7
        ? '新豆气体多，等液面稳定回落再接下一段。'
        : (roastAgeDays >= 30 ? '老豆气泡少，液面回落后可更连续地接下一段。' : '液面开始自然下降即可接下一段。'))
      : '液面开始自然下降即可接下一段。';

    if (category === 'A') {
      return {
        bloom: `闷蒸小水流绕小圈充分打湿；${bloomAgeHint}`,
        first: '小圈绕注，提高花果香、甜感和风味强度；液面只允许缓慢上升。',
        middle: '中段继续小圈或中心小圈；若液面快速抬高，减小水流或停 2-3s 等回落。',
        tail: '后段中心小圈收尾，控制涩木和尾段苦感，不冲粉床边缘。'
      };
    }

    const flatHint = cupProfile.filterShape === 'Flat 贴壁'
      ? '低旁通效率高，避免大圈强扰动。'
      : '以稳定适口性为优先。';
    return {
      bloom: `闷蒸小水流打湿即可，不刻意拉长；${bloomAgeHint}`,
      first: `中心中小水流为主，必要时只做小范围绕圈；${flatHint}液面快速抬高就减小水流。`,
      middle: '',
      tail: '后段中心小圈控尾段；若水位长期很高或尾段变涩木，下一杯考虑截流 10g。'
    };
  },

  getLiquidFeedbackRuleText() {
    return '液面缓慢上升或基本稳定为合格；快速抬高代表注水太快，先减小水流或停 2-3s；粉床很快露出则下一段更早接上。';
  },

  getPourPatternRuleText(category, cupProfile = {}) {
    if (category === 'A') {
      return '绕圈 / 小圈绕负责提高萃取强度、甜感和花果香；后段仍用中心小圈收尾。';
    }
    if (cupProfile.filterShape === 'Flat 贴壁') {
      return 'Flat 贴壁低旁通效率高，中后段以中心小圈为主，少绕圈，避免涩木和浑浊。';
    }
    return '中心 / 中心小圈负责控制尾段、发酵感和木质感；只在中段少量绕圈补强度。';
  },

  getBloomTimeByRoastAge(bean = {}) {
    const directAgeDays = Number(bean.roastAgeDays);
    const roastAgeDays = Number.isFinite(directAgeDays) ? directAgeDays : getRoastAgeDays(bean.roastDate);
    if (!Number.isFinite(roastAgeDays) || roastAgeDays < 0) return 40;
    if (roastAgeDays <= 7) return 45;
    if (roastAgeDays <= 14) return 40;
    if (roastAgeDays < 30) return 30;
    return 20;
  },

  getStageDurationProfile(category, doseGrams) {
    const dose = Number(doseGrams);
    if (category === 'A') {
      if (dose <= 10) return [35, 20, 20];
      if (dose <= 15) return [40, 25, 25];
      return [45, 30, 30];
    }
    if (dose <= 10) return [45, 30];
    if (dose <= 15) return [55, 35];
    return [65, 40];
  },

  generateRisks(category, processing, doseGrams, cupProfile, paperProfile, grindDelta, flavorProfile, feedbackAdjustment = null, roastProfile = null, bean = {}) {
    const risks = [
      `C40锚点：杯测21格，本方案为 ${this.formatC40Grind(grindDelta)}`,
      `风味辅助判断：${flavorProfile.note}`,
      `液面反馈：${this.getLiquidFeedbackRuleText()}`,
      `注水手法：${this.getPourPatternRuleText(category, cupProfile)}`
    ];
    if (roastProfile) {
      risks.push(`烘焙度联动：${roastProfile.label}，${roastProfile.note}`);
    }
    const smallDoseRule = this.getSmallDoseGrindRule(doseGrams, cupProfile, processing, roastProfile, bean);
    if (smallDoseRule && smallDoseRule.note) {
      risks.push(smallDoseRule.note);
    }
    if (feedbackAdjustment) {
      risks.push(`是否应用上次感官反馈：是，${feedbackAdjustment.label}，累计修正 ${this.formatSignedMove(feedbackAdjustment.grindMove, '格')}、${this.formatSignedMove(feedbackAdjustment.waterMove, 'g')}`);
    } else {
      risks.push('是否应用上次感官反馈：否，本杯未读取到该豆子的历史感官修正');
    }
    risks.push(`豆子分类：${this.formatBeanCategory(category)}`);
    return risks;
  },

  // ===== Step 4: 方案操作 =====
  onBookmark(e) {
    const recipe = { ...this.data.recipe, bookmarked: !this.data.recipe.bookmarked };
    this.setData({ recipe });
  },

  onFlavorFeedback(e) {
    if (!requireLogin('登录后可记录风味反馈，并让下一杯按这颗豆子继续校准。')) return;
    const type = e.detail.type;
    const feedback = this.getFeedbackSuggestion(type, this.data.recipe);
    if (!feedback) return;
    const nextAdjustment = this.saveBeanFeedbackAdjustment(this.data.recipe, feedback);
    const recipeWithFeedback = {
      ...this.data.recipe,
      feedback,
      nextFeedbackAdjustment: nextAdjustment
    };
    const recipe = this.data.rebrewArchiveMode
      ? this.buildFeedbackAdjustedRebrewRecipe(recipeWithFeedback, feedback, nextAdjustment)
      : recipeWithFeedback;
    this.setData({
      recipe
    });
    if (recipe.saved && !this.data.rebrewArchiveMode) this.persistSavedRecipeFeedback(recipe);
  },

  persistSavedRecipeFeedback(recipe) {
    if (!recipe || !recipe.saved) return;
    const recipes = getUserStorageSync('recipes', []);
    const updatedRecipes = recipes.map(item => {
      const matchedById = recipe.id && item.id === recipe.id;
      const matchedByTime = recipe.savedAt && item.savedAt === recipe.savedAt;
      if (!matchedById && !matchedByTime) return item;
      return {
        ...item,
        feedback: recipe.feedback,
        nextFeedbackAdjustment: recipe.nextFeedbackAdjustment
      };
    });
    setUserStorageSync('recipes', updatedRecipes);
  },

  buildFeedbackAdjustedRebrewRecipe(recipe, feedback, nextAdjustment) {
    if (!recipe || !feedback) return recipe;
    if (recipe.methodSource === '经典方案库') {
      return this.buildClassicFeedbackAdjustedRecipe(recipe, feedback, nextAdjustment);
    }
    return this.buildPersonalFeedbackAdjustedRecipe(recipe, nextAdjustment);
  },

  buildPersonalFeedbackAdjustedRecipe(recipe, nextAdjustment) {
    const bean = this.getArchivedRecipeBean(recipe);
    const cupProfile = this.getCupProfile(this.getCupIdFromRecipe(recipe));
    const paperProfile = this.getPaperProfile(this.getPaperIdFromRecipe(recipe));
    const flavorProfile = this.analyzeFlavor(bean.flavorNotes || '');
    const category = this.classifyBean(bean.processing, flavorProfile);
    const brewProfile = this.resolveBrewProfile(cupProfile, paperProfile, flavorProfile);
    const waterProfile = this.getWaterProfileFromRecipe(recipe);
    const waterAdjustment = this.getWaterTdsAdjustment(waterProfile.tds);
    const roastProfile = this.getRoastProfileFromRecipe(bean, recipe);
    const doseGrams = Number(recipe.doseGrams) || this.data.doseGrams;
    const ratio = this.getV2Ratio(category, brewProfile);
    const totalWater = this.getV2TotalWater(doseGrams, ratio, brewProfile, flavorProfile, nextAdjustment, waterAdjustment, roastProfile);
    const actualRatio = getActualRatioValue(doseGrams, totalWater) || ratio;
    const actualRatioText = formatActualRatioText(doseGrams, totalWater, `1:${ratio}`);
    const grindDelta = this.getV2GrindDelta(category, bean.processing, doseGrams, brewProfile, paperProfile, flavorProfile, nextAdjustment, waterAdjustment, roastProfile, bean);
    const grinderProfile = this.getSelectedGrinderProfile();

    return {
      ...recipe,
      methodName: recipe.methodName || '创建个人方案',
      methodSource: recipe.methodSource || '当前框架',
      grindSetting: this.formatSelectedGrinderSetting(grinderProfile, grindDelta),
      grinderReference: this.formatGrinderReference(grinderProfile, grindDelta),
      grindDelta,
      beanFlavorNotes: this.formatBeanFlavorNotes(bean),
      beanExtraInfo: this.formatBeanExtraInfo(bean),
      waterTemp: this.getV2WaterTemp(roastProfile),
      waterName: waterProfile.name,
      waterTds: waterProfile.tds,
      waterAdjustmentNote: waterAdjustment.note,
      totalWater,
      ratio: actualRatio,
      ratioText: actualRatioText,
      stages: this.generateStages(category, brewProfile, doseGrams, totalWater, bean),
      risks: this.generateRisks(category, bean.processing, doseGrams, brewProfile, paperProfile, grindDelta, flavorProfile, nextAdjustment, roastProfile, bean),
      cupCategory: cupProfile.label,
      paperCategory: paperProfile.label,
      beanCategory: category,
      route: brewProfile.route,
      targetTime: this.getV2TargetTime(doseGrams, brewProfile),
      flavorPriority: flavorProfile.priority,
      appliedFeedback: nextAdjustment,
      updatedAt: new Date().toISOString()
    };
  },

  buildClassicFeedbackAdjustedRecipe(recipe, feedback, nextAdjustment) {
    const grinderProfile = this.getSelectedGrinderProfile();
    const currentDelta = Number(recipe.grindDelta);
    const grindDelta = feedback.resetAdjustment
      ? (Number.isFinite(currentDelta) ? currentDelta : 0)
      : this.clampClassicGrindDelta((Number.isFinite(currentDelta) ? currentDelta : 0) + (feedback.grindMove || 0));
    const currentWater = Number(recipe.totalWater);
    const nextWater = feedback.resetAdjustment
      ? currentWater
      : this.roundWaterToDisplay(Math.max((Number(recipe.doseGrams) || 0) * 14, (Number.isFinite(currentWater) ? currentWater : 0) + (feedback.waterMove || 0)));
    const actualRatio = getActualRatioValue(recipe.doseGrams, nextWater);
    const actualRatioText = formatActualRatioText(recipe.doseGrams, nextWater, recipe.ratioText || '');
    const waterScale = Number.isFinite(currentWater) && currentWater > 0 && Number.isFinite(nextWater) && nextWater > 0
      ? nextWater / currentWater
      : 1;

    return {
      ...recipe,
      grindSetting: this.formatSelectedGrinderSetting(grinderProfile, grindDelta),
      grinderReference: this.formatGrinderReference(grinderProfile, grindDelta),
      grindDelta,
      totalWater: Number.isFinite(nextWater) && nextWater > 0 ? nextWater : recipe.totalWater,
      ratio: actualRatio || recipe.ratio,
      ratioText: actualRatioText || recipe.ratioText,
      stages: this.scaleRecipeStageWater(recipe.stages || [], waterScale),
      risks: this.updateClassicRisksWithFeedback(recipe.risks || [], nextAdjustment),
      appliedFeedback: nextAdjustment,
      updatedAt: new Date().toISOString()
    };
  },

  updateClassicRisksWithFeedback(risks = [], nextAdjustment = null) {
    const filteredRisks = risks.filter(risk => !String(risk).startsWith('是否应用上次感官反馈：'));
    if (!nextAdjustment) return filteredRisks;
    filteredRisks.push(`是否应用上次感官反馈：是，${nextAdjustment.label}，累计修正 ${this.formatSignedMove(nextAdjustment.grindMove, '格')}、${this.formatSignedMove(nextAdjustment.waterMove, 'g')}`);
    return filteredRisks;
  },

  getArchivedRecipeBean(recipe = {}) {
    const bean = getUserStorageSync('beans', []).find(item => item.id === recipe.beanId);
    if (bean) return bean;
    return {
      id: recipe.beanId,
      name: recipe.beanName,
      processing: '',
      flavorNotes: recipe.beanFlavorNotes || '',
      roastLevel: ''
    };
  },

  getCupIdFromRecipe(recipe = {}) {
    const matched = CUP_OPTIONS.find(cup => cup.label === recipe.cupCategory || String(recipe.cup || '').includes(cup.label));
    return matched ? matched.id : this.data.selectedCup;
  },

  getPaperIdFromRecipe(recipe = {}) {
    const matched = PAPER_OPTIONS.find(paper => paper.label === recipe.paperCategory || String(recipe.paper || '').includes(paper.label));
    return matched ? matched.id : this.data.selectedPaper;
  },

  getWaterProfileFromRecipe(recipe = {}) {
    const tds = Number(recipe.waterTds);
    return {
      id: 'archive',
      name: recipe.waterName || '存档冲煮水',
      tds: Number.isFinite(tds) ? tds : ''
    };
  },

  getRoastProfileFromRecipe(bean = {}, recipe = {}) {
    if (bean.roastLevel) return this.getRoastLevelProfile(bean.roastLevel);
    const matched = Object.keys(ROAST_LEVEL_PROFILES)
      .map(key => ROAST_LEVEL_PROFILES[key])
      .find(profile => profile.label === recipe.roastLevel);
    return matched || this.getRoastLevelProfile('');
  },

  scaleRecipeStageWater(stages = [], scale = 1) {
    return stages.map(stage => {
      const water = Number(stage.water);
      if (!Number.isFinite(water)) return stage;
      return {
        ...stage,
        water: this.roundWaterToDisplay(water * scale)
      };
    });
  },

  normalizeArchiveValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(2)) : '';
    return String(value).trim();
  },

  buildRecipeArchiveSignature(recipe = {}) {
    const normalize = value => this.normalizeArchiveValue(value);
    const methodName = normalize(recipe.methodName);
    const planType = methodName && methodName !== '创建个人方案' ? methodName : '生成定制化方案';

    return JSON.stringify({
      bean: normalize(recipe.beanId || recipe.beanName),
      planType,
      classicMethodId: normalize(recipe.classicMethodId || recipe.selectedClassicMethodId),
      doseGrams: normalize(recipe.doseGrams),
      cup: normalize(recipe.cup),
      paper: normalize(recipe.paper)
    });
  },

  findMatchingSavedRecipeIndex(recipes, recipe) {
    const signature = this.buildRecipeArchiveSignature(recipe);
    const archiveId = recipe.archiveId || this.data.rebrewArchiveId;
    if (archiveId) {
      const archiveIndex = recipes.findIndex((item, index) => this.getRecipeArchiveId(item, index) === archiveId);
      if (archiveIndex >= 0) return { index: archiveIndex, signature };
    }
    const index = recipes.findIndex(item =>
      item.archiveSignature === signature || this.buildRecipeArchiveSignature(item) === signature
    );
    return { index, signature };
  },

  onBackFromRecipe() {
    if (this.data.rebrewArchiveMode) {
      wx.switchTab({
        url: '/pages/recipes/recipes'
      });
      return;
    }
    const step = 5;
    this.setData({
      currentStep: step,
      canProceed: this.checkCanProceed(step)
    });
  },

  onRetry() {
    this.setData({
      currentStep: 1,
      recipe: null,
      selectedBean: null,
      selectedPlanType: '',
      selectedClassicMethodId: '',
      canProceed: false,
      rebrewArchiveMode: false,
      rebrewArchiveId: ''
    }, () => {
      this.applyEquipmentDefaults();
      this.loadBeans();
    });
  },

  onStartBrewTimer(e) {
    const recipe = (e && e.detail && e.detail.recipe) || this.data.recipe;
    if (!recipe || !Array.isArray(recipe.stages) || !recipe.stages.length) {
      wx.showToast({
        title: '暂无可用冲煮阶段',
        icon: 'none'
      });
      return;
    }
    wx.setStorageSync(ACTIVE_BREW_TIMER_KEY, recipe);
    wx.navigateTo({
      url: '/pages/brew/timer/timer'
    });
  },

  stripRebrewRuntimeMeta(recipe = {}) {
    const {
      archiveId,
      fromArchiveRebrew,
      ...savedRecipe
    } = recipe;
    return savedRecipe;
  },

  onSaveRecipe() {
    if (!requireLogin('登录后可保存方案、扣减库存，并同步到你的方案存档。')) return;
    const recipe = this.data.recipe;
    if (!recipe) return;
    if (recipe.saved && !this.data.rebrewArchiveMode) {
      wx.showToast({
        title: '已保存过',
        icon: 'none'
      });
      return;
    }

    try {
      const recipes = getUserStorageSync('recipes', []);
      const { index: matchedIndex, signature } = this.findMatchingSavedRecipeIndex(recipes, recipe);
      const savedPayload = this.stripRebrewRuntimeMeta(recipe);
      if (matchedIndex >= 0) {
        const existing = recipes[matchedIndex];
        const stockResult = this.deductBeanStock(recipe.beanId, recipe.doseGrams);
        const updatedRecipe = {
          ...existing,
          ...savedPayload,
          id: existing.id || savedPayload.id || Date.now().toString(),
          saved: true,
          savedAt: existing.savedAt || savedPayload.savedAt || new Date().toISOString(),
          bookmarked: existing.bookmarked || savedPayload.bookmarked,
          stockDeducted: stockResult.deducted,
          stockDeductedAmount: stockResult.deductedAmount,
          stockBefore: stockResult.before,
          stockAfter: stockResult.after,
          totalStockDeductedAmount: this.formatStockNumber((Number(existing.totalStockDeductedAmount || existing.stockDeductedAmount || 0) || 0) + stockResult.deductedAmount),
          feedback: savedPayload.feedback || existing.feedback,
          nextFeedbackAdjustment: savedPayload.nextFeedbackAdjustment || existing.nextFeedbackAdjustment,
          archiveSignature: signature,
          updatedAt: new Date().toISOString()
        };
        recipes[matchedIndex] = updatedRecipe;
        setUserStorageSync('recipes', recipes);
        this.setData({
          recipe: updatedRecipe,
          rebrewArchiveMode: false,
          rebrewArchiveId: ''
        });
        wx.showToast({
          title: stockResult.deducted ? `已更新并扣 ${stockResult.deductedAmount}g` : '已更新存档',
          icon: 'success',
          duration: 1500
        });
        return;
      }

      const stockResult = this.deductBeanStock(recipe.beanId, recipe.doseGrams);
      const savedAt = new Date().toISOString();
      const savedRecipe = {
        ...savedPayload,
        id: Date.now().toString(),
        saved: true,
        stockDeducted: stockResult.deducted,
        stockDeductedAmount: stockResult.deductedAmount,
        stockBefore: stockResult.before,
        stockAfter: stockResult.after,
        archiveSignature: signature,
        savedAt
      };
      recipes.unshift(savedRecipe);
      setUserStorageSync('recipes', recipes);
      this.setData({
        recipe: savedRecipe,
        rebrewArchiveMode: false,
        rebrewArchiveId: ''
      });

      wx.showToast({
        title: stockResult.deducted ? `已扣 ${stockResult.deductedAmount}g` : '已保存',
        icon: 'success',
        duration: 1500
      });
    } catch (e) {
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },

  onShareCard(e) {
    const recipe = (e.detail && e.detail.recipe) || this.data.recipe;
    return createRecipeShareCard(this, recipe);
  },

  onCloseShareCard() {
    closeRecipeShareCard(this);
  },

  onSaveShareCard() {
    saveRecipeShareCard(this);
  },

  onShareAppMessage() {
    return buildSharePayload(this, this.data.recipe);
  },

  onShareTimeline() {
    return buildTimelinePayload(this, this.data.recipe);
  },

  deductBeanStock(beanId, doseGrams) {
    if (!beanId || !doseGrams) {
      return { deducted: false, deductedAmount: 0, before: null, after: null };
    }
    const beans = getUserStorageSync('beans', []);
    const index = beans.findIndex(bean => bean.id === beanId);
    if (index < 0) {
      return { deducted: false, deductedAmount: 0, before: null, after: null };
    }
    const before = this.parseStockNumber(beans[index].stockGrams);
    if (before === null || before <= 0) {
      return { deducted: false, deductedAmount: 0, before, after: before };
    }
    const after = this.formatStockNumber(Math.max(0, before - Number(doseGrams)));
    const deductedAmount = this.formatStockNumber(before - after);
    beans[index] = {
      ...beans[index],
      stockGrams: after,
      updatedAt: new Date().toISOString()
    };
    setUserStorageSync('beans', beans);
    return { deducted: deductedAmount > 0, deductedAmount, before, after };
  },

  parseStockNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  },

  formatStockNumber(value) {
    return Number.isInteger(value) ? value : Number(value.toFixed(1));
  }
});
