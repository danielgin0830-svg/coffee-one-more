const CARD_WIDTH = 640;
const CARD_HEIGHT = 720;
const { formatRecipeRatioText } = require('./ratio.js');

const CANVAS_ID = 'shareRecipeCanvas';
const DEFAULT_SHARE_IMAGE_URL = '/assets/share-cover.jpg';
const DEFAULT_SHARE_QR_IMAGE = '/assets/share-qr.jpg';

// 参考「晴空橙光奶油组」配色：蓝做核心数据主块、橙做回流 CTA、米白打底
const COLORS = {
  cream: '#FAEDD1',
  blue: '#1387C0',
  orange: '#F4520D',
  ink: '#0E3A52',
  sub: '#A07E4E',
  label: '#9A8056',
  line: '#ECD9B4',
  white: '#FFFFFF'
};

function getRecipeShareTitle() {
  return '别想那么多 咖一杯先';
}

function getRecipeSharePath() {
  // Saved recipes live in the sender's local account data. Shared links should
  // open a browsable page instead of an archive detail that may not exist.
  return '/pages/brew/brew';
}

function buildSharePayload(page, fallbackRecipe = {}) {
  const recipe = (page.data && page.data.shareCardRecipe) || fallbackRecipe || {};
  const payload = {
    title: getRecipeShareTitle(recipe),
    path: getRecipeSharePath(recipe)
  };
  payload.imageUrl = getShareImageUrl(page);
  return payload;
}

function buildTimelinePayload(page, fallbackRecipe = {}) {
  const recipe = (page.data && page.data.shareCardRecipe) || fallbackRecipe || {};
  const payload = {
    title: getRecipeShareTitle(recipe),
    query: ''
  };
  payload.imageUrl = getShareImageUrl(page);
  return payload;
}

function getShareImageUrl(page) {
  if (page && page.data && page.data.shareCardImage) {
    return page.data.shareCardImage;
  }
  return DEFAULT_SHARE_IMAGE_URL;
}

function createRecipeShareCard(page, recipe) {
  if (!recipe) {
    wx.showToast({
      title: '暂无可分享方案',
      icon: 'none'
    });
    return Promise.resolve();
  }

  wx.showLoading({ title: '生成中' });
  return drawRecipeShareCard(page, recipe)
    .then((imagePath) => {
      page.setData({
        shareCardVisible: true,
        shareCardImage: imagePath,
        shareCardRecipe: recipe
      });
      wx.hideLoading();
    })
    .catch((error) => {
      console.error('生成分享卡片失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '生成失败',
        icon: 'none'
      });
    });
}

function closeRecipeShareCard(page) {
  page.setData({
    shareCardVisible: false
  });
}

function saveRecipeShareCard(page) {
  const filePath = page.data && page.data.shareCardImage;
  if (!filePath) {
    wx.showToast({
      title: '请先生成卡片',
      icon: 'none'
    });
    return;
  }

  wx.showLoading({ title: '保存中' });
  ensureAlbumPermission()
    .then(() => resolveShareCardImagePath(filePath))
    .then((imagePath) => saveImageToAlbum(imagePath))
    .then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      });
    })
    .catch((error) => {
      wx.hideLoading();
      handleSaveImageError(error);
    });
}

function drawRecipeShareCard(page, recipe) {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext(CANVAS_ID, page);
    drawCardBackground(ctx);
    drawBrandBar(ctx);
    drawBeanTitle(ctx, recipe);
    drawCoreStats(ctx, recipe);
    drawDetails(ctx, recipe);
    drawBottomCta(ctx, recipe);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: CANVAS_ID,
        x: 0,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        destWidth: CARD_WIDTH * 2,
        destHeight: CARD_HEIGHT * 2,
        fileType: 'png',
        success(res) {
          resolve(res.tempFilePath);
        },
        fail: reject
      }, page);
    });
  });
}

function resolveShareCardImagePath(filePath) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success(res) {
        resolve(res.path || filePath);
      },
      fail(error) {
        console.warn('读取分享卡片图片信息失败，尝试直接保存:', error);
        resolve(filePath);
      }
    });
  });
}

function ensureAlbumPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(res) {
        const authSetting = res.authSetting || {};
        const albumScope = authSetting['scope.writePhotosAlbum'];
        if (albumScope === true) {
          resolve();
          return;
        }
        if (albumScope === false) {
          reject({ type: 'auth' });
          return;
        }
        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: resolve,
          fail(error) {
            reject({
              type: 'auth',
              error
            });
          }
        });
      },
      fail() {
        // If settings cannot be read, continue to the save API and let it
        // surface the platform-specific error.
        resolve();
      }
    });
  });
}

function saveImageToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail(error) {
        reject({
          type: inferSaveErrorType(error),
          error
        });
      }
    });
  });
}

function inferSaveErrorType(error = {}) {
  const message = String(error.errMsg || '');
  if (/auth|authorize|permission|deny|denied/i.test(message)) return 'auth';
  if (/file|path|not found|no such/i.test(message)) return 'image';
  return 'save';
}

function handleSaveImageError(error = {}) {
  const originalError = error.error || error;
  console.error('保存分享卡片失败:', originalError);
  if (error.type === 'auth') {
    wx.showModal({
      title: '需要相册权限',
      content: '请允许保存图片到相册，再发朋友圈。',
      confirmText: '去设置',
      success(res) {
        if (res.confirm) wx.openSetting({});
      }
    });
    return;
  }
  if (error.type === 'image') {
    wx.showToast({
      title: '请重新生成卡片',
      icon: 'none'
    });
    return;
  }
  wx.showToast({
    title: '保存失败',
    icon: 'none'
  });
}

function drawCardBackground(ctx) {
  ctx.setFillStyle(COLORS.white);
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawRoundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 28, COLORS.cream);
}

function drawBrandBar(ctx) {
  ctx.beginPath();
  ctx.arc(52, 60, 8, 0, Math.PI * 2);
  ctx.setFillStyle(COLORS.orange);
  ctx.fill();

  ctx.setTextAlign('left');
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(26);
  ctx.fillText('搞杯喝的', 70, 69);

  const tagW = 116;
  const tagX = CARD_WIDTH - 44 - tagW;
  const tagY = 44;
  const tagH = 34;
  roundRectPath(ctx, tagX, tagY, tagW, tagH, 17);
  ctx.setStrokeStyle(COLORS.blue);
  ctx.setLineWidth(2);
  ctx.stroke();
  ctx.setTextAlign('center');
  ctx.setFillStyle(COLORS.blue);
  ctx.setFontSize(20);
  ctx.fillText('手冲记录', tagX + tagW / 2, tagY + 23);
}

function drawBeanTitle(ctx, recipe) {
  ctx.setTextAlign('left');
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(44);
  const name = String(recipe.beanName || '未命名咖啡豆').trim();
  const lines = splitBeanLines(ctx, name);
  const top = 140;
  lines.forEach((line, i) => {
    ctx.fillText(line, 44, top + i * 56);
  });
  const titleBottom = top + (lines.length - 1) * 56;

  const subtitle = buildSubtitle(recipe);
  if (subtitle) {
    ctx.setTextAlign('left');
    ctx.setFillStyle(COLORS.sub);
    ctx.setFontSize(22);
    ctx.fillText(clampText(ctx, subtitle, CARD_WIDTH - 88, 22), 44, titleBottom + 44);
  }
}

// 名称含空格时按主名 / 细节断两行；否则按卡片宽度自然折至多两行
function splitBeanLines(ctx, name) {
  ctx.setFontSize(44);
  const maxW = CARD_WIDTH - 88;
  const spaceIdx = name.search(/\s/);
  if (spaceIdx > 0) {
    const first = name.slice(0, spaceIdx).trim();
    const second = name.slice(spaceIdx + 1).trim();
    return [first, clampText(ctx, second, maxW, 44)].filter(Boolean);
  }
  if (getTextWidth(ctx, name, 44) <= maxW) return [name];
  let cut = '';
  let i = 0;
  for (; i < name.length; i += 1) {
    if (getTextWidth(ctx, cut + name[i], 44) > maxW) break;
    cut += name[i];
  }
  return [cut, clampText(ctx, name.slice(i), maxW, 44)];
}

function drawCoreStats(ctx, recipe) {
  const bx = 44;
  const by = 264;
  const bw = CARD_WIDTH - 88;
  const bh = 108;
  drawRoundRect(ctx, bx, by, bw, bh, 18, COLORS.blue);

  const cellW = bw / 3;
  const stats = [
    { value: formatUnit(recipe.doseGrams, 'g'), label: '粉量' },
    { value: formatRecipeRatioText(recipe, '-'), label: '粉水比' },
    { value: formatUnit(recipe.waterTemp, '°C'), label: '水温' }
  ];

  stats.forEach((stat, i) => {
    if (i > 0) {
      const lineX = bx + cellW * i;
      ctx.beginPath();
      ctx.moveTo(lineX, by + 22);
      ctx.lineTo(lineX, by + bh - 22);
      ctx.setStrokeStyle('rgba(255,255,255,0.25)');
      ctx.setLineWidth(1);
      ctx.stroke();
    }
    const cx = bx + cellW * i + cellW / 2;
    ctx.setTextAlign('center');
    ctx.setFillStyle(COLORS.white);
    ctx.setFontSize(34);
    ctx.fillText(clampText(ctx, stat.value, cellW - 24, 34), cx, by + 56);
    ctx.setFillStyle('rgba(255,255,255,0.85)');
    ctx.setFontSize(20);
    ctx.fillText(stat.label, cx, by + 90);
  });
}

function drawDetails(ctx, recipe) {
  const rows = [
    ['总水量', formatUnit(recipe.totalWater, 'g')],
    ['研磨度', recipe.grindSetting || recipe.grinderReference || '-'],
    ['器具组合', formatGearText(recipe)],
    ['冲煮时间', recipe.targetTime || '-']
  ];
  const left = 44;
  const right = CARD_WIDTH - 44;
  const rowH = 50;
  let y = 402;
  rows.forEach((row, i) => {
    ctx.setTextAlign('left');
    ctx.setFillStyle(COLORS.label);
    ctx.setFontSize(22);
    ctx.fillText(row[0], left, y + 14);

    ctx.setTextAlign('right');
    ctx.setFillStyle(COLORS.ink);
    ctx.setFontSize(22);
    ctx.fillText(clampText(ctx, String(row[1] || '-'), 360, 22), right, y + 14);

    if (i < rows.length - 1) {
      ctx.beginPath();
      ctx.moveTo(left, y + rowH - 14);
      ctx.lineTo(right, y + rowH - 14);
      ctx.setStrokeStyle(COLORS.line);
      ctx.setLineWidth(1);
      ctx.stroke();
    }
    y += rowH;
  });
}

function drawBottomCta(ctx, recipe) {
  const oy = 612;
  const oh = CARD_HEIGHT - oy;
  drawRoundRectMixed(ctx, 0, oy, CARD_WIDTH, oh, { br: 28, bl: 28 }, COLORS.orange);

  ctx.setTextAlign('left');
  ctx.setFillStyle(COLORS.white);
  ctx.setFontSize(26);
  ctx.fillText('别想那么多 咖一杯先', 44, oy + 44);
  ctx.setFillStyle('rgba(255,255,255,0.88)');
  ctx.setFontSize(18);
  ctx.fillText('扫码生成你的专属方案', 44, oy + 76);

  // 右下角小程序码：传入 recipe.shareQrImage 可覆盖默认静态码。
  const qrImage = recipe.shareQrImage || DEFAULT_SHARE_QR_IMAGE;
  const qs = 80;
  const qx = CARD_WIDTH - 44 - qs;
  const qy = oy + (oh - qs) / 2;
  drawRoundRect(ctx, qx, qy, qs, qs, 12, COLORS.white);
  if (qrImage) {
    ctx.drawImage(qrImage, qx, qy, qs, qs);
  } else {
    ctx.setTextAlign('center');
    ctx.setFillStyle(COLORS.orange);
    ctx.setFontSize(16);
    ctx.fillText('小程序码', qx + qs / 2, qy + qs / 2 + 6);
  }
}

// 副标题：烘焙度打头，其后追加用户填写的其他信息（去掉「产地：」等前缀），「·」隔开；不再显示冲煮路线
function buildSubtitle(recipe = {}) {
  const parts = [];
  const roast = String(recipe.roastLevel || '').trim();
  if (roast) parts.push(roast);
  const extra = String(recipe.beanExtraInfo || '').trim();
  if (extra) {
    extra.split('·').forEach((segment) => {
      const piece = segment.indexOf('：') >= 0
        ? segment.slice(segment.indexOf('：') + 1)
        : segment;
      const text = String(piece || '').trim();
      if (text) parts.push(text);
    });
  }
  return parts.join(' · ');
}

// 器具组合优先展示滤杯类型（cupCategory），再接滤纸
function formatGearText(recipe = {}) {
  const cup = String(recipe.cupCategory || recipe.cup || '').trim();
  const paper = String(recipe.paper || '').trim();
  const parts = [cup, paper].filter(Boolean);
  return parts.length ? parts.join(' · ') : '-';
}

function clampText(ctx, text, maxWidth, fontSize) {
  const value = String(text || '');
  ctx.setFontSize(fontSize);
  if (getTextWidth(ctx, value, fontSize) <= maxWidth) return value;
  let cut = '';
  for (let i = 0; i < value.length; i += 1) {
    if (getTextWidth(ctx, cut + value[i] + '…', fontSize) > maxWidth) break;
    cut += value[i];
  }
  return cut + '…';
}

function drawRoundRect(ctx, x, y, width, height, radius, color) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.setFillStyle(color);
  ctx.fill();
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arc(x + width - r, y + r, r, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(x + width, y + height - r);
  ctx.arc(x + width - r, y + height - r, r, 0, Math.PI * 0.5);
  ctx.lineTo(x + r, y + height);
  ctx.arc(x + r, y + height - r, r, Math.PI * 0.5, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function drawRoundRectMixed(ctx, x, y, width, height, radii, color) {
  const tl = radii.tl || 0;
  const tr = radii.tr || 0;
  const br = radii.br || 0;
  const bl = radii.bl || 0;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  if (tr) ctx.arc(x + width - tr, y + tr, tr, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(x + width, y + height - br);
  if (br) ctx.arc(x + width - br, y + height - br, br, 0, Math.PI * 0.5);
  ctx.lineTo(x + bl, y + height);
  if (bl) ctx.arc(x + bl, y + height - bl, bl, Math.PI * 0.5, Math.PI);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.setFillStyle(color);
  ctx.fill();
}

function getTextWidth(ctx, text, fontSize) {
  if (ctx.measureText) {
    return ctx.measureText(text).width;
  }
  return String(text || '').length * fontSize;
}

function formatUnit(value, unit) {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(value).trim();
  if (!text) return '-';
  if (/[a-zA-Z°克毫升]/.test(text)) return text;
  return `${text}${unit}`;
}

module.exports = {
  buildSharePayload,
  buildTimelinePayload,
  closeRecipeShareCard,
  createRecipeShareCard,
  getRecipeSharePath,
  getRecipeShareTitle,
  saveRecipeShareCard
};
