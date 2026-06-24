const OCR_DRAFT_STORAGE_KEY = 'beanOcrDraft';
const MAX_OCR_IMAGE_BYTES = 2 * 1024 * 1024;

async function recognizeBeanLabelFromImage(source = '秒拍入库') {
  let fileID = '';
  const tempFilePath = await chooseBeanLabelImage();
  const imagePath = await compressOcrImage(tempFilePath);

  wx.showLoading({
    title: '识别中',
    mask: true
  });

  try {
    const uploadResult = await uploadTempOcrImage(imagePath);
    fileID = uploadResult.fileID;

    const res = await wx.cloud.callFunction({
      name: 'ocrBeanLabel',
      data: {
        fileID
      }
    });
    const result = res && res.result;
    if (!result || !result.ok) {
      const error = new Error((result && result.message) || 'OCR识别失败');
      if (result && result.code) {
        error.ocrCode = result.code;
      }
      throw error;
    }

    return {
      source,
      draft: result.draft || {},
      candidates: result.candidates || {},
      rawText: result.rawText || '',
      provider: result.provider || '',
      createdAt: Date.now()
    };
  } finally {
    wx.hideLoading();
    if (fileID) {
      deleteTempOcrImage(fileID);
    }
  }
}

function chooseBeanLabelImage() {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        sizeType: ['original'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          if (file && file.tempFilePath) {
            resolve(file.tempFilePath);
          } else {
            reject(new Error('没有选择图片'));
          }
        },
        fail: reject
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const filePath = res.tempFilePaths && res.tempFilePaths[0];
        if (filePath) {
          resolve(filePath);
        } else {
          reject(new Error('没有选择图片'));
        }
      },
      fail: reject
    });
  });
}

function compressOcrImage(filePath) {
  return new Promise((resolve, reject) => {
    if (!wx.compressImage) {
      ensureOcrImageSize(filePath).then(() => resolve(filePath)).catch(reject);
      return;
    }

    wx.compressImage({
      src: filePath,
      quality: 82,
      success: (res) => {
        const compressedPath = res.tempFilePath || filePath;
        ensureOcrImageSize(compressedPath)
          .then(() => resolve(compressedPath))
          .catch(() => ensureOcrImageSize(filePath).then(() => resolve(filePath)).catch(reject));
      },
      fail: () => {
        ensureOcrImageSize(filePath).then(() => resolve(filePath)).catch(reject);
      }
    });
  });
}

function ensureOcrImageSize(filePath) {
  return new Promise((resolve, reject) => {
    if (!wx.getFileInfo) {
      resolve();
      return;
    }
    wx.getFileInfo({
      filePath,
      success: (res) => {
        if (res.size > MAX_OCR_IMAGE_BYTES) {
          reject(new Error('图片超过2MB，请靠近包装文字重新拍摄或裁剪后重试'));
          return;
        }
        resolve();
      },
      fail: reject
    });
  });
}

function uploadTempOcrImage(tempFilePath) {
  const extensionMatch = String(tempFilePath).match(/\.(jpg|jpeg|png|webp)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `ocr-beans/${Date.now()}-${random}.${extension}`;
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: resolve,
      fail: reject
    });
  });
}

function deleteTempOcrImage(fileID) {
  wx.cloud.deleteFile({
    fileList: [fileID],
    fail: () => {}
  });
}

function formatOcrError(e) {
  const rawMessage = String((e && e.message) || (e && e.errMsg) || '').trim();
  const rawCode = String((e && (e.errCode || e.code)) || '');
  if (rawCode === '-504003' || /timed out|timeout/i.test(rawMessage)) {
    return '秒拍入库识别超时。请确认云函数 ocrBeanLabel 已重新上传部署，并将超时时间设置为20秒；也可以裁剪图片后重试。';
  }
  if (e && e.ocrCode === 'OCR_MARKET_QUOTA_NOT_ENOUGH') {
    return '微信 OCR 服务额度不足或未开通。请在微信开发者工具：云开发 -> 更多 -> 服务市场，搜索 OCR，领取/购买通用印刷体识别额度后重试。';
  }
  if (e && e.ocrCode === 'OCR_PERMISSION_ERROR') {
    return '微信 OCR 调用权限异常。请确认云函数已重新部署，并且 OCR 服务已在当前小程序环境开通。';
  }
  if (e && e.ocrCode === 'BAIDU_OCR_KEY_MISSING') {
    return '百度 OCR 未启用。请在云函数环境变量中配置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY 后重新部署。';
  }
  if (e && e.ocrCode === 'BAIDU_OCR_AUTH_ERROR') {
    return '百度 OCR 鉴权失败。请检查云函数环境变量 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY。';
  }
  if (e && e.ocrCode === 'BAIDU_OCR_QUOTA_LIMIT') {
    return '百度 OCR 额度或频率受限。请稍后重试，或检查百度智能云 OCR 免费额度。';
  }
  if (e && e.ocrCode === 'BAIDU_OCR_IMAGE_ERROR') {
    return '百度 OCR 无法处理这张图片。请裁剪包装文字区域后重试。';
  }
  if (e && e.ocrCode === 'BAIDU_OCR_TIMEOUT') {
    return '百度 OCR 响应超时。请稍后重试，或裁剪包装文字区域后重试。';
  }
  if (e && e.ocrCode === 'OCR_SPACE_API_KEY_MISSING') {
    return '备用 OCR 未启用。请在云函数环境变量中配置 OCR_SPACE_API_KEY 后重新部署。';
  }
  if (e && e.ocrCode === 'OCR_SPACE_API_KEY_INVALID') {
    return '备用 OCR API Key 无效。请检查云函数环境变量 OCR_SPACE_API_KEY。';
  }
  if (e && e.ocrCode === 'OCR_SPACE_IMAGE_TOO_LARGE') {
    return '备用 OCR 免费额度要求图片小于1MB，请靠近包装文字重新拍摄或裁剪后重试。';
  }
  if (e && e.ocrCode === 'OCR_SPACE_TIMEOUT') {
    return '备用 OCR 响应超时，请稍后重试。';
  }
  if (e && e.ocrCode === 'OCR_SPACE_QUOTA_LIMIT') {
    return '备用 OCR 额度或频率受限，请稍后重试或更换 OCR.space API Key。';
  }
  if (!rawMessage) return '图片没有识别出可用信息，可重新拍摄或手动添加。';
  if (rawMessage.length > 90) {
    return `${rawMessage.slice(0, 90)}...`;
  }
  return rawMessage;
}

module.exports = {
  OCR_DRAFT_STORAGE_KEY,
  formatOcrError,
  recognizeBeanLabelFromImage
};
