const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../utils/auth.js');
const {
  buildBeanViewList,
  formatNumber,
  getStockNumber,
  splitBeansByStock
} = require('../../utils/beans.js');
const {
  buildSharePayload,
  buildTimelinePayload
} = require('../../utils/share-card.js');
const { syncCustomTabBar } = require('../../utils/tabbar.js');

Page({
  data: {
    beans: [],
    archivedBeans: [],
    displayBeans: [],
    displayArchivedBeans: [],
    archivedBeansExpanded: false,
    totalBeanCount: 0,
    totalStockGrams: 0,
    // 试运行豆卡墙；需要撤回时改成 list 即可恢复原列表路径。
    beanDisplayMode: 'grid',
    searchKeyword: '',
    sortField: 'stock',
    sortOrder: 'desc',
    batchMode: false,
    selectedBatchIds: [],
    allVisibleBatchSelected: false
  },

  onShow() {
    syncCustomTabBar(this, 'pages/beans/beans');
    this.loadBeans();
  },

  loadBeans() {
    try {
      const beans = getUserStorageSync('beans', []);
      const selectedBatchIds = this.data.selectedBatchIds || [];
      const enrichedBeans = buildBeanViewList(beans, selectedBatchIds);
      const { activeBeans, finishedBeans } = splitBeansByStock(enrichedBeans);
      const sortedActiveBeans = this.sortBeans(activeBeans);
      const sortedFinishedBeans = this.sortBeans(finishedBeans);
      const totalStockGrams = enrichedBeans.reduce((sum, bean) => {
        const stock = getStockNumber(bean.stockGrams);
        return sum + (stock === null ? 0 : stock);
      }, 0);
      this.setData({
        beans: sortedActiveBeans,
        archivedBeans: sortedFinishedBeans,
        displayBeans: this.filterBeansByKeyword(sortedActiveBeans),
        displayArchivedBeans: this.filterBeansByKeyword(sortedFinishedBeans),
        totalBeanCount: enrichedBeans.length,
        totalStockGrams: formatNumber(totalStockGrams)
      }, () => {
        this.updateVisibleBatchState();
      });
    } catch (e) {
      console.error('加载豆子失败:', e);
    }
  },

  onTapBean(e) {
    const bean = (e.detail && e.detail.bean) || this.findBeanById(e.currentTarget.dataset.id);
    if (!bean) return;
    if (this.data.batchMode) {
      this.toggleBeanSelection(bean.id);
      return;
    }
    if (!requireLogin('登录后可查看和编辑你的咖啡豆详情。')) return;
    wx.navigateTo({
      url: '/pages/beans/edit/edit?id=' + bean.id
    });
  },

  onTapExpiryDot() {
    wx.showToast({
      title: '即将错过最佳赏味期',
      icon: 'none'
    });
  },

  onToggleBatchMode() {
    if (!this.data.batchMode && !requireLogin('登录后可批量管理你的豆仓。')) return;
    const batchMode = !this.data.batchMode;
    this.setData({
      batchMode,
      selectedBatchIds: [],
      beans: this.data.beans.map(bean => ({
        ...bean,
        batchSelected: false
      })),
      archivedBeans: this.data.archivedBeans.map(bean => ({
        ...bean,
        batchSelected: false
      })),
      displayBeans: this.filterBeansByKeyword(this.data.beans.map(bean => ({
        ...bean,
        batchSelected: false
      }))),
      displayArchivedBeans: this.filterBeansByKeyword(this.data.archivedBeans.map(bean => ({
        ...bean,
        batchSelected: false
      }))),
      allVisibleBatchSelected: false
    });
  },

  toggleBeanSelection(id) {
    const selected = new Set(this.data.selectedBatchIds || []);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    const selectedBatchIds = Array.from(selected);
    const beans = this.data.beans.map(bean => ({
      ...bean,
      batchSelected: selected.has(bean.id)
    }));
    const archivedBeans = this.data.archivedBeans.map(bean => ({
      ...bean,
      batchSelected: selected.has(bean.id)
    }));
    this.setData({
      selectedBatchIds,
      beans,
      archivedBeans,
      displayBeans: this.filterBeansByKeyword(beans),
      displayArchivedBeans: this.filterBeansByKeyword(archivedBeans)
    }, () => {
      this.updateVisibleBatchState();
    });
  },

  onToggleSelectAll() {
    const visibleBeans = this.getVisibleBatchBeans();
    if (!visibleBeans.length) return;
    const selected = new Set(this.data.selectedBatchIds || []);
    const allSelected = visibleBeans.every(bean => selected.has(bean.id));
    visibleBeans.forEach(bean => {
      if (allSelected) {
        selected.delete(bean.id);
      } else {
        selected.add(bean.id);
      }
    });
    const selectedBatchIds = Array.from(selected);
    const beans = this.data.beans.map(bean => ({
      ...bean,
      batchSelected: selected.has(bean.id)
    }));
    const archivedBeans = this.data.archivedBeans.map(bean => ({
      ...bean,
      batchSelected: selected.has(bean.id)
    }));
    this.setData({
      selectedBatchIds,
      beans,
      archivedBeans,
      displayBeans: this.filterBeansByKeyword(beans),
      displayArchivedBeans: this.filterBeansByKeyword(archivedBeans)
    }, () => {
      this.updateVisibleBatchState();
    });
  },

  getVisibleBatchBeans() {
    return [
      ...(this.data.displayBeans || []),
      ...(this.data.archivedBeansExpanded ? (this.data.displayArchivedBeans || []) : [])
    ];
  },

  findBeanById(id) {
    return [
      ...(this.data.beans || []),
      ...(this.data.archivedBeans || [])
    ].find(bean => bean.id === id);
  },

  filterBeansByKeyword(beans = [], keyword = this.data.searchKeyword) {
    const query = String(keyword || '').trim().toLowerCase();
    if (!query) return beans;
    return beans.filter(bean => {
      const searchable = [
        bean.name,
        bean.origin,
        bean.regionLot,
        bean.altitude,
        bean.variety,
        bean.roaster,
        bean.processing,
        bean.flavorNotes,
        bean.roastLevelLabel,
        bean.roastAgeLabel,
        bean.stockText,
        bean.stockDisplay
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  },

  onSearchInput(e) {
    const searchKeyword = e.detail.value || '';
    this.setData({
      searchKeyword,
      displayBeans: this.filterBeansByKeyword(this.data.beans, searchKeyword),
      displayArchivedBeans: this.filterBeansByKeyword(this.data.archivedBeans, searchKeyword)
    }, () => {
      this.updateVisibleBatchState();
    });
  },

  onToggleBeanDisplayMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== 'grid' && mode !== 'list') return;
    this.setData({
      beanDisplayMode: mode
    });
  },

  onSelectSortField(e) {
    const sortField = e.currentTarget.dataset.field;
    if (sortField !== 'stock' && sortField !== 'roastAge') return;
    this.applyBeanSort({ sortField });
  },

  onSelectSortOrder(e) {
    const sortOrder = e.currentTarget.dataset.order;
    if (sortOrder !== 'desc' && sortOrder !== 'asc') return;
    this.applyBeanSort({ sortOrder });
  },

  applyBeanSort(next = {}) {
    const sortField = next.sortField || this.data.sortField;
    const sortOrder = next.sortOrder || this.data.sortOrder;
    const beans = this.sortBeans(this.data.beans, sortField, sortOrder);
    const archivedBeans = this.sortBeans(this.data.archivedBeans, sortField, sortOrder);
    this.setData({
      sortField,
      sortOrder,
      beans,
      archivedBeans,
      displayBeans: this.filterBeansByKeyword(beans),
      displayArchivedBeans: this.filterBeansByKeyword(archivedBeans)
    }, () => {
      this.updateVisibleBatchState();
    });
  },

  sortBeans(beans = [], sortField = this.data.sortField, sortOrder = this.data.sortOrder) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...beans].sort((a, b) => {
      const aKnown = this.hasSortValue(a, sortField);
      const bKnown = this.hasSortValue(b, sortField);
      if (aKnown !== bKnown) return aKnown ? -1 : 1;

      const aValue = this.getSortValue(a, sortField);
      const bValue = this.getSortValue(b, sortField);
      if (aValue !== bValue) return (aValue - bValue) * direction;

      const updatedCompare = String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
      if (updatedCompare !== 0) return updatedCompare;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  },

  hasSortValue(bean = {}, sortField = this.data.sortField) {
    if (sortField === 'roastAge') return Number(bean.roastAgeSort) >= 0;
    return getStockNumber(bean.stockSort !== undefined ? bean.stockSort : bean.stockGrams) !== null;
  },

  getSortValue(bean = {}, sortField = this.data.sortField) {
    if (sortField === 'roastAge') return Number(bean.roastAgeSort);
    const stock = getStockNumber(bean.stockSort !== undefined ? bean.stockSort : bean.stockGrams);
    return stock === null ? 0 : stock;
  },

  updateVisibleBatchState() {
    const visibleBeans = this.getVisibleBatchBeans();
    const selected = new Set(this.data.selectedBatchIds || []);
    const allVisibleBatchSelected = visibleBeans.length > 0 && visibleBeans.every(bean => selected.has(bean.id));
    if (this.data.allVisibleBatchSelected !== allVisibleBatchSelected) {
      this.setData({ allVisibleBatchSelected });
    }
  },

  onToggleArchivedBeans() {
    this.setData({
      archivedBeansExpanded: !this.data.archivedBeansExpanded
    }, () => {
      this.updateVisibleBatchState();
    });
  },

  onDeleteSelected() {
    if (!requireLogin('登录后可批量删除你的豆仓记录。')) return;
    const selectedBatchIds = this.data.selectedBatchIds || [];
    if (!selectedBatchIds.length) {
      wx.showToast({
        title: '请先选择豆子',
        icon: 'none'
      });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的 ${selectedBatchIds.length} 款豆子吗？`,
      success: (res) => {
        if (!res.confirm) return;
        const selected = new Set(selectedBatchIds);
        const beans = getUserStorageSync('beans', []).filter(bean => !selected.has(bean.id));
        setUserStorageSync('beans', beans);
        this.setData({
          batchMode: false,
          selectedBatchIds: []
        });
        this.loadBeans();
        wx.showToast({
          title: '已删除',
          icon: 'success'
        });
      }
    });
  },

  onAddBean() {
    if (!requireLogin('登录后可添加咖啡豆到你的豆仓。')) return;
    if (this.data.batchMode) {
      this.onToggleBatchMode();
    }
    wx.navigateTo({
      url: '/pages/beans/edit/edit'
    });
  },

  onQuickAddBean() {
    if (!requireLogin('登录后可使用秒拍入库，并保存到你的豆仓。')) return;
    if (this.data.batchMode) {
      this.onToggleBatchMode();
    }

    wx.navigateTo({
      url: '/pages/beans/edit/edit?quickAdd=1'
    });
  },

  onQrAddBean() {
    if (!requireLogin('登录后可扫描烘焙商二维码，并保存到你的豆仓。')) return;
    if (this.data.batchMode) {
      this.onToggleBatchMode();
    }
    wx.navigateTo({
      url: '/pages/beans/qr-import/qr-import'
    });
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  }
});
