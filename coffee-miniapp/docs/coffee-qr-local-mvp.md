# Coffee Origin Format 本地 MVP

## 1. 启动发行服务

```powershell
cd C:\Users\Daniel\WorkBuddy\2026-06-04-22-39-41\coffee-miniapp\tools\coffee-qr-reference
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:3210
```

发行页面可以选择国家、产区、庄园或处理厂、豆种和处理法，填写批次后生成普通 QR Code，并下载 SVG 或 PNG。

## 2. 小程序联调

1. 在微信开发者工具打开 `coffee-miniapp`。
2. 进入“我的豆仓”。
3. 点击“扫码入库”。
4. 点击“载入最近生成”，可以在没有摄像头的开发者工具中完成闭环。
5. 点击“扫码识别”，可以读取发行页面生成的真实二维码。
6. 检查预览资料后点击“确认入库”。

本地默认 API：

```text
http://127.0.0.1:3210
```

如使用同一局域网内的手机调试，需要把地址改为电脑局域网 IP：

```javascript
wx.setStorageSync('coffeeQrApiBaseUrl', 'http://192.168.x.x:3210')
```

## 3. MVP 安全边界

- 当前只有一个本地演示发行方和公开测试私钥。
- 测试私钥不得用于真实烘焙商或线上环境。
- 当前没有烘焙商登录、审核、数据库和正式密钥托管。
- 当前小程序通过本地 API 解码；生产版需要增加小程序端离线解析包或部署正式解析服务。
- 当前功能用于验证发行、生成、扫描、验证、预览和入库闭环，不宣称商品防伪能力。

## 4. 当前验证结果

- 注册表：854 个实体、996 条关系、1976 条别名。
- 协议：确定性 CBOR + COSE_Sign1 / Ed25519 + Base45。
- 已验证二维码 PNG 生成后可从像素中重新识别。
- 已验证 `verified`、`pending`、`invalid` 三种签名状态。
- 已验证同一 `(issuer_id, batch_id)` 的重复与冲突判断。
