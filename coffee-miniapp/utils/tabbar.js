const TAB_BAR_ITEMS = [
  { pagePath: 'pages/brew/brew', text: '搞杯喝的' },
  { pagePath: 'pages/recipes/recipes', text: '方案存档' },
  { pagePath: 'pages/beans/beans', text: '我的豆仓' },
  { pagePath: 'pages/equipment/equipment', text: '设备偏好' }
];

function getCurrentRoute() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages.length ? pages[pages.length - 1].route : '';
}

function getTabBarData(route) {
  const selectedRoute = route || getCurrentRoute();
  return {
    selectedRoute,
    list: TAB_BAR_ITEMS.map(item => ({
      ...item,
      active: item.pagePath === selectedRoute
    }))
  };
}

function syncCustomTabBar(page, route) {
  if (!page || typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (!tabBar || typeof tabBar.setData !== 'function') return;
  tabBar.setData(getTabBarData(route));
}

module.exports = {
  TAB_BAR_ITEMS,
  getCurrentRoute,
  getTabBarData,
  syncCustomTabBar
};
