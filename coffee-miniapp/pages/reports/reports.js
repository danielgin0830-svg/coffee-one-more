const {
  buildBrewReport
} = require('../../utils/brew-report.js');

Page({
  data: {
    weeklyReport: null,
    monthlyReport: null
  },

  onShow() {
    this.loadReports();
  },

  loadReports() {
    this.setData({
      weeklyReport: buildBrewReport('weekly'),
      monthlyReport: buildBrewReport('monthly')
    });
  },

  onOpenReport(e) {
    const type = e.currentTarget.dataset.type;
    const report = type === 'monthly' ? this.data.monthlyReport : this.data.weeklyReport;
    if (!report || !report.available) {
      wx.showToast({
        title: report ? report.emptyMessage : '还要多喝几天才能看到报告哦',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: type === 'monthly' ? '/pages/reports/monthly/monthly' : '/pages/reports/weekly/weekly'
    });
  }
});
