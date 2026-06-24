const {
  TAB_BAR_ITEMS,
  getCurrentRoute,
  getTabBarData
} = require('../utils/tabbar.js');

Component({
  data: {
    selectedRoute: '',
    list: TAB_BAR_ITEMS
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
    }
  },

  methods: {
    updateSelected() {
      this.setData(getTabBarData(getCurrentRoute()));
    },

    onTap(e) {
      const path = e.currentTarget.dataset.path;
      if (!path) return;
      if (path === this.data.selectedRoute) {
        this.updateSelected();
        return;
      }
      wx.switchTab({
        url: `/${path}`,
        fail: () => {
          wx.reLaunch({ url: `/${path}` });
        }
      });
    }
  }
});
