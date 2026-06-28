const {
  getUserStorageSync,
  requireLogin,
  setUserStorageSync
} = require('../../../utils/auth.js');
const {
  buildSharePayload,
  buildTimelinePayload
} = require('../../../utils/share-card.js');

// 需求⑤：用户添加滤杯时主动选择分类，冲煮方案据此联动，不再靠名称猜测
// brewCupId 为空表示该类型暂不参与当前手冲方案（浸泡式 / 混合型）
const CUP_CATEGORY_OPTIONS = [
  { id: 'regular_cone', label: '常规锥形（V60 类）', brewCupId: 'regular_cone' },
  { id: 'low_bypass_cone', label: '低旁通锥形（Hario 无限类）', brewCupId: 'low_bypass_cone' },
  { id: 'regular_flat', label: '常规平底（Kalita 蛋糕杯 / 泰摩 B75 类）', brewCupId: 'regular_flat' },
  { id: 'low_bypass_flat', label: '低旁通平底（Orea / SD1R / SOLO 类）', brewCupId: 'low_bypass_flat' },
  { id: 'immersion', label: '浸泡式（聪明杯 / 法压，暂不参与手冲方案）', brewCupId: '' },
  { id: 'mixed', label: '其他 / 混合型（暂不参与手冲方案）', brewCupId: '' }
];

Page({
  data: {
    type: 'cup',
    title: '添加滤杯',
    modelPlaceholder: '例如：Orea Baby-O',
    brandPlaceholder: '例如：Orea',
    cupCategoryOptions: CUP_CATEGORY_OPTIONS,
    cupCategoryIndex: 0,
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

  onCupCategoryChange(e) {
    this.setData({ cupCategoryIndex: Number(e.detail.value) || 0 });
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

      const extra = {};
      if (type === 'cup') {
        const category = CUP_CATEGORY_OPTIONS[this.data.cupCategoryIndex] || CUP_CATEGORY_OPTIONS[0];
        extra.category = category.id;
        extra.brewCupId = category.brewCupId;
      }

      equipments.unshift({
        ...form,
        ...extra,
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
