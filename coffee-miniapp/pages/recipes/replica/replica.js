const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../../utils/auth.js');
const {
  buildSharePayload,
  buildTimelinePayload,
  closeRecipeShareCard,
  createRecipeShareCard,
  saveRecipeShareCard
} = require('../../../utils/share-card.js');

const DEFAULT_STAGES = [
  { name: '闷蒸', water: '', duration: '', pourStyle: '' },
  { name: '第一段注水', water: '', duration: '', pourStyle: '' },
  { name: '第二段注水', water: '', duration: '', pourStyle: '' }
];

Page({
  data: {
    saved: false,
    form: {
      beanName: '',
      methodName: '个人方案复刻',
      methodSource: '个人冲煮记录',
      grindLabel: '研磨度',
      grindSetting: '',
      waterTemp: '',
      totalWater: '',
      ratioText: '',
      doseGrams: '',
      targetTime: '',
      cup: '',
      paper: '',
      grinderReference: '',
      grinderNote: '',
      waterName: '',
      waterTds: '',
      waterAdjustmentNote: '',
      risksText: ''
    },
    stages: DEFAULT_STAGES,
    previewRecipe: null,
    shareCardVisible: false,
    shareCardImage: '',
    shareCardRecipe: null
  },

  onLoad() {
    if (!requireLogin()) return;
    this.updatePreviewRecipe();
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value,
      saved: false
    }, () => {
      this.updatePreviewRecipe();
    });
  },

  onStageInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    if (!Number.isInteger(index) || !field) return;
    this.setData({
      [`stages[${index}].${field}`]: e.detail.value,
      saved: false
    }, () => {
      this.updatePreviewRecipe();
    });
  },

  onAddStage() {
    this.setData({
      stages: this.data.stages.concat({ name: '', water: '', duration: '', pourStyle: '' }),
      saved: false
    }, () => {
      this.updatePreviewRecipe();
    });
  },

  onRemoveStage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.stages.length <= 1 || !Number.isInteger(index)) return;
    const stages = this.data.stages.filter((_, itemIndex) => itemIndex !== index);
    this.setData({
      stages,
      saved: false
    }, () => {
      this.updatePreviewRecipe();
    });
  },

  updatePreviewRecipe() {
    this.setData({
      previewRecipe: this.buildRecipe(this.data.saved)
    });
  },

  buildRecipe(saved = false) {
    const form = this.data.form;
    const stages = this.buildStages();
    const risks = this.buildRisks();
    const waterName = this.trim(form.waterName);
    const waterTds = this.trim(form.waterTds);

    return {
      beanName: this.trim(form.beanName) || '未命名复刻方案',
      methodName: this.trim(form.methodName) || '个人方案复刻',
      methodSource: this.trim(form.methodSource) || '个人冲煮记录',
      grindLabel: this.trim(form.grindLabel) || '研磨度',
      grindSetting: this.trim(form.grindSetting),
      waterTemp: this.trim(form.waterTemp),
      totalWater: this.trim(form.totalWater),
      ratioText: this.trim(form.ratioText),
      doseGrams: this.trim(form.doseGrams),
      targetTime: this.trim(form.targetTime),
      cup: this.trim(form.cup),
      paper: this.trim(form.paper),
      grinderReference: this.trim(form.grinderReference),
      grinderNote: this.trim(form.grinderNote),
      waterName,
      waterTds,
      waterAdjustmentNote: this.trim(form.waterAdjustmentNote),
      stages,
      risks,
      manualReplica: true,
      linkedToFramework: false,
      feedbackOptions: [],
      bookmarked: false,
      saved
    };
  },

  buildStages() {
    return this.data.stages
      .map(stage => ({
        name: this.trim(stage.name),
        water: this.trim(stage.water),
        duration: this.trim(stage.duration),
        pourStyle: this.trim(stage.pourStyle)
      }))
      .filter(stage => stage.name || stage.water || stage.duration || stage.pourStyle);
  },

  buildRisks() {
    return this.trim(this.data.form.risksText)
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  },

  validateRecipe(recipe) {
    if (!this.trim(recipe.beanName) || recipe.beanName === '未命名复刻方案') {
      return '请输入方案名称';
    }
    if (!this.trim(recipe.grindSetting)) return '请输入研磨度';
    if (!this.trim(recipe.waterTemp)) return '请输入水温';
    if (!this.trim(recipe.totalWater)) return '请输入总水量';
    if (!this.trim(recipe.ratioText)) return '请输入粉水比';
    const hasValidStage = recipe.stages.some(stage => stage.name && stage.water && stage.duration);
    if (!hasValidStage) return '请至少完整填写一个注水阶段';
    return '';
  },

  onSaveReplica() {
    if (!requireLogin('登录后可保存个人方案复刻记录。')) return;
    const recipe = this.buildRecipe(true);
    const error = this.validateRecipe(recipe);
    if (error) {
      wx.showToast({
        title: error,
        icon: 'none'
      });
      return;
    }

    const now = new Date().toISOString();
    const savedRecipe = {
      ...recipe,
      id: Date.now().toString(),
      saved: true,
      createdAt: now,
      savedAt: now
    };
    const recipes = getUserStorageSync('recipes', []);
    recipes.unshift(savedRecipe);
    setUserStorageSync('recipes', recipes);
    this.setData({
      saved: true,
      previewRecipe: savedRecipe
    });
    wx.showToast({
      title: '已保存',
      icon: 'success'
    });
  },

  onShareCard(e) {
    const recipe = (e.detail && e.detail.recipe) || this.data.previewRecipe || this.buildRecipe(false);
    const error = this.validateRecipe(recipe);
    if (error) {
      wx.showToast({
        title: error,
        icon: 'none'
      });
      return null;
    }
    return createRecipeShareCard(this, recipe);
  },

  onCloseShareCard() {
    closeRecipeShareCard(this);
  },

  onSaveShareCard() {
    saveRecipeShareCard(this);
  },

  onBackToArchive() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return buildSharePayload(this, this.data.previewRecipe || this.buildRecipe(false));
  },

  onShareTimeline() {
    return buildTimelinePayload(this, this.data.previewRecipe || this.buildRecipe(false));
  },

  trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }
});
