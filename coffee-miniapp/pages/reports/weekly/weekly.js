const {
  buildBrewReport
} = require('../../../utils/brew-report.js');

Page({
  data: {
    reportTitle: '咖啡周报',
    report: null
  },

  onShow() {
    const report = buildBrewReport('weekly');
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
