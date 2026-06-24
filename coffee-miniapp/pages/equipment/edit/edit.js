const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../../utils/auth.js');
const {
  buildSharePayload,
  buildTimelinePayload
} = require('../../../utils/share-card.js');

Page({
  data: {
    type: 'cup',
    title: '添加滤杯',
    modelPlaceholder: '例如：Orea Baby-O',
    brandPlaceholder: '例如：Orea',
    form: {
      model: '',
      brand: '',
      isDefault: false
    }
  },

  onLoad(options) {
    if (!requireLogin()) return;
    if (options.type) {
      this.setData({ type: options.type });
    }
    this.updateTypeMeta(options.type || this.data.type);
  },

  updateTypeMeta(type) {
    const meta = {
      cup: {
        title: '添加滤杯',
        modelPlaceholder: '例如：Hario V60 02',
        brandPlaceholder: '例如：Hario'
      },
      paper: {
        title: '添加滤纸',
        modelPlaceholder: '例如：CAFEC T-90',
        brandPlaceholder: '例如：CAFEC'
      },
      grinder: {
        title: '添加磨豆机',
        modelPlaceholder: '例如：Comandante C40 MK4',
        brandPlaceholder: '例如：Comandante'
      }
    }[type] || {
      title: '添加设备',
      modelPlaceholder: '例如：设备型号',
      brandPlaceholder: '例如：品牌'
    };
    this.setData(meta);
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      ['form.' + field]: value
    });
  },

  onSwitchDefault(e) {
    this.setData({
      'form.isDefault': e.detail.value
    });
  },

  onSave() {
    if (!requireLogin('登录后可保存你的设备信息。')) return;
    const { form, type } = this.data;

    if (!form.model || !form.model.trim()) {
      wx.showToast({ title: '请输入型号', icon: 'none' });
      return;
    }

    try {
      const equipments = getUserStorageSync('equipment', []);
      const id = Date.now().toString();

      if (form.isDefault) {
        equipments.forEach(eq => {
          if (eq.type === type) eq.isDefault = false;
        });
      }

      equipments.unshift({
        ...form,
        id,
        type,
        createdAt: new Date().toISOString()
      });

      setUserStorageSync('equipment', equipments);
      if (form.isDefault) {
        setUserStorageSync('equipmentDefaults', {
          ...getUserStorageSync('equipmentDefaults', {}),
          [type]: id
        });
      }
      wx.showToast({ title: '已添加', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  }
});
