const {
  createUserSession,
  ensureUserStorage,
  getCurrentUser,
  syncUserDataFromCloud
} = require('./utils/auth.js');

const CLOUD_ENV_ID = 'cloud1-d5gf6sm7bca633c7d';
const APP_VERSION = '2026.06.20';
const UPDATE_PROMPT_STORAGE_KEY = 'coffeeLastSeenUpdateVersion';
const UPDATE_NOTES = [
  '豆仓支持豆卡墙封面图，无图时按养豆状态显示磨砂渐变色块。',
  '我的豆仓新增按库存、按烘焙天数排序，并支持升序 / 降序切换。',
  '豆卡墙封面上传前会自动压缩，减少云存储占用。'
];

App({
  onLaunch() {
    this.initCloud();
    this.initStorage();
    this.upgradeLocalUserWithOpenid();
    this.scheduleUpdatePrompt();
  },

  initCloud() {
    if (!wx.cloud) {
      this.globalData.cloudReady = false;
      return;
    }

    try {
      const cloudConfig = { traceUser: true };
      if (CLOUD_ENV_ID) {
        cloudConfig.env = CLOUD_ENV_ID;
      }
      wx.cloud.init(cloudConfig);
      this.globalData.cloudReady = true;
    } catch (e) {
      this.globalData.cloudReady = false;
    }
  },

  initStorage() {
    const user = getCurrentUser();
    if (user && user.id) {
      this.globalData.userInfo = user;
      ensureUserStorage(user.id);
      if (user.openid) {
        syncUserDataFromCloud({ uploadAfterMerge: false }).catch(() => {});
      }
    }
  },

  upgradeLocalUserWithOpenid() {
    const user = this.globalData.userInfo || getCurrentUser();
    if (!user || user.openid || !this.globalData.cloudReady || !wx.cloud) return;

    wx.login({
      success: (loginResult) => {
        wx.cloud.callFunction({
          name: 'getOpenid'
        }).then(res => {
          const openid = res && res.result && res.result.openid;
          if (!openid) return;

          const upgradedUser = createUserSession({
            ...user,
            openid,
            nickName: user.nickName,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            codeReceived: !!loginResult.code
          });
          this.globalData.userInfo = upgradedUser;
          syncUserDataFromCloud({ uploadAfterMerge: true }).catch(() => {});
        }).catch(() => {});
      }
    });
  },

  scheduleUpdatePrompt() {
    if (!UPDATE_NOTES.length) return;
    if (wx.getStorageSync(UPDATE_PROMPT_STORAGE_KEY) === APP_VERSION) return;

    setTimeout(() => {
      if (wx.getStorageSync(UPDATE_PROMPT_STORAGE_KEY) === APP_VERSION) return;
      wx.showModal({
        title: `更新内容 ${APP_VERSION}`,
        content: UPDATE_NOTES.map((item, index) => `${index + 1}. ${item}`).join('\n'),
        confirmText: '知道了',
        showCancel: false,
        success: () => {
          wx.setStorageSync(UPDATE_PROMPT_STORAGE_KEY, APP_VERSION);
        }
      });
    }, 900);
  },

  globalData: {
    cloudEnvId: CLOUD_ENV_ID,
    appVersion: APP_VERSION,
    cloudReady: false,
    userInfo: null
  }
});
