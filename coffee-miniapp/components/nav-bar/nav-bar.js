Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    showBack: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 24,
    navContentHeight: 56,
    navBarHeight: 80
  },

  lifetimes: {
    attached() {
      this.initSafeArea();
    }
  },

  methods: {
    initSafeArea() {
      let statusBarHeight = 24;
      let navContentHeight = 56;

      try {
        const systemInfo = wx.getSystemInfoSync();
        statusBarHeight = systemInfo.statusBarHeight || statusBarHeight;

        if (wx.getMenuButtonBoundingClientRect) {
          const menuButton = wx.getMenuButtonBoundingClientRect();
          const menuGap = Math.max(menuButton.top - statusBarHeight, 4);
          navContentHeight = menuButton.height + menuGap * 2;
        }
      } catch (error) {
        // Fallback keeps the custom nav usable on older runtimes.
      }

      this.setData({
        statusBarHeight,
        navContentHeight,
        navBarHeight: statusBarHeight + navContentHeight
      });
    },

    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      }
    }
  }
});
