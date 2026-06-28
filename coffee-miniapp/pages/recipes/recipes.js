const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../utils/auth.js');
const {
  buildSharePayload,
  buildTimelinePayload,
  closeRecipeShareCard,
  createRecipeShareCard,
  saveRecipeShareCard
} = require('../../utils/share-card.js');
const { formatRecipeRatioText } = require('../../utils/ratio.js');
const { syncCustomTabBar } = require('../../utils/tabbar.js');

const REBREW_ARCHIVE_KEY = 'coffeePendingRebrewRecipe';
const ACTIVE_BREW_TIMER_KEY = 'coffeeActiveBrewTimerRecipe';

Page({
  data: {
    recipes: [],
    expandedRecipeId: '',
    batchMode: false,
    selectedBatchIds: [],
    shareCardVisible: false,
    shareCardImage: '',
    shareCardRecipe: null
  },

  onLoad(options = {}) {
    if (options.recipeId) {
      this.pendingRecipeId = decodeURIComponent(options.recipeId);
    }
  },

  onShow() {
    syncCustomTabBar(this, 'pages/recipes/recipes');
    this.loadRecipes();
  },

  loadRecipes() {
    try {
      const recipes = getUserStorageSync('recipes', []);
      const beans = getUserStorageSync('beans', []);
      const beanById = beans.reduce((map, bean) => {
        if (bean && bean.id) map[bean.id] = bean;
        return map;
      }, {});
      const selectedBatchIds = this.data.selectedBatchIds || [];
      const mappedRecipes = recipes.map((recipe, index) => this.withArchiveMeta(recipe, index, selectedBatchIds, beanById));
      const pendingRecipeId = this.pendingRecipeId || '';
      const hasPendingRecipe = pendingRecipeId && mappedRecipes.some(recipe => recipe.archiveId === pendingRecipeId);
      if (hasPendingRecipe) this.pendingRecipeId = '';
      this.setData({
        recipes: mappedRecipes,
        expandedRecipeId: hasPendingRecipe ? pendingRecipeId : this.data.expandedRecipeId
      });
    } catch (e) {
      console.error('加载方案失败:', e);
    }
  },

  withArchiveMeta(recipe, index, selectedBatchIds = [], beanById = {}) {
    const archiveId = recipe.id || recipe.savedAt || recipe.createdAt || `recipe-${index}`;
    const savedTime = recipe.savedAt || recipe.createdAt || '';
    const feedback = recipe.feedback || null;
    const meta = [];
    if (recipe.doseGrams) meta.push(`${recipe.doseGrams}g 粉`);
    if (recipe.totalWater) meta.push(`${recipe.totalWater}g 水`);
    const ratioText = formatRecipeRatioText(recipe);
    if (ratioText) meta.push(ratioText);
    if (recipe.targetTime) meta.push(recipe.targetTime);

    return {
      ...recipe,
      beanFlavorNotes: recipe.beanFlavorNotes || this.getArchiveBeanFlavorNotes(recipe, beanById),
      beanExtraInfo: recipe.beanExtraInfo || this.getArchiveBeanExtraInfo(recipe, beanById),
      archiveId,
      archiveDate: this.formatArchiveDate(savedTime),
      archiveMeta: meta.join(' · '),
      archiveMethod: this.getArchiveMethodName(recipe),
      archiveFeedbackLabel: feedback ? `本次反馈：${feedback.label}` : '',
      archiveFeedbackTone: feedback ? this.getFeedbackTone(feedback) : '',
      archiveFeedbackText: feedback ? feedback.text : '',
      archiveFeedbackGrind: feedback ? feedback.grind : '',
      archiveFeedbackNext: recipe.nextFeedbackAdjustment ? recipe.nextFeedbackAdjustment.note : '',
      batchSelected: selectedBatchIds.includes(archiveId)
    };
  },

  getArchiveBeanFlavorNotes(recipe = {}, beanById = {}) {
    const bean = recipe.beanId ? beanById[recipe.beanId] : null;
    return String((bean && bean.flavorNotes) || '').trim();
  },

  getArchiveBeanExtraInfo(recipe = {}, beanById = {}) {
    const bean = recipe.beanId ? beanById[recipe.beanId] : null;
    if (!bean) return '';
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

  getArchiveMethodName(recipe = {}) {
    if (recipe.methodName === '创建个人方案') return '生成定制化方案';
    return recipe.methodName || recipe.route || recipe.beanCategory || '个人方案';
  },

  getFeedbackTone(feedback = {}) {
    if (feedback.tone) return feedback.tone;
    if (feedback.type === 'justRight') return 'good';
    if (feedback.type === 'bitterAstringent' || feedback.type === 'heavyTight') return 'alert';
    return 'warning';
  },

  formatArchiveDate(value) {
    if (!value) return '未记录时间';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  stripArchiveMeta(recipe) {
    const {
      archiveId,
      archiveDate,
      archiveMeta,
      archiveMethod,
      archiveFeedbackLabel,
      archiveFeedbackTone,
      archiveFeedbackText,
      archiveFeedbackGrind,
      archiveFeedbackNext,
      batchSelected,
      ...rawRecipe
    } = recipe;
    return rawRecipe;
  },

  persistRecipes(recipes) {
    setUserStorageSync('recipes', recipes.map(recipe => this.stripArchiveMeta(recipe)));
  },

  onToggleRecipe(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.batchMode) {
      this.toggleRecipeSelection(id);
      return;
    }
    this.setData({
      expandedRecipeId: this.data.expandedRecipeId === id ? '' : id
    });
  },

  onToggleBatchMode() {
    if (!this.data.batchMode && !requireLogin('登录后可批量管理你的方案存档。')) return;
    const batchMode = !this.data.batchMode;
    this.setData({
      batchMode,
      expandedRecipeId: '',
      selectedBatchIds: [],
      recipes: this.data.recipes.map(recipe => ({
        ...recipe,
        batchSelected: false
      }))
    });
  },

  toggleRecipeSelection(id) {
    const selected = new Set(this.data.selectedBatchIds || []);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    const selectedBatchIds = Array.from(selected);
    this.setData({
      selectedBatchIds,
      recipes: this.data.recipes.map(recipe => ({
        ...recipe,
        batchSelected: selected.has(recipe.archiveId)
      }))
    });
  },

  onToggleSelectAll() {
    const allSelected = this.data.recipes.length > 0 && this.data.selectedBatchIds.length === this.data.recipes.length;
    const selectedBatchIds = allSelected ? [] : this.data.recipes.map(recipe => recipe.archiveId);
    const selected = new Set(selectedBatchIds);
    this.setData({
      selectedBatchIds,
      recipes: this.data.recipes.map(recipe => ({
        ...recipe,
        batchSelected: selected.has(recipe.archiveId)
      }))
    });
  },

  onDeleteSelected() {
    if (!requireLogin('登录后可删除你的方案存档。')) return;
    const selectedBatchIds = this.data.selectedBatchIds || [];
    if (!selectedBatchIds.length) {
      wx.showToast({
        title: '请先选择方案',
        icon: 'none'
      });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的 ${selectedBatchIds.length} 条方案吗？`,
      success: (res) => {
        if (!res.confirm) return;
        const selected = new Set(selectedBatchIds);
        const recipes = getUserStorageSync('recipes', [])
          .map((recipe, index) => this.withArchiveMeta(recipe, index))
          .filter(recipe => !selected.has(recipe.archiveId));
        this.persistRecipes(recipes);
        this.setData({
          batchMode: false,
          selectedBatchIds: [],
          expandedRecipeId: ''
        });
        this.loadRecipes();
        wx.showToast({
          title: '已删除',
          icon: 'success'
        });
      }
    });
  },

  onBookmark(e) {
    if (!requireLogin('登录后可收藏和更新你的方案存档。')) return;
    const recipe = e.detail.recipe;
    const recipes = this.data.recipes.map(item =>
      item.archiveId === recipe.archiveId ? { ...item, bookmarked: !item.bookmarked } : item
    );
    this.setData({ recipes });
    this.persistRecipes(recipes);
  },

  // 需求④：个性化风味备忘录（用原生输入弹窗，轻量，不另起页面）
  onEditNote(e) {
    if (!requireLogin('登录后可给方案添加风味备忘。')) return;
    const archiveId = e.currentTarget.dataset.id;
    const recipe = this.data.recipes.find(item => item.archiveId === archiveId);
    if (!recipe) return;
    wx.showModal({
      title: '风味备忘录',
      editable: true,
      placeholderText: '写下你对这杯的个性化风味形容…',
      content: recipe.personalNote || '',
      success: (res) => {
        if (!res.confirm) return;
        const personalNote = String(res.content || '').trim();
        const recipes = this.data.recipes.map(item =>
          item.archiveId === archiveId ? { ...item, personalNote } : item
        );
        this.setData({ recipes });
        this.persistRecipes(recipes);
        wx.showToast({ title: personalNote ? '已保存备忘' : '已清空备忘', icon: 'none' });
      }
    });
  },

  // 需求③：进入方案编辑（复用 replica 表单的编辑模式，改完不再参与参数联动）
  onEditRecipe(e) {
    if (!requireLogin('登录后可修改你的方案。')) return;
    const archiveId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/recipes/replica/replica?editId=${encodeURIComponent(archiveId)}`
    });
  },

  onRetry() {
    wx.switchTab({
      url: '/pages/brew/brew'
    });
  },

  onStartBrewTimer(e) {
    const recipe = e && e.detail ? e.detail.recipe : null;
    if (!recipe || !Array.isArray(recipe.stages) || !recipe.stages.length) {
      wx.showToast({
        title: '暂无可用冲煮阶段',
        icon: 'none'
      });
      return;
    }
    wx.setStorageSync(ACTIVE_BREW_TIMER_KEY, this.stripArchiveMeta(recipe));
    wx.navigateTo({
      url: '/pages/brew/timer/timer'
    });
  },

  onRebrewFromArchive(e) {
    if (!requireLogin('登录后可读取方案存档，并继续校准这杯。')) return;
    const archiveId = e.currentTarget.dataset.id;
    const recipe = this.data.recipes.find(item => item.archiveId === archiveId);
    if (!recipe) {
      wx.showToast({
        title: '未找到方案',
        icon: 'none'
      });
      return;
    }
    wx.setStorageSync(REBREW_ARCHIVE_KEY, {
      archiveId,
      fromArchiveRebrew: true
    });
    wx.switchTab({
      url: '/pages/brew/brew'
    });
  },

  onPersonalReplica() {
    if (!requireLogin('登录后可创建个人方案复刻记录。')) return;
    wx.navigateTo({
      url: '/pages/recipes/replica/replica'
    });
  },

  onShareCard(e) {
    const recipe = e.detail && e.detail.recipe;
    return createRecipeShareCard(this, recipe);
  },

  onCloseShareCard() {
    closeRecipeShareCard(this);
  },

  onSaveShareCard() {
    saveRecipeShareCard(this);
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  },

  onGoBrew() {
    wx.switchTab({
      url: '/pages/brew/brew'
    });
  }
});
