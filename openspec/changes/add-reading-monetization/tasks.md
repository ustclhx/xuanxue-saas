# Tasks

## 1. 数据与配置

- [x] 1.1 新增 `packages/db/src/schema/readings.ts`（reading：id、workspaceId、userId、kind、inputHash、input、engineVersion、promptVersion、modelKey、credits、status、content、timestamps）与 newsletter 新列；按 docs/09 §3 只做 `drizzle-kit push`、不提交迁移；验证：`pnpm --filter @xuanxue/db test` 通过
- [x] 1.2 运行时设置 `readings.<kind>.{enabled,credits,modelKey}` 与后台编辑界面（adminAction + 审计）；积分包种子 Single/Five，`signupBonusCredits` 设为 0；验证：后台修改后前台读取到新值的集成测试，`pnpm billing:seed` 可重复执行

## 2. 生成管线

- [x] 2.1 `features/readings/catalog.ts` 与 bazi/saju 两种详批的服务端复算、提示词 v1（固定前缀 + prompt caching）与章节校验；验证：单元测试断言篡改的命盘被忽略、章节齐全检查
- [x] 2.2 `POST /api/readings`：幂等、hold → 流式生成 → capture/release、报告邮件入队，复用 text-stream 检查点；验证：集成测试（模型用 fake provider）覆盖成功、无输出失败退回、连续点击不重复扣费
- [x] 2.3 生成后的合规规则检查（禁止词表与替换、审计日志）；验证：单元测试覆盖健康、日期预言、投资三类样例
- [ ] 2.4 其余详批类型：ziwei-full、saju-compat、numerology-full、tarot-spread 的复算与提示词；验证：每种至少一个 fake provider 集成测试

## 3. 前台

- [ ] 3.1 结果页解锁卡片（积分、当地货币估价、章节目录）与意图保留的签名 `unlock` 参数，贯通登录与 Checkout 回跳后自动生成；验证：e2e（Stripe 离线模拟）新访客登录 + 购买后回到原页并开始生成
- [ ] 3.2 报告阅读页（流式显示、Markdown 白名单渲染、合规声明、noindex）与 `/app/$slug/readings` 列表；验证：e2e 换会话后在列表中打开报告，非成员访问返回 404

## 4. L1 订阅

- [x] 4.1 结果后订阅卡片组件（三语、主题下拉），提交到 newsletter，保存来源与 `last_result`，已订阅者只更新偏好；验证：集成测试覆盖 newsletter 修改的场景
- [x] 4.2 确认后的个性化解读邮件模板（三语，基于结构化结果的模板段落，含退订与声明）；验证：邮件渲染快照测试 + 确认后入队一封解读邮件的集成测试

## 5. 验收

- [ ] 5.1 三语各抽检 10 份 bazi/saju/numerology/tarot 详批（真实模型，staging），记录合规检查结果到 `docs/runbooks/evidence/readings/`；验证：抽检记录无未处理的违规项
