const {
  createUserSession,
  getCurrentUser,
  syncUserDataFromCloud
} = require('../../utils/auth.js');
const {
  buildSharePayload,
  buildTimelinePayload
} = require('../../utils/share-card.js');

Page({
  data: {
    nickName: '',
    loggingIn: false
  },

  onLoad() {
    const user = getCurrentUser();
    if (user && user.id) {
      wx.reLaunch({ url: '/pages/brew/brew' });
    }
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onLogin() {
    if (this.data.loggingIn) return;

    this.setData({ loggingIn: true });
    wx.login({
      success: (res) => {
        this.requestOpenid()
          .then(openidResult => {
            const user = createUserSession({
              nickName: this.data.nickName.trim() || '微信用户',
              openid: openidResult ? openidResult.openid : '',
              codeReceived: !!res.code
            });

            const app = getApp();
            app.globalData.userInfo = user;

            if (!user.openid) return user;
            wx.showLoading({
              title: '同步中',
              mask: true
            });
            return syncUserDataFromCloud({ uploadAfterMerge: true })
              .then(syncResult => {
                wx.hideLoading();
                return {
                  ...user,
                  cloudSynced: !!(syncResult && syncResult.ok)
                };
              })
              .catch(() => {
                wx.hideLoading();
                return {
                  ...user,
                  cloudSynced: false
                };
              });
          })
          .then(user => {
            if (!user) return;
            wx.showToast({
              title: user.openid ? (user.cloudSynced ? '已登录并同步' : '已登录，待同步') : '已本机登录',
              icon: 'success'
            });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/brew/brew' });
            }, 300);
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '登录失败', icon: 'none' });
          })
          .then(() => {
            this.setData({ loggingIn: false });
          });
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        this.setData({ loggingIn: false });
      }
    });
  },

  onBrowse() {
    wx.reLaunch({ url: '/pages/brew/brew' });
  },

  requestOpenid() {
    const app = getApp();
    if (!wx.cloud || !app.globalData.cloudReady) {
      return Promise.resolve(null);
    }

    return wx.cloud.callFunction({
      name: 'getOpenid'
    }).then(res => {
      if (res && res.result && res.result.openid) {
        return res.result;
      }
      return null;
    }).catch(() => null);
  },

  onShareAppMessage() {
    return buildSharePayload(this);
  },

  onShareTimeline() {
    return buildTimelinePayload(this);
  }
});
