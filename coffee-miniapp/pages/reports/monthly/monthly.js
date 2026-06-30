const {
  buildBrewReport
} = require('../../../utils/brew-report.js');

Page({
  data: {
    reportTitle: '咖啡月报',
    report: null
  },

  onShow() {
    const report = buildBrewReport('monthly');
    this.setData({
      reportTitle: report.title,
      report
    });
    if (!report.available) {
      wx.showToast({
        title: report.emptyMessage,
        icon: 'none'
      });
    }
  }
});
