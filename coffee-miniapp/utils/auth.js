const CURRENT_USER_KEY = 'coffeeCurrentUser';
const LOCAL_USER_ID_KEY = 'coffeeLocalUserId';
const USER_STORAGE_PREFIX = 'coffeeUser';
const TOMBSTONE_KEY = 'deletedItemTombstones';
const TOMBSTONE_ARRAY_KEYS = [
  'beans',
  'equipment',
  'recipes'
];
const USER_DATA_KEYS = [
  'beans',
  'equipment',
  'equipmentDefaults',
  'equipmentHiddenIds',
  'equipmentShownIds',
  'recipes',
  'brewLogs',
  'beanFeedbackAdjustments',
  TOMBSTONE_KEY
];
const CLOUD_USER_DATA_FUNCTION = 'userData';
let loginPromptVisible = false;
let syncTimer = null;
let syncInProgress = false;

function getCurrentUser() {
  return wx.getStorageSync(CURRENT_USER_KEY) || null;
}

function isLoggedIn() {
  const user = getCurrentUser();
  return !!(user && user.id);
}

function getLocalUserId() {
  let id = wx.getStorageSync(LOCAL_USER_ID_KEY);
  if (!id) {
    id = `local-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    wx.setStorageSync(LOCAL_USER_ID_KEY, id);
  }
  return id;
}

function createUserSession(profile = {}) {
  const now = new Date().toISOString();
  const previousUser = getCurrentUser();
  const user = {
    id: profile.openid || profile.userId || getLocalUserId(),
    nickName: profile.nickName || '微信用户',
    avatarUrl: profile.avatarUrl || '',
    openid: profile.openid || '',
    loginMode: profile.openid ? 'wechat-openid' : 'local-wechat',
    codeReceived: !!profile.codeReceived,
    createdAt: profile.createdAt || now,
    updatedAt: now
  };

  wx.setStorageSync(CURRENT_USER_KEY, user);
  wx.setStorageSync(getUserStorageKey('profile', user.id), user);
  migrateLegacyData(user.id);
  if (previousUser && previousUser.id && previousUser.id !== user.id) {
    migrateUserData(previousUser.id, user.id);
  }
  ensureUserStorage(user.id);
  return user;
}

function promptLogin(message = '登录后可保存你的豆仓、设备和方案存档。') {
  if (isLoggedIn()) return true;
  if (loginPromptVisible) return false;

  loginPromptVisible = true;
  wx.showModal({
    title: '登录后使用',
    content: message,
    confirmText: '去登录',
    cancelText: '先逛逛',
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    },
    complete: () => {
      loginPromptVisible = false;
    }
  });
  return false;
}

function requireLogin(message) {
  return promptLogin(message);
}

function logout() {
  wx.removeStorageSync(CURRENT_USER_KEY);
  wx.reLaunch({ url: '/pages/brew/brew' });
}

function getUserStorageKey(key, userId) {
  const targetUserId = userId || (getCurrentUser() || {}).id || 'anonymous';
  return `${USER_STORAGE_PREFIX}:${targetUserId}:${key}`;
}

function getUserStorageSync(key, fallbackValue) {
  const user = getCurrentUser();
  if (!user || !user.id) return cloneFallback(fallbackValue);

  const storageKey = getUserStorageKey(key, user.id);
  if (!hasStorageKey(storageKey)) return cloneFallback(fallbackValue);

  const value = wx.getStorageSync(storageKey);
  return value === '' ? cloneFallback(fallbackValue) : value;
}

function setUserStorageSync(key, value) {
  const user = getCurrentUser();
  if (!user || !user.id) {
    wx.setStorageSync(key, value);
    return;
  }
  recordDeletedItems(user.id, key, value);
  wx.setStorageSync(getUserStorageKey(key, user.id), value);
  scheduleCloudSync();
}

function ensureUserStorage(userId) {
  const id = userId || (getCurrentUser() || {}).id;
  if (!id) return;

  USER_DATA_KEYS.forEach(key => {
    const storageKey = getUserStorageKey(key, id);
    if (hasStorageKey(storageKey)) return;
    wx.setStorageSync(storageKey, getDefaultValue(key));
  });
}

function migrateLegacyData(userId) {
  if (!userId) return;

  USER_DATA_KEYS.forEach(key => {
    const storageKey = getUserStorageKey(key, userId);
    if (hasStorageKey(storageKey) || !hasStorageKey(key)) return;

    const legacyValue = wx.getStorageSync(key);
    if (legacyValue !== '') {
      wx.setStorageSync(storageKey, legacyValue);
    }
  });
}

function migrateUserData(fromUserId, toUserId) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  USER_DATA_KEYS.forEach(key => {
    const fromKey = getUserStorageKey(key, fromUserId);
    const toKey = getUserStorageKey(key, toUserId);
    if (!hasStorageKey(fromKey) || hasStorageKey(toKey)) return;

    const value = wx.getStorageSync(fromKey);
    if (value !== '') {
      wx.setStorageSync(toKey, value);
    }
  });
}

function hasStorageKey(key) {
  try {
    const info = wx.getStorageInfoSync();
    return (info.keys || []).includes(key);
  } catch (e) {
    return wx.getStorageSync(key) !== '';
  }
}

function getDefaultValue(key) {
  if (
    key === 'equipmentDefaults'
    || key === 'equipmentHiddenIds'
    || key === 'equipmentShownIds'
    || key === 'beanFeedbackAdjustments'
    || key === TOMBSTONE_KEY
  ) return {};
  return [];
}

function cloneFallback(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return { ...value };
  return value;
}

function canUseCloudUserData(user = getCurrentUser()) {
  return !!(
    user
    && user.openid
    && typeof wx !== 'undefined'
    && wx.cloud
  );
}

function collectUserData(userId) {
  const id = userId || (getCurrentUser() || {}).id;
  const data = {};
  if (!id) return data;
  USER_DATA_KEYS.forEach(key => {
    const storageKey = getUserStorageKey(key, id);
    if (hasStorageKey(storageKey)) {
      const value = wx.getStorageSync(storageKey);
      data[key] = value === '' ? getDefaultValue(key) : value;
    } else {
      data[key] = getDefaultValue(key);
    }
  });
  return data;
}

function applyUserData(userId, data = {}) {
  if (!userId || !data || typeof data !== 'object') return;
  USER_DATA_KEYS.forEach(key => {
    if (data[key] === undefined) return;
    wx.setStorageSync(getUserStorageKey(key, userId), data[key]);
  });
}

function hasMeaningfulUserData(data = {}) {
  return USER_DATA_KEYS.some(key => {
    const value = data[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== '';
  });
}

function mergeUserData(remoteData = {}, localData = {}) {
  const merged = {};
  const tombstones = mergeTombstones(remoteData[TOMBSTONE_KEY], localData[TOMBSTONE_KEY]);
  USER_DATA_KEYS.forEach(key => {
    merged[key] = key === TOMBSTONE_KEY
      ? tombstones
      : mergeValue(remoteData[key], localData[key], key, tombstones[key] || {});
  });
  return merged;
}

function mergeValue(remoteValue, localValue, key, tombstones = {}) {
  if (Array.isArray(remoteValue) || Array.isArray(localValue)) {
    return mergeArrayByStableKey(remoteValue || [], localValue || [], tombstones);
  }
  if (isPlainObject(remoteValue) || isPlainObject(localValue)) {
    return {
      ...(isPlainObject(remoteValue) ? remoteValue : {}),
      ...(isPlainObject(localValue) ? localValue : {})
    };
  }
  if (localValue !== undefined && localValue !== null && localValue !== '') return localValue;
  if (remoteValue !== undefined && remoteValue !== null && remoteValue !== '') return remoteValue;
  return getDefaultValue(key);
}

function mergeArrayByStableKey(remoteList = [], localList = [], tombstones = {}) {
  const map = {};
  remoteList.forEach(item => {
    const key = getStableItemKey(item);
    if (isTombstoned(key, tombstones)) return;
    map[key] = item;
  });
  localList.forEach(item => {
    const key = getStableItemKey(item);
    if (isTombstoned(key, tombstones)) return;
    map[key] = {
      ...(isPlainObject(map[key]) ? map[key] : {}),
      ...(isPlainObject(item) ? item : { value: item })
    };
  });
  return Object.keys(map)
    .map(key => map[key])
    .filter(item => !(isPlainObject(item) && item.value !== undefined && Object.keys(item).length === 1));
}

function recordDeletedItems(userId, key, nextValue) {
  if (!userId || !TOMBSTONE_ARRAY_KEYS.includes(key) || !Array.isArray(nextValue)) return;

  const previousValue = getUserStorageSync(key, []);
  if (!Array.isArray(previousValue) || !previousValue.length) return;

  const nextKeys = new Set(nextValue.map(item => getStableItemKey(item)));
  const removedKeys = previousValue
    .map(item => getStableItemKey(item))
    .filter(itemKey => itemKey && !nextKeys.has(itemKey));
  if (!removedKeys.length) return;

  const tombstones = getUserStorageSync(TOMBSTONE_KEY, {});
  const keyTombstones = {
    ...(isPlainObject(tombstones[key]) ? tombstones[key] : {})
  };
  const deletedAt = new Date().toISOString();
  removedKeys.forEach(itemKey => {
    keyTombstones[itemKey] = {
      deletedAt
    };
  });

  wx.setStorageSync(getUserStorageKey(TOMBSTONE_KEY, userId), {
    ...(isPlainObject(tombstones) ? tombstones : {}),
    [key]: keyTombstones
  });
}

function mergeTombstones(remoteValue = {}, localValue = {}) {
  const merged = {};
  [remoteValue, localValue].forEach(source => {
    if (!isPlainObject(source)) return;
    Object.keys(source).forEach(dataKey => {
      merged[dataKey] = {
        ...(isPlainObject(merged[dataKey]) ? merged[dataKey] : {}),
        ...(isPlainObject(source[dataKey]) ? source[dataKey] : {})
      };
    });
  });
  return merged;
}

function isTombstoned(key, tombstones = {}) {
  return !!(key && isPlainObject(tombstones) && tombstones[key]);
}

function getStableItemKey(item) {
  if (!isPlainObject(item)) return JSON.stringify(item);
  return String(
    item.id
    || item.archiveId
    || item.archiveSignature
    || item.savedAt
    || item.createdAt
    || JSON.stringify(item)
  );
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function scheduleCloudSync() {
  const user = getCurrentUser();
  if (!canUseCloudUserData(user)) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    saveUserDataToCloud().catch(() => {});
  }, 900);
}

function callUserDataCloud(data) {
  return wx.cloud.callFunction({
    name: CLOUD_USER_DATA_FUNCTION,
    data
  }).then(res => res && res.result ? res.result : null);
}

async function syncUserDataFromCloud(options = {}) {
  const user = getCurrentUser();
  if (!canUseCloudUserData(user)) return { ok: false, reason: 'cloud-unavailable' };
  if (syncInProgress) return { ok: false, reason: 'syncing' };

  syncInProgress = true;
  try {
    ensureUserStorage(user.id);
    const localData = collectUserData(user.id);
    const result = await callUserDataCloud({ action: 'get' });
    const remoteData = result && result.ok && result.data ? result.data : {};
    const mergedData = mergeUserData(remoteData, localData);
    applyUserData(user.id, mergedData);

    const shouldUploadAfterMerge = options.uploadAfterMerge !== false || hasTombstoneData(localData[TOMBSTONE_KEY]);
    if (shouldUploadAfterMerge && (hasMeaningfulUserData(localData) || hasMeaningfulUserData(remoteData))) {
      await saveUserDataToCloud(user.id, mergedData);
    }
    return {
      ok: true,
      hasRemoteData: hasMeaningfulUserData(remoteData)
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'failed',
      error: e
    };
  } finally {
    syncInProgress = false;
  }
}

async function saveUserDataToCloud(userId, data) {
  const user = getCurrentUser();
  if (!canUseCloudUserData(user)) return { ok: false, reason: 'cloud-unavailable' };
  const targetUserId = userId || user.id;
  const payload = data || collectUserData(targetUserId);
  return callUserDataCloud({
    action: 'save',
    profile: user,
    data: payload
  });
}

function hasTombstoneData(value = {}) {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some(dataKey => (
    isPlainObject(value[dataKey]) && Object.keys(value[dataKey]).length > 0
  ));
}

module.exports = {
  CURRENT_USER_KEY,
  USER_DATA_KEYS,
  createUserSession,
  ensureUserStorage,
  getCurrentUser,
  getUserStorageKey,
  getUserStorageSync,
  isLoggedIn,
  logout,
  promptLogin,
  requireLogin,
  saveUserDataToCloud,
  setUserStorageSync,
  syncUserDataFromCloud
};
