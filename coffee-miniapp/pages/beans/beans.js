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

const OCR_DRAFT_STORAGE_KEY = 'beanOcrDraft';
const MAX_OCR_IMAGE_BYTES = 2 * 1024 * 1024;

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

  async onQuickAddBean() {
    if (!requireLogin('登录后可使用秒拍入库，并保存到你的豆仓。')) return;
    if (this.data.batchMode) {
      this.onToggleBatchMode();
    }

    const app = getApp();
    if (!wx.cloud || !(app.globalData && app.globalData.cloudReady)) {
      wx.showToast({
        title: '云开发未就绪',
        icon: 'none'
      });
      return;
    }

    try {
      const tempFilePath = await this.chooseBeanLabelImage();
      const imagePath = await this.compressOcrImage(tempFilePath);
      await this.recognizeBeanLabel(imagePath);
    } catch (e) {
      const message = String((e && e.errMsg) || (e && e.message) || '');
      if (message.indexOf('cancel') >= 0) return;
      if (e && e.ocrHandled) return;
      if (/图片超过[12]MB/.test(message)) {
        wx.showModal({
          title: '图片太大',
          content: message,
          showCancel: false
        });
        return;
      }
      wx.showToast({
        title: '识别失败，请重试',
        icon: 'none'
      });
    }
  },

  chooseBeanLabelImage() {
    return new Promise((resolve, reject) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera', 'album'],
          sizeType: ['original'],
          success: (res) => {
            const file = res.tempFiles && res.tempFiles[0];
            if (file && file.tempFilePath) {
              resolve(file.tempFilePath);
            } else {
              reject(new Error('没有选择图片'));
            }
          },
          fail: reject
        });
        return;
      }

      wx.chooseImage({
        count: 1,
        sizeType: ['original'],
        sourceType: ['camera', 'album'],
        success: (res) => {
          const filePath = res.tempFilePaths && res.tempFilePaths[0];
          if (filePath) {
            resolve(filePath);
          } else {
            reject(new Error('没有选择图片'));
          }
        },
        fail: reject
      });
    });
  },

  compressOcrImage(filePath) {
    return new Promise((resolve, reject) => {
      if (!wx.compressImage) {
        this.ensureOcrImageSize(filePath).then(() => resolve(filePath)).catch(reject);
        return;
      }

      wx.compressImage({
        src: filePath,
        quality: 82,
        success: (res) => {
          const compressedPath = res.tempFilePath || filePath;
          this.ensureOcrImageSize(compressedPath)
            .then(() => resolve(compressedPath))
            .catch(() => this.ensureOcrImageSize(filePath).then(() => resolve(filePath)).catch(reject));
        },
        fail: () => {
          this.ensureOcrImageSize(filePath).then(() => resolve(filePath)).catch(reject);
        }
      });
    });
  },

  ensureOcrImageSize(filePath) {
    return new Promise((resolve, reject) => {
      if (!wx.getFileInfo) {
        resolve();
        return;
      }
      wx.getFileInfo({
        filePath,
        success: (res) => {
          if (res.size > MAX_OCR_IMAGE_BYTES) {
            reject(new Error('图片超过2MB，请靠近包装文字重新拍摄或裁剪后重试'));
            return;
          }
          resolve();
        },
        fail: reject
      });
    });
  },

  async recognizeBeanLabel(tempFilePath) {
    let fileID = '';
    wx.showLoading({
      title: '识别中',
      mask: true
    });

    try {
      const uploadResult = await this.uploadTempOcrImage(tempFilePath);
      fileID = uploadResult.fileID;

      const res = await wx.cloud.callFunction({
        name: 'ocrBeanLabel',
        data: {
          fileID
        }
      });
      const result = res && res.result;
      if (!result || !result.ok) {
        const error = new Error((result && result.message) || 'OCR识别失败');
        if (result && result.code) {
          error.ocrCode = result.code;
        }
        throw error;
      }

      wx.setStorageSync(OCR_DRAFT_STORAGE_KEY, {
        source: '秒拍入库',
        draft: result.draft || {},
        candidates: result.candidates || {},
        rawText: result.rawText || '',
        provider: result.provider || '',
        createdAt: Date.now()
      });
      wx.navigateTo({
        url: '/pages/beans/edit/edit?from=ocr'
      });
    } catch (e) {
      const detail = this.formatOcrError(e);
      wx.showModal({
        title: '秒拍入库失败',
        content: detail,
        showCancel: false
      });
      if (e && typeof e === 'object') {
        e.ocrHandled = true;
      }
      throw e;
    } finally {
      wx.hideLoading();
      if (fileID) {
        this.deleteTempOcrImage(fileID);
      }
    }
  },

  uploadTempOcrImage(tempFilePath) {
    const extensionMatch = String(tempFilePath).match(/\.(jpg|jpeg|png|webp)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
    const random = Math.random().toString(36).slice(2, 8);
    const cloudPath = `ocr-beans/${Date.now()}-${random}.${extension}`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: resolve,
        fail: reject
      });
    });
  },

  deleteTempOcrImage(fileID) {
    wx.cloud.deleteFile({
      fileList: [fileID],
      fail: () => {}
    });
  },

  formatOcrError(e) {
    const rawMessage = String((e && e.message) || (e && e.errMsg) || '').trim();
    const rawCode = String((e && (e.errCode || e.code)) || '');
    if (rawCode === '-504003' || /timed out|timeout/i.test(rawMessage)) {
      return '秒拍入库识别超时。请确认云函数 ocrBeanLabel 已重新上传部署，并将超时时间设置为20秒；也可以裁剪图片后重试。';
    }
    if (e && e.ocrCode === 'OCR_MARKET_QUOTA_NOT_ENOUGH') {
      return '微信 OCR 服务额度不足或未开通。请在微信开发者工具：云开发 -> 更多 -> 服务市场，搜索 OCR，领取/购买通用印刷体识别额度后重试。';
    }
    if (e && e.ocrCode === 'OCR_PERMISSION_ERROR') {
      return '微信 OCR 调用权限异常。请确认云函数已重新部署，并且 OCR 服务已在当前小程序环境开通。';
    }
    if (e && e.ocrCode === 'BAIDU_OCR_KEY_MISSING') {
      return '百度 OCR 未启用。请在云函数环境变量中配置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY 后重新部署。';
    }
    if (e && e.ocrCode === 'BAIDU_OCR_AUTH_ERROR') {
      return '百度 OCR 鉴权失败。请检查云函数环境变量 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY。';
    }
    if (e && e.ocrCode === 'BAIDU_OCR_QUOTA_LIMIT') {
      return '百度 OCR 额度或频率受限。请稍后重试，或检查百度智能云 OCR 免费额度。';
    }
    if (e && e.ocrCode === 'BAIDU_OCR_IMAGE_ERROR') {
      return '百度 OCR 无法处理这张图片。请裁剪包装文字区域后重试。';
    }
    if (e && e.ocrCode === 'BAIDU_OCR_TIMEOUT') {
      return '百度 OCR 响应超时。请稍后重试，或裁剪包装文字区域后重试。';
    }
    if (e && e.ocrCode === 'OCR_SPACE_API_KEY_MISSING') {
      return '备用 OCR 未启用。请在云函数环境变量中配置 OCR_SPACE_API_KEY 后重新部署。';
    }
    if (e && e.ocrCode === 'OCR_SPACE_API_KEY_INVALID') {
      return '备用 OCR API Key 无效。请检查云函数环境变量 OCR_SPACE_API_KEY。';
    }
    if (e && e.ocrCode === 'OCR_SPACE_IMAGE_TOO_LARGE') {
      return '备用 OCR 免费额度要求图片小于1MB，请靠近包装文字重新拍摄或裁剪后重试。';
    }
    if (e && e.ocrCode === 'OCR_SPACE_TIMEOUT') {
      return '备用 OCR 响应超时，请稍后重试。';
    }
    if (e && e.ocrCode === 'OCR_SPACE_QUOTA_LIMIT') {
      return '备用 OCR 额度或频率受限，请稍后重试或更换 OCR.space API Key。';
    }
    const message = rawMessage;
    if (!message) return '图片没有识别出可用信息，可重新拍摄或手动添加。';
    if (message.length > 90) {
      return `${message.slice(0, 90)}...`;
    }
    return message;
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  }
});
