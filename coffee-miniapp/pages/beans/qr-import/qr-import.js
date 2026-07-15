const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../../utils/auth.js');
const {
  buildBeanFromDecoded,
  buildPreview,
  getApiBaseUrl,
  getShortBatchApiUrl,
  requestCoffeeQrApi,
  requestCoffeeQrUrl
} = require('../../../utils/coffee-qr-mvp.js');

Page({
  data: {
    loading: false,
    hasPreview: false,
    preview: null,
    decoded: null,
    apiBaseUrl: ''
  },

  onLoad() {
    if (!requireLogin('登录后可扫描烘焙商二维码，并保存到你的豆仓。')) return;
    this.setData({ apiBaseUrl: getApiBaseUrl() });
  },

  onScanCode() {
    if (this.data.loading) return;
    wx.scanCode({
      scanType: ['qrCode'],
      success: (res) => this.decodeQrText(res.result),
      fail: (error) => {
        if (String(error.errMsg || '').includes('cancel')) return;
        wx.showToast({ title: '没有识别到二维码', icon: 'none' });
      }
    });
  },

  async onLoadLatest() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const latest = await requestCoffeeQrApi('/api/latest');
      await this.decodeQrText(latest.qrText, false);
    } catch (error) {
      this.showServiceError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async decodeQrText(qrText, manageLoading = true) {
    const shortBatchApiUrl = getShortBatchApiUrl(qrText);
    if (!String(qrText || '').startsWith('COF1:') && !shortBatchApiUrl) {
      wx.showToast({ title: '不是支持的咖啡豆二维码', icon: 'none' });
      return;
    }
    if (manageLoading) this.setData({ loading: true });
    try {
      const decoded = shortBatchApiUrl
        ? await requestCoffeeQrUrl(shortBatchApiUrl)
        : await requestCoffeeQrApi('/api/decode', {
          method: 'POST',
          data: { qrText }
        });
      this.setData({
        hasPreview: true,
        decoded,
        preview: buildPreview(decoded)
      });
    } catch (error) {
      this.showServiceError(error);
    } finally {
      if (manageLoading) this.setData({ loading: false });
    }
  },

  onClearPreview() {
    this.setData({ hasPreview: false, preview: null, decoded: null });
  },

  onConfirmImport() {
    const decoded = this.data.decoded;
    const preview = this.data.preview;
    if (!decoded || !preview || !preview.canImport) {
      wx.showToast({ title: '该二维码不能自动入库', icon: 'none' });
      return;
    }

    const bean = buildBeanFromDecoded(decoded);
    const beans = getUserStorageSync('beans', []);
    const duplicate = beans.find(item => (
      item.qrIssuerId === bean.qrIssuerId
      && item.qrBatchId === bean.qrBatchId
    ));

    if (duplicate) {
      if (duplicate.qrPayloadHash === bean.qrPayloadHash) {
        wx.showModal({
          title: '该批次已入库',
          content: duplicate.name || bean.name,
          showCancel: false
        });
      } else {
        wx.showModal({
          title: '批次信息存在冲突',
          content: '同一发行方和批次编号对应了不同内容，已停止自动入库。',
          showCancel: false
        });
      }
      return;
    }

    beans.unshift(bean);
    setUserStorageSync('beans', beans);
    wx.showToast({ title: '已加入豆仓', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 900);
  },

  showServiceError(error) {
    wx.showModal({
      title: '本地发行服务未连接',
      content: `${error.message || '请求失败'}\n${this.data.apiBaseUrl || getApiBaseUrl()}`,
      showCancel: false
    });
  }
});
