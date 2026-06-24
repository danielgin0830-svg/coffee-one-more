const CARD_WIDTH = 600;
const CARD_HEIGHT = 700;
const { formatRecipeRatioText } = require('./ratio.js');

const CANVAS_ID = 'shareRecipeCanvas';
const DEFAULT_SHARE_IMAGE_URL = '/assets/share-cover.jpg';

function getRecipeShareTitle(recipe = {}) {
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

  wx.saveImageToPhotosAlbum({
    filePath,
    success() {
      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      });
    },
    fail(error) {
      const message = (error && error.errMsg) || '';
      if (message.includes('auth') || message.includes('authorize')) {
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
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  });
}

function drawRecipeShareCard(page, recipe) {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext(CANVAS_ID, page);
    drawBackground(ctx);
    drawHeader(ctx, recipe);
    drawRecipeSummary(ctx, recipe);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: CANVAS_ID,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        destWidth: CARD_WIDTH * 2,
        destHeight: CARD_HEIGHT * 2,
        success(res) {
          resolve(res.tempFilePath);
        },
        fail: reject
      }, page);
    });
  });
}

function drawBackground(ctx) {
  ctx.setFillStyle('#FAF7F2');
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  drawRoundRect(ctx, 30, 30, 540, 640, 28, '#FFFFFF');
  ctx.setStrokeStyle('#EDE5D8');
  ctx.setLineWidth(2);
  roundRectPath(ctx, 30, 30, 540, 640, 28);
  ctx.stroke();

  drawRoundRect(ctx, 30, 30, 540, 138, 28, '#FFE8D8');
  ctx.setFillStyle('#E8752A');
  ctx.fillRect(30, 138, 540, 30);
}

function drawHeader(ctx, recipe) {
  drawRoundRect(ctx, 54, 56, 172, 40, 20, '#E8752A');
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(22);
  ctx.fillText('朋友圈小卡片', 72, 83);

  ctx.setFillStyle('#2A211B');
  ctx.setFontSize(38);
  drawWrappedText(ctx, recipe.beanName || '未命名咖啡豆', 54, 130, 480, 44, 2, 38);

  ctx.setFillStyle('#7A6050');
  ctx.setFontSize(22);
  const method = getMethodText(recipe);
  ctx.fillText(method, 54, 192);
}

function drawRecipeSummary(ctx, recipe) {
  const top = 226;
  drawInfoPill(ctx, 54, top, '粉量', formatUnit(recipe.doseGrams, 'g'));
  drawInfoPill(ctx, 290, top, '总水量', formatUnit(recipe.totalWater, 'g'));
  drawInfoPill(ctx, 54, top + 92, '比例', formatRecipeRatioText(recipe, '-'));
  drawInfoPill(ctx, 290, top + 92, '水温', formatUnit(recipe.waterTemp, '°C'));

  drawKeyRow(ctx, 54, top + 198, '研磨度', recipe.grindSetting || recipe.grinderReference || '-');
  drawKeyRow(ctx, 54, top + 286, '器具组合', formatGearText(recipe));
  drawKeyRow(ctx, 54, top + 374, '目标时间', recipe.targetTime || '-');
}

function drawInfoPill(ctx, x, y, label, value) {
  drawRoundRect(ctx, x, y, 214, 68, 18, '#FAF7F2');
  ctx.setStrokeStyle('#EDE5D8');
  ctx.setLineWidth(2);
  roundRectPath(ctx, x, y, 214, 68, 18);
  ctx.stroke();
  ctx.setFillStyle('#7A6050');
  ctx.setFontSize(18);
  ctx.fillText(label, x + 22, y + 26);
  ctx.setFillStyle('#2A211B');
  ctx.setFontSize(28);
  ctx.fillText(value || '-', x + 22, y + 54);
}

function drawKeyRow(ctx, x, y, label, value) {
  drawRoundRect(ctx, x, y, 492, 68, 18, '#FFFAF6');
  ctx.setStrokeStyle('#F0A86F');
  ctx.setLineWidth(2);
  roundRectPath(ctx, x, y, 492, 68, 18);
  ctx.stroke();
  ctx.setFillStyle('#7A6050');
  ctx.setFontSize(19);
  ctx.fillText(label, x + 22, y + 26);
  ctx.setFillStyle('#2A211B');
  ctx.setFontSize(23);
  drawWrappedText(ctx, value || '-', x + 118, y + 42, 360, 26, 1, 23);
}

function formatGearText(recipe = {}) {
  const parts = [recipe.cup, recipe.paper].filter(Boolean);
  return parts.length ? parts.join(' / ') : '-';
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

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines, fontSize) {
  const chars = String(text || '').split('');
  const lines = [];
  let current = '';

  chars.forEach((char) => {
    if (lines.length >= maxLines) return;
    const candidate = current + char;
    const width = getTextWidth(ctx, candidate, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = candidate;
    }
  });

  if (current && lines.length < maxLines) lines.push(current);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function getTextWidth(ctx, text, fontSize) {
  if (ctx.measureText) {
    return ctx.measureText(text).width;
  }
  return String(text || '').length * fontSize;
}

function getMethodText(recipe = {}) {
  const methodName = recipe.methodName === '创建个人方案' ? '' : recipe.methodName;
  const parts = [
    methodName,
    recipe.route,
    recipe.cup,
    recipe.paper
  ].filter(Boolean);
  return parts.length ? parts.slice(0, 2).join(' · ') : '当前框架';
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
