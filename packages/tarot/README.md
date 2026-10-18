# @xuanxue/tarot

78 张 RWS 牌的 ID、花色、序号、图片路径、正逆位 Yes/No/Maybe 映射；`CARD_MEANINGS` 提供 en、zh-Hant、ko 牌名、关键词、短义及映射依据。三语名词见 [GLOSSARY.md](GLOSSARY.md)。映射和短义用于娱乐性反思，不预测未来。

```ts
import { shuffleDeck, cutDeck, drawCards, encodeReading, decodeReading } from '@xuanxue/tarot'
const deck = cutDeck(shuffleDeck(true), 17)
const reading = drawCards('three-card', deck, [4, 20, 9])
const fragment = `#r=${encodeReading(reading)}`
// 分享页读取 #r= 后的文本并 decodeReading，不再次抽牌。
```

`shuffleDeck(false)` 关闭逆位。洗牌用 Web Crypto 加密随机数和 Fisher–Yates；拒绝采样避免取模偏差，每张牌独立以 50% 概率逆位。`cutDeck` 返回数组旋转副本；`drawCards` 可接受点选位置（省略时抽顶部），返回独立牌对象并检查数量、不重复和有效 ID。

四种 spread ID：`daily`、`yes-or-no`、`three-card`、`celtic-cross`。`SPREADS` 的三语 positions 与抽牌顺序对应。切牌、抽牌和解码的非法输入抛出 `INVALID_TAROT_READING` AppError；编码为 `spread:cardId[r],cardId[r]`，只存结果，不含问题或姓名。

图片是 Commons 1909 Roses & Lilies 扫描，来源、许可与原图哈希位于 `apps/web/public/tarot/SOURCES.md`。本地安装 cwebp 后执行 `node scripts/tarot-images.mjs` 可重新下载和生成 156 张 240w/480w WebP；不依赖 Worker 内图片转换。

验证：`pnpm --filter @xuanxue/tarot test` 包括 100,000 次十张牌抽取（每张期望出现约 12,821 次），检查全部 78 张频率偏差小于 5% 和总体逆位比例 49%–51%。
