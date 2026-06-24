const {
  getCurrentUser,
  getUserStorageSync,
  logout,
  requireLogin,
  setUserStorageSync
} = require('../../utils/auth.js');
const {
  buildSharePayload,
  buildTimelinePayload
} = require('../../utils/share-card.js');
const { syncCustomTabBar } = require('../../utils/tabbar.js');
const {
  PRESET_EQUIPMENTS
} = require('../../utils/equipment-presets.js');

const TAB_LABELS = {
  cup: '滤杯',
  paper: '滤纸',
  grinder: '磨豆机'
};

const COMMON_PRESET_IDS = {
  cup: [
    'preset-cup-hario-v60',
    'preset-cup-hario-mugen',
    'preset-cup-kalita-wave',
    'preset-cup-orea-v4'
  ],
  paper: [
    'preset-paper-cafec-t90',
    'preset-paper-kalita-wave',
    'preset-paper-hario-fast'
  ],
  grinder: [
    'preset-grinder-comandante-c40',
    'preset-grinder-1zpresso-zp6',
    'preset-grinder-timemore-c2',
    'preset-grinder-kingrinder-k6'
  ]
};

const EQUIPMENT_GROUP_LABELS = {
  default: '默认设备',
  common: '近期常用',
  custom: '手动添加',
  shown: '手动显示',
  hidden: '已隐藏',
  other: '其他预设'
};

const HIDDEN_EQUIPMENT_KEY = 'equipmentHiddenIds';
const SHOWN_EQUIPMENT_KEY = 'equipmentShownIds';

const SEARCH_PLACEHOLDERS = {
  cup: '搜索滤杯：V60 / Orea / SD1R / Pulsar',
  paper: '搜索滤纸：T-90 / Wave / Chemex',
  grinder: '搜索磨豆机：C40 / ZP6 / DF54 / Niche'
};

const LIBRARY_SUMMARIES = {
  cup: '覆盖旁通锥形、旁通平底、低旁通锥形、低旁通平底、浸泡式和混合型。',
  paper: '按低速、中速、高速滤纸归类，用于冲煮方案联动。',
  grinder: '覆盖常见手磨、家用电磨和单剂量电磨，用于研磨度刻度显示。'
};

function withGroup(item, group) {
  return {
    ...item,
    group,
    groupLabel: EQUIPMENT_GROUP_LABELS[group] || '',
    hiddenByUser: group === 'hidden'
  };
}

function normalizeHiddenMap(hiddenMap = {}) {
  return ['cup', 'paper', 'grinder'].reduce((result, type) => {
    result[type] = Array.from(new Set(Array.isArray(hiddenMap[type]) ? hiddenMap[type] : []));
    return result;
  }, {});
}

function updateHiddenMap(hiddenMap, type, id, shouldHide) {
  const next = normalizeHiddenMap(hiddenMap);
  const ids = new Set(next[type] || []);
  if (shouldHide) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  next[type] = Array.from(ids);
  return next;
}

Page({
  data: {
    activeTab: 'cup',
    equipments: [],
    currentEquipments: [],
    hiddenEquipments: [],
    showHiddenEquipments: false,
    hiddenEquipmentMap: {},
    shownEquipmentMap: {},
    defaultMap: {},
    currentUser: null,
    searchKeyword: '',
    hasSearchKeyword: false,
    activeTabLabel: TAB_LABELS.cup,
    searchPlaceholder: SEARCH_PLACEHOLDERS.cup,
    librarySummary: LIBRARY_SUMMARIES.cup,
    activeEquipmentCount: 0,
    searchResultCount: 0,
    currentSectionDesc: '默认设备 / 近期常用 / 手动添加'
  },

  onShow() {
    syncCustomTabBar(this, 'pages/equipment/equipment');
    this.setData({ currentUser: this.formatCurrentUser(getCurrentUser()) });
    this.loadEquipments();
  },

  formatCurrentUser(user) {
    if (!user || !user.id) return null;
    const displayName = String(user.nickName || '微信用户').trim() || '微信用户';
    return {
      ...user,
      displayName,
      avatarText: displayName.slice(0, 1)
    };
  },

  loadEquipments() {
    try {
      const customEquipments = getUserStorageSync('equipment', []).filter(e => !e.preset);
      const defaultMap = getUserStorageSync('equipmentDefaults', {});
      const hiddenEquipmentMap = normalizeHiddenMap(getUserStorageSync(HIDDEN_EQUIPMENT_KEY, {}));
      const shownEquipmentMap = normalizeHiddenMap(getUserStorageSync(SHOWN_EQUIPMENT_KEY, {}));
      const equipments = [...PRESET_EQUIPMENTS, ...customEquipments].map(e => ({
        ...e,
        isDefault: defaultMap[e.type] ? defaultMap[e.type] === e.id : !!e.isDefault
      }));
      this.setData({ equipments, defaultMap, hiddenEquipmentMap, shownEquipmentMap });
      this.filterEquipments();
    } catch (e) {
      console.error('加载设备失败:', e);
    }
  },

  filterEquipments() {
    const { equipments, activeTab, hiddenEquipmentMap, shownEquipmentMap, searchKeyword } = this.data;
    const keyword = this.normalizeSearchKeyword(searchKeyword);
    const allCurrent = equipments.filter(e => e.type === activeTab);
    const current = keyword
      ? allCurrent.filter(e => this.matchesEquipmentSearch(e, keyword))
      : allCurrent;
    const commonIds = COMMON_PRESET_IDS[activeTab] || [];
    const hiddenIds = new Set(hiddenEquipmentMap[activeTab] || []);
    const shownIds = new Set(shownEquipmentMap[activeTab] || []);
    const defaultItems = current
      .filter(e => e.isDefault && !hiddenIds.has(e.id))
      .map(e => withGroup(e, 'default'));
    const commonItems = commonIds
      .map(id => current.find(e => e.id === id && !e.isDefault && !hiddenIds.has(e.id)))
      .filter(Boolean)
      .map(e => withGroup(e, 'common'));
    const customItems = current
      .filter(e => !e.preset && !e.isDefault && !hiddenIds.has(e.id))
      .map(e => withGroup(e, 'custom'));
    const visibleIds = new Set([
      ...defaultItems.map(e => e.id),
      ...commonItems.map(e => e.id),
      ...customItems.map(e => e.id)
    ]);
    const shownItems = current
      .filter(e => e.preset && shownIds.has(e.id) && !hiddenIds.has(e.id) && !visibleIds.has(e.id))
      .map(e => withGroup(e, 'shown'));
    shownItems.forEach(e => visibleIds.add(e.id));
    const userHiddenItems = current
      .filter(e => hiddenIds.has(e.id))
      .map(e => withGroup(e, 'hidden'));
    const otherPresetItems = current
      .filter(e => e.preset && !visibleIds.has(e.id) && !hiddenIds.has(e.id))
      .map(e => withGroup(e, 'other'));

    this.setData({
      currentEquipments: [...defaultItems, ...commonItems, ...customItems, ...shownItems],
      hiddenEquipments: [...userHiddenItems, ...otherPresetItems],
      hasSearchKeyword: !!keyword,
      activeEquipmentCount: allCurrent.length,
      searchResultCount: current.length,
      activeTabLabel: this.getTabLabel(activeTab),
      searchPlaceholder: SEARCH_PLACEHOLDERS[activeTab] || '搜索设备',
      librarySummary: LIBRARY_SUMMARIES[activeTab] || '',
      currentSectionDesc: keyword
        ? `找到 ${current.length} 个${this.getTabLabel(activeTab)}`
        : '默认设备 / 近期常用 / 手动添加'
    });
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab, searchKeyword: '', showHiddenEquipments: false }, () => {
      this.filterEquipments();
    });
  },

  onEquipmentSearchInput(e) {
    const searchKeyword = e.detail.value || '';
    const hasKeyword = !!this.normalizeSearchKeyword(searchKeyword);
    this.setData({
      searchKeyword,
      showHiddenEquipments: hasKeyword ? true : this.data.showHiddenEquipments
    }, () => {
      this.filterEquipments();
    });
  },

  onClearEquipmentSearch() {
    this.setData({
      searchKeyword: '',
      showHiddenEquipments: false
    }, () => {
      this.filterEquipments();
    });
  },

  normalizeSearchKeyword(value) {
    return String(value || '').trim().toLowerCase();
  },

  matchesEquipmentSearch(item, keyword) {
    if (!keyword) return true;
    const fields = [
      item.id,
      item.type,
      item.brand,
      item.model,
      item.name,
      item.note,
      item.category,
      item.profile,
      item.cupping,
      item.aliases,
      item.brewCupId,
      item.groupLabel,
      this.getEquipmentCategorySearchText(item)
    ];
    if (item.type !== 'cup') fields.push(item.mapping);
    return fields.some(value => String(value || '').toLowerCase().includes(keyword));
  },

  getEquipmentCategorySearchText(item) {
    if (item.type !== 'cup') return '';
    const categoryMap = {
      regular_cone: '常规锥形 旁通锥形 锥形',
      regular_flat: '常规平底 旁通平底 平底 蛋糕杯',
      low_bypass_cone: '低旁通锥形 低旁通 锥形',
      low_bypass_flat: '低旁通平底 低旁通 平底 贴壁 no-bypass',
      immersion: '浸泡式 聪明杯 浸泡',
      mixed: '其他 混合型 梯形 暂不纳入'
    };
    return categoryMap[item.category] || '';
  },

  onToggleHiddenEquipments() {
    this.setData({
      showHiddenEquipments: !this.data.showHiddenEquipments
    });
  },

  onHideEquipment(e) {
    if (!requireLogin('登录后可隐藏设备，并同步你的设备偏好。')) return;
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || this.data.activeTab;
    const hiddenEquipmentMap = updateHiddenMap(this.data.hiddenEquipmentMap, type, id, true);
    const shownEquipmentMap = updateHiddenMap(this.data.shownEquipmentMap, type, id, false);
    this.setData({ hiddenEquipmentMap, shownEquipmentMap });
    setUserStorageSync(HIDDEN_EQUIPMENT_KEY, hiddenEquipmentMap);
    setUserStorageSync(SHOWN_EQUIPMENT_KEY, shownEquipmentMap);
    this.filterEquipments();
    wx.showToast({
      title: '已移入其他设备',
      icon: 'none'
    });
  },

  onShowEquipment(e) {
    if (!requireLogin('登录后可恢复显示设备，并同步你的设备偏好。')) return;
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || this.data.activeTab;
    const item = this.data.equipments.find(eq => eq.id === id);
    const hiddenEquipmentMap = updateHiddenMap(this.data.hiddenEquipmentMap, type, id, false);
    const shownEquipmentMap = item && item.preset
      ? updateHiddenMap(this.data.shownEquipmentMap, type, id, true)
      : this.data.shownEquipmentMap;
    this.setData({ hiddenEquipmentMap, shownEquipmentMap });
    setUserStorageSync(HIDDEN_EQUIPMENT_KEY, hiddenEquipmentMap);
    if (item && item.preset) setUserStorageSync(SHOWN_EQUIPMENT_KEY, shownEquipmentMap);
    this.filterEquipments();
  },

  onSetDefault(e) {
    if (!requireLogin('登录后可设置默认设备，并联动冲煮方案。')) return;
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || this.data.activeTab;
    const { equipments } = this.data;
    const hiddenEquipmentMap = updateHiddenMap(this.data.hiddenEquipmentMap, type, id, false);
    const item = equipments.find(eq => eq.id === id);
    const shownEquipmentMap = item && item.preset
      ? updateHiddenMap(this.data.shownEquipmentMap, type, id, true)
      : this.data.shownEquipmentMap;
    const defaultMap = {
      ...this.data.defaultMap,
      [type]: id
    };
    const updated = equipments.map(eq => ({
      ...eq,
      isDefault: eq.type === type ? (eq.id === id) : eq.isDefault
    }));
    this.setData({ equipments: updated, defaultMap, hiddenEquipmentMap, shownEquipmentMap });
    setUserStorageSync('equipmentDefaults', defaultMap);
    setUserStorageSync(HIDDEN_EQUIPMENT_KEY, hiddenEquipmentMap);
    if (item && item.preset) setUserStorageSync(SHOWN_EQUIPMENT_KEY, shownEquipmentMap);
    this.filterEquipments();
  },

  onClearDefault(e) {
    if (!requireLogin('登录后可管理默认设备。')) return;
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || this.data.activeTab;
    const defaultMap = { ...this.data.defaultMap };
    if (defaultMap[type] === id) delete defaultMap[type];
    const updated = this.data.equipments.map(eq =>
      eq.type === type ? { ...eq, isDefault: false } : eq
    );
    this.setData({ equipments: updated, defaultMap });
    setUserStorageSync('equipmentDefaults', defaultMap);
    this.filterEquipments();
  },

  onDelete(e) {
    if (!requireLogin('登录后可删除你手动添加的设备。')) return;
    const id = e.currentTarget.dataset.id;
    const item = this.data.equipments.find(eq => eq.id === id);
    if (item && item.preset) {
      wx.showToast({
        title: '预设设备不可删除',
        icon: 'none'
      });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: (res) => {
        if (res.confirm) {
          const type = item ? item.type : this.data.activeTab;
          const defaultMap = { ...this.data.defaultMap };
          if (defaultMap[type] === id) delete defaultMap[type];
          const hiddenEquipmentMap = updateHiddenMap(this.data.hiddenEquipmentMap, type, id, false);
          const shownEquipmentMap = updateHiddenMap(this.data.shownEquipmentMap, type, id, false);
          const equipments = this.data.equipments.filter(eq => eq.id !== id);
          const customEquipments = equipments.filter(eq => !eq.preset);
          this.setData({ equipments, defaultMap, hiddenEquipmentMap, shownEquipmentMap });
          setUserStorageSync('equipment', customEquipments);
          setUserStorageSync('equipmentDefaults', defaultMap);
          setUserStorageSync(HIDDEN_EQUIPMENT_KEY, hiddenEquipmentMap);
          setUserStorageSync(SHOWN_EQUIPMENT_KEY, shownEquipmentMap);
          this.filterEquipments();
        }
      }
    });
  },

  onAddEquipment() {
    if (!requireLogin('登录后可添加并保存你的设备。')) return;
    wx.showActionSheet({
      itemList: ['添加滤杯', '添加滤纸', '添加磨豆机'],
      success: (res) => {
        const types = ['cup', 'paper', 'grinder'];
        const type = types[res.tapIndex] || 'cup';
        wx.navigateTo({
          url: '/pages/equipment/edit/edit?type=' + type
        });
      }
    });
  },

  getTabLabel(type) {
    return TAB_LABELS[type] || '设备';
  },

  onLogout() {
    if (!this.data.currentUser) {
      wx.showToast({
        title: '当前未登录',
        icon: 'none'
      });
      return;
    }
    wx.showModal({
      title: '退出登录',
      content: '退出后会回到登录页，当前账户的数据仍会保留。',
      success: (res) => {
        if (res.confirm) logout();
      }
    });
  },

  onGoLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  }
});
