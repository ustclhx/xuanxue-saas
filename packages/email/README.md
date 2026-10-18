# Email

`@xuanxue/email` 提供 React Email 模板、`EmailSender`、fetch Resend sender；
`@xuanxue/email/queue` 是不加载模板的 producer 消息入口。
模板及渲染结果由 `renderEmail` 生成，jobs 的 EMAIL_QUEUE 消费者按 `EMAIL_TRANSPORT`（`log` / `resend`）发送。

Resend 使用消息的稳定幂等键与其服务端去重窗口。队列重试保持原契约：
首次加最多五次重试，30 秒指数退避封顶 900 秒，成功成员独立确认。

## 本地验证

```sh
pnpm --filter @xuanxue/email typecheck
pnpm --filter @xuanxue/email test
```

`test` 包含 Node 单元用例与 workerd 渲染用例。
