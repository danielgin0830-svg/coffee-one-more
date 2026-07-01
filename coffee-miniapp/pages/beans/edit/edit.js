const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../../utils/auth.js');
const {
  ROAST_LEVEL_OPTIONS,
  getRoastLevelIndex,
  getRoastLevelLabel
} = require('../../../utils/beans.js');
const {
  OCR_DRAFT_STORAGE_KEY,
  formatOcrError,
  recognizeBeanLabelFromImage
} = require('../../../utils/bean-ocr.js');
const {
  buildSharePayload,
  buildTimelinePayload
} = require('../../../utils/share-card.js');

const TARGET_COVER_IMAGE_BYTES = 650 * 1024;
const MAX_COVER_IMAGE_BYTES = 2 * 1024 * 1024;

// 需求②：仅「名称 / 风味描述」支持多候选按点选顺序叠加；日期 / 烘焙度 / 处理法保持单选替换
const APPENDABLE_OCR_FIELDS = {
  name: ' ',
  flavorNotes: '、'
};

Page({
  data: {
    isEdit: false,
    editId: '',
    form: {
      name: '',
      origin: '',
      roaster: '',
      roastDate: '',
      roastLevel: '',
      processing: '',
      flavorNotes: '',
      stockGrams: '',
      altitude: '',
      regionLot: '',
      variety: '',
      coverImage: '',
      coverImageFileID: ''
    },
    moreInfoExpanded: false,
    processingLabel: '',
    roastLevelOptions: ROAST_LEVEL_OPTIONS,
    roastLevelIndex: 0,
    roastLevelLabel: '',
    showQuickAddEntry: false,
    today: '',
    ocrDraftApplied: false,
    ocrMatchedFields: [],
    ocrCandidateGroups: [],
    ocrRawTextPreview: ''
  },

  onLoad(options) {
    options = options || {};
    if (!requireLogin()) return;
    this.setData({ today: this.getToday() });
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id });
      this.loadBean(options.id);
      return;
    }
    if (options.quickAdd === '1') {
      this.setData({ showQuickAddEntry: true });
    }
    if (options.from === 'ocr') {
      this.applyOcrDraft();
    }
  },

  loadBean(id) {
    try {
      const beans = getUserStorageSync('beans', []);
      const bean = beans.find(b => b.id === id);
      if (bean) {
        const nextForm = {
          ...this.data.form,
          ...bean,
          stockGrams: this.normalizeStockInput(bean.stockGrams)
        };
        this.setData({
          form: nextForm,
          moreInfoExpanded: this.hasMoreInfo(nextForm),
          roastLevelIndex: getRoastLevelIndex(bean.roastLevel),
          roastLevelLabel: getRoastLevelLabel(bean.roastLevel),
          processingLabel: this.getProcessingLabel(bean.processing)
        });
      }
    } catch (e) {
      console.error('加载豆子失败:', e);
    }
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    let value = e.detail.value;
    if (field === 'stockGrams') {
      value = this.normalizeStockInput(value);
      this.setData({
        ['form.' + field]: value
      });
      return value;
    }
    this.setData({
      ['form.' + field]: value
    });
  },

  normalizeStockInput(value) {
    const text = String(value === undefined || value === null ? '' : value)
      .replace(/[０-９]/g, char => String(char.charCodeAt(0) - 65248))
      .replace(/[．。]/g, '.')
      .replace(/[，,]/g, '.')
      .replace(/\s+/g, '');
    if (!text) return '';

    const match = text.match(/\d+(?:\.\d+)?/);
    if (!match) return '';

    const number = Number(match[0]);
    if (!Number.isFinite(number)) return '';
    return String(Math.max(0, Math.round(number)));
  },

  normalizeStockForSave(value) {
    const stockGrams = this.normalizeStockInput(value);
    if (stockGrams === '') {
      return {
        valid: false,
        message: '请输入库存克数'
      };
    }
    return {
      valid: true,
      stockGrams
    };
  },

  onToggleMoreInfo() {
    this.setData({
      moreInfoExpanded: !this.data.moreInfoExpanded
    });
  },

  hasMoreInfo(form = {}) {
    return ['origin', 'roaster', 'altitude', 'regionLot', 'variety', 'coverImage', 'coverImageFileID']
      .some(field => String(form[field] || '').trim() !== '');
  },

  onDateChange(e) {
    this.setData({
      'form.roastDate': e.detail.value
    });
  },

  onRoastLevelChange(e) {
    const index = Number(e.detail.value);
    const option = this.data.roastLevelOptions[index];
    if (!option) return;
    this.setData({
      'form.roastLevel': option.id,
      roastLevelIndex: index,
      roastLevelLabel: option.label
    });
  },

  onPickProcessing() {
    wx.showActionSheet({
      itemList: ['水洗 (Washed)', '日晒 (Natural)', '蜜处理 (Honey)', '其他'],
      success: (res) => {
        const map = ['washed', 'natural', 'honey', 'other'];
        const processing = map[res.tapIndex];
        this.setData({
          'form.processing': processing,
          processingLabel: this.getProcessingLabel(processing)
        });
      }
    });
  },

  async onChooseCoverImage() {
    if (!requireLogin('登录后可上传豆子封面图。')) return;

    const app = getApp();
    if (!wx.cloud || !(app.globalData && app.globalData.cloudReady)) {
      wx.showModal({
        title: '暂不能上传',
        content: '豆子封面图需要云开发存储。请确认云开发已开启后再试。',
        showCancel: false
      });
      return;
    }

    try {
      const tempFilePath = await this.chooseCoverImage();
      const imagePath = await this.compressCoverImage(tempFilePath);
      wx.showLoading({
        title: '上传中',
        mask: true
      });
      const uploadResult = await this.uploadCoverImage(imagePath);
      const fileID = uploadResult.fileID;
      this.setData({
        'form.coverImage': fileID,
        'form.coverImageFileID': fileID
      });
      wx.showToast({
        title: '封面已上传',
        icon: 'success'
      });
    } catch (e) {
      const message = String((e && e.errMsg) || (e && e.message) || '');
      if (message.indexOf('cancel') >= 0) return;
      wx.showModal({
        title: '上传失败',
        content: message || '请重新选择图片后再试。',
        showCancel: false
      });
    } finally {
      wx.hideLoading();
    }
  },

  onRemoveCoverImage() {
    this.setData({
      'form.coverImage': '',
      'form.coverImageFileID': ''
    });
  },

  chooseCoverImage() {
    return new Promise((resolve, reject) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
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
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
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

  async compressCoverImage(filePath) {
    if (!wx.compressImage) {
      await this.ensureCoverImageSize(filePath);
      return filePath;
    }

    if (!wx.getFileInfo) {
      const compressedPath = await this.compressCoverImageOnce(filePath, 60).catch(() => filePath);
      await this.ensureCoverImageSize(compressedPath);
      return compressedPath;
    }

    const candidates = [];
    const originalSize = await this.getCoverImageSize(filePath).catch(() => MAX_COVER_IMAGE_BYTES + 1);
    candidates.push({ path: filePath, size: originalSize });

    let sourcePath = filePath;
    const qualities = [78, 60, 45, 32];
    for (let i = 0; i < qualities.length; i += 1) {
      try {
        const compressedPath = await this.compressCoverImageOnce(sourcePath, qualities[i]);
        const size = await this.getCoverImageSize(compressedPath);
        candidates.push({ path: compressedPath, size });
        sourcePath = compressedPath;
        if (size <= TARGET_COVER_IMAGE_BYTES) break;
      } catch (e) {
        // 单档压缩失败不阻断，继续尝试已有候选。
      }
    }

    const validCandidates = candidates
      .filter(item => item.path && Number.isFinite(item.size))
      .sort((a, b) => a.size - b.size);
    const best = validCandidates.find(item => item.size <= MAX_COVER_IMAGE_BYTES) || validCandidates[0];
    if (!best) {
      await this.ensureCoverImageSize(filePath);
      return filePath;
    }

    await this.ensureCoverImageSize(best.path);
    return best.path;
  },

  compressCoverImageOnce(filePath, quality) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: filePath,
        quality,
        success: (res) => {
          resolve(res.tempFilePath || filePath);
        },
        fail: reject
      });
    });
  },

  getCoverImageSize(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath,
        success: (res) => resolve(Number(res.size || 0)),
        fail: reject
      });
    });
  },

  ensureCoverImageSize(filePath) {
    return new Promise((resolve, reject) => {
      if (!wx.getFileInfo) {
        resolve();
        return;
      }
      wx.getFileInfo({
        filePath,
        success: (res) => {
          if (res.size > MAX_COVER_IMAGE_BYTES) {
            reject(new Error('图片超过2MB，请裁剪或压缩后再上传。'));
            return;
          }
          resolve();
        },
        fail: reject
      });
    });
  },

  uploadCoverImage(filePath) {
    const extensionMatch = String(filePath).match(/\.(jpg|jpeg|png|webp)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
    const random = Math.random().toString(36).slice(2, 8);
    const cloudPath = `bean-covers/${Date.now()}-${random}.${extension}`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  getProcessingLabel(processing) {
    const labels = {
      washed: '水洗',
      natural: '日晒',
      honey: '蜜处理',
      other: '其他'
    };
    return labels[processing] || processing || '';
  },

  async startQuickAdd() {
    const app = getApp();
    if (!wx.cloud || !(app.globalData && app.globalData.cloudReady)) {
      wx.showModal({
        title: '暂不能秒拍入库',
        content: '当前环境暂时无法使用图片识别，请先手动填写豆子信息。',
        showCancel: false
      });
      return;
    }

    try {
      const payload = await recognizeBeanLabelFromImage('秒拍入库');
      wx.setStorageSync(OCR_DRAFT_STORAGE_KEY, payload);
      this.applyOcrDraft();
    } catch (e) {
      const message = String((e && e.errMsg) || (e && e.message) || '');
      if (message.indexOf('cancel') >= 0) return;
      if (/图片超过[12]MB/.test(message)) {
        wx.showModal({
          title: '图片太大',
          content: message,
          showCancel: false
        });
        return;
      }
      console.error('秒拍入库识别异常:', e);
      wx.showModal({
        title: '识别暂不可用',
        content: `${formatOcrError(e)}\n\n你也可以先手动填写豆子信息，保存功能不受影响。`,
        showCancel: false
      });
    }
  },

  applyOcrDraft() {
    let payload = null;
    try {
      payload = wx.getStorageSync(OCR_DRAFT_STORAGE_KEY);
      wx.removeStorageSync(OCR_DRAFT_STORAGE_KEY);
    } catch (e) {
      payload = null;
    }

    if (!payload || !payload.draft) return;

    const draft = payload.draft || {};
    const candidates = payload.candidates || {};
    const nextForm = { ...this.data.form };
    const fields = ['name', 'origin', 'roaster', 'roastDate', 'roastLevel', 'processing', 'flavorNotes', 'stockGrams', 'altitude', 'regionLot', 'variety'];
    fields.forEach(field => {
      const value = draft[field];
      if (value === undefined || value === null || String(value).trim() === '') return;
      nextForm[field] = field === 'stockGrams' ? this.normalizeStockInput(value) : String(value).trim();
    });

    const matchedFields = this.getOcrMatchedFields(draft);
    this.setData({
      form: nextForm,
      moreInfoExpanded: this.hasMoreInfo(nextForm),
      processingLabel: this.getProcessingLabel(nextForm.processing),
      roastLevelIndex: getRoastLevelIndex(nextForm.roastLevel),
      roastLevelLabel: getRoastLevelLabel(nextForm.roastLevel),
      ocrDraftApplied: true,
      ocrMatchedFields: matchedFields,
      ocrCandidateGroups: this.buildOcrCandidateGroups(candidates, nextForm),
      ocrRawTextPreview: this.buildOcrTextPreview(payload.rawText)
    });

    wx.showToast({
      title: matchedFields.length ? '已预填信息' : '请手动补全',
      icon: 'none'
    });
  },

  buildOcrCandidateGroups(candidates = {}, form = {}) {
    const labels = {
      name: '商品名',
      roastDate: '烘焙/生产日期',
      roastLevel: '烘焙度',
      processing: '处理法',
      flavorNotes: '风味描述'
    };
    const fields = ['name', 'roastDate', 'roastLevel', 'processing', 'flavorNotes'];
    return fields
      .map(field => {
        const currentValue = String(form[field] || '').trim();
        const items = (candidates[field] || [])
          .filter(item => item && item.value !== undefined && item.value !== null)
          .filter(item => Number(item.confidence || 0) < 0.8 || String(item.value).trim() !== currentValue)
          .map(item => ({
            value: String(item.value || '').trim(),
            displayValue: String(item.displayValue || item.label || item.value || '').trim(),
            confidence: Number(item.confidence || 0),
            confidenceText: this.formatConfidence(item.confidence),
            source: item.source || ''
          }))
          .filter(item => item.value && item.displayValue);
        if (!items.length) return null;
        return {
          field,
          label: labels[field],
          items
        };
      })
      .filter(Boolean);
  },

  formatConfidence(confidence) {
    const value = Number(confidence);
    if (!Number.isFinite(value)) return '';
    return `${Math.round(value * 100)}%`;
  },

  // 需求②：名称 / 风味描述按点选顺序叠加（去重）；日期 / 烘焙度 / 处理法保持单选替换
  onApplyOcrCandidate(e) {
    const { field, value } = e.currentTarget.dataset;
    if (!field || value === undefined) return;

    const nextData = {};
    const separator = APPENDABLE_OCR_FIELDS[field];
    if (separator !== undefined) {
      nextData['form.' + field] = this.appendCandidateValue(this.data.form[field], value, separator);
    } else {
      nextData['form.' + field] = String(value);
      if (field === 'processing') {
        nextData.processingLabel = this.getProcessingLabel(value);
      }
      if (field === 'roastLevel') {
        nextData.roastLevelIndex = getRoastLevelIndex(value);
        nextData.roastLevelLabel = getRoastLevelLabel(value);
      }
    }

    this.setData({
      ...nextData,
      ocrCandidateGroups: this.removeOcrCandidate(field, value)
    });
  },

  // 把候选值按分隔符追加到已填内容末尾；已存在的片段不重复追加，便于用户按需叠加后再编辑
  appendCandidateValue(current, value, separator) {
    const incoming = String(value === undefined || value === null ? '' : value).trim();
    const existing = String(current === undefined || current === null ? '' : current).trim();
    if (!incoming) return existing;
    const parts = existing ? existing.split(separator).map(item => item.trim()).filter(Boolean) : [];
    if (parts.includes(incoming)) return existing;
    parts.push(incoming);
    return parts.join(separator);
  },

  removeOcrCandidate(field, value) {
    return (this.data.ocrCandidateGroups || [])
      .map(group => {
        if (group.field !== field) return group;
        return {
          ...group,
          items: group.items.filter(item => String(item.value) !== String(value))
        };
      })
      .filter(group => group.items.length);
  },

  getOcrMatchedFields(draft = {}) {
    const labels = {
      name: '商品名',
      origin: '产地',
      roaster: '烘焙商',
      altitude: '海拔',
      regionLot: '产区/地块',
      variety: '豆种',
      roastDate: '烘焙日期',
      roastLevel: '烘焙度',
      processing: '处理法',
      flavorNotes: '风味',
      stockGrams: '库存'
    };
    return Object.keys(labels)
      .filter(field => draft[field] !== undefined && draft[field] !== null && String(draft[field]).trim() !== '')
      .map(field => ({
        field,
        label: labels[field]
      }));
  },

  buildOcrTextPreview(rawText) {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > 220 ? `${text.slice(0, 220)}...` : text;
  },

  onSave() {
    if (!requireLogin('登录后可保存你的咖啡豆信息。')) return;
    const { form, isEdit, editId } = this.data;

    if (!form.name || !form.name.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    if (!form.roastDate) {
      wx.showToast({ title: '请选择烘焙日期', icon: 'none' });
      return;
    }
    if (!form.roastLevel) {
      wx.showToast({ title: '请选择烘焙度', icon: 'none' });
      return;
    }
    if (!form.processing) {
      wx.showToast({ title: '请选择处理法', icon: 'none' });
      return;
    }
    if (!form.flavorNotes || !form.flavorNotes.trim()) {
      wx.showToast({ title: '请输入风味描述', icon: 'none' });
      return;
    }
    const stockResult = this.normalizeStockForSave(form.stockGrams);
    if (!stockResult.valid) {
      wx.showToast({ title: stockResult.message, icon: 'none' });
      return;
    }
    const normalizedForm = {
      ...form,
      stockGrams: stockResult.stockGrams
    };

    try {
      const beans = getUserStorageSync('beans', []);
      const now = new Date().toISOString();

      if (isEdit) {
        const idx = beans.findIndex(b => b.id === editId);
        if (idx >= 0) {
          beans[idx] = {
            ...beans[idx],
            ...normalizedForm,
            updatedAt: now
          };
        }
      } else {
        beans.unshift({
          ...normalizedForm,
          id: Date.now().toString(),
          tags: [normalizedForm.processing].filter(Boolean),
          createdAt: now,
          updatedAt: now
        });
      }

      setUserStorageSync('beans', beans);
      wx.showToast({ title: isEdit ? '已保存' : '已添加', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onDelete() {
    if (!requireLogin('登录后可删除你的咖啡豆信息。')) return;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: (res) => {
        if (res.confirm) {
          const beans = getUserStorageSync('beans', []);
          const updated = beans.filter(b => b.id !== this.data.editId);
          setUserStorageSync('beans', updated);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        }
      }
    });
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  }
});
