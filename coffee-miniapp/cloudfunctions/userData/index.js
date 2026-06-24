const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const COLLECTION_NAME = 'coffee_user_data';

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      ok: false,
      code: 'OPENID_MISSING',
      message: '无法获取微信 openid'
    };
  }

  const action = event.action || 'get';
  if (action === 'get') {
    return getUserData(openid);
  }
  if (action === 'save') {
    return saveUserData(openid, event);
  }

  return {
    ok: false,
    code: 'UNKNOWN_ACTION',
    message: `未知操作：${action}`
  };
};

async function getUserData(openid) {
  const record = await findUserDataRecord(openid);
  if (!record) {
    return {
      ok: true,
      data: null,
      profile: null
    };
  }

  return {
    ok: true,
    data: record.data || {},
    profile: record.profile || null,
    updatedAt: record.updatedAt || ''
  };
}

async function saveUserData(openid, event = {}) {
  const now = new Date().toISOString();
  const payload = {
    openid,
    data: normalizeData(event.data),
    profile: normalizeProfile(event.profile),
    updatedAt: now
  };

  const record = await findUserDataRecord(openid);
  if (record && record._id) {
    await db.collection(COLLECTION_NAME).doc(record._id).update({
      data: payload
    });
    return {
      ok: true,
      updatedAt: now
    };
  }

  await db.collection(COLLECTION_NAME).add({
    data: {
      ...payload,
      createdAt: now
    }
  });

  return {
    ok: true,
    updatedAt: now
  };
}

async function findUserDataRecord(openid) {
  const res = await db.collection(COLLECTION_NAME)
    .where({
      openid
    })
    .limit(1)
    .get();
  return res && res.data && res.data[0] ? res.data[0] : null;
}

function normalizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
  return {
    id: profile.id || '',
    nickName: profile.nickName || '',
    avatarUrl: profile.avatarUrl || '',
    openid: profile.openid || '',
    loginMode: profile.loginMode || ''
  };
}
