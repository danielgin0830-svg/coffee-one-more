# Coffee Open Format Reference

这是开放咖啡豆二维码标准 v1 候选版的 Node.js 参考实现，用于验证：

- 确定性 CBOR 业务数据。
- COSE_Sign1 / Ed25519 签名。
- Base45 普通二维码文本。
- `verified`、`pending`、`invalid` 三种签名状态。
- `qr_id = 0` 的未知实体文字回退。
- 由现有 Excel 编码表导出的全局 `qr_id` 注册表快照。

该目录不是正式发行平台，也没有接入咖一杯页面。

## 运行

```bash
npm install
npm test
npm run sample
npm run dev
```

示例命令会在 `output/` 中生成二维码图片和固定测试向量。`fixtures/` 中的私钥仅用于公开测试，不能用于真实发行。

`npm run dev` 会启动本地烘焙商发行页面：

```text
http://127.0.0.1:3210
```

如需从源工作簿重新生成注册表：

```bash
python scripts/export_registry.py "D:\\path\\to\\编码表.xlsx"
```
