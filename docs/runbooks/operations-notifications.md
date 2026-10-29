# 运营告警渠道配置

运营告警（`payment.succeeded`、`refund.requested`、`webhook.failed`、`reconciliation.failed`、
`queue.dead_letter`）由 jobs 的 events 队列消费者投递到后台配置的渠道。入口：后台 **设置 → 运营通知**。
三个渠道互相独立，未配置的渠道直接跳过：

| 渠道 | 需要填写 | 何时投递 |
|---|---|---|
| Telegram | Bot token + Chat ID | 两项都有 |
| Discord | Webhook URL（`discord.com/api/webhooks/...`） | 有 URL |
| HTTPS webhook | Webhook URL + Webhook key | 两项都有 |

密钥与地址只存数据库 `setting` 表，不进 KV 缓存、不回显，审计记录中为 `[REDACTED]`；保存后立即生效。
输入框留空表示保留已配置值，勾选「清除」才会删除。

## 接入 Grok Bot webhook routine

1. 在 Grok Bot 的 routine 面板中创建或打开 webhook 触发的 routine，复制面板给出的 **Webhook URL**
   与 **sender key**（以面板显示为准，不要自行拼接地址）。
2. 后台「HTTPS webhook」一栏：URL 填入 **Webhook URL**，key 填入 **Webhook key**，保存。
   状态显示「已配置」即两项齐全；只填一项会显示「需同时配置地址与密钥」，不会投递。
3. 地址必须是公网域名的 `https://`，不带端口、用户名密码或 `#` 片段；IP 字面量、`localhost`、
   `.internal` / `.local` 等内网后缀会被拒绝。

## 请求格式

```http
POST <Webhook URL>
Content-Type: application/json
Authorization: Bearer <Webhook key>
Idempotency-Key: <event>:<sourceId>

{
  "v": 1,
  "id": "<event>:<sourceId>",
  "event": "refund.requested",
  "sourceId": "<退款申请 ID>",
  "workspaceId": "<可选>",
  "amount": 199,
  "currency": "USD",
  "text": "New refund request\nReference: ...\n..."
}
```

- `amount` 为最小货币单位整数；`workspaceId` / `amount` / `currency` 视事件可能缺省。
- `text` 与 Telegram / Discord 的消息文案相同，可直接转发；结构化字段供 routine 自行解析。
- 接收端应校验 `Authorization`，并按 `id`（或 `Idempotency-Key`）去重：队列重试与死信重放可能重复投递。

## 失败与重试

- 任意非 2xx（含 3xx，不跟随重定向）或 5 秒超时视为失败，消息以 503 语义进入队列重试，耗尽后进入死信。
- 每个渠道成功后写一条审计 `operations.sent.<telegram|discord|webhook>`（targetId 为 `<event>:<sourceId>`），
  重试只补发尚未成功的渠道。
- 投递失败不影响触发告警的业务流程。排查时查 jobs 日志中的 `OPERATIONS_WEBHOOK_DELIVERY_FAILED`；
  日志不包含地址与密钥。

staging / 生产的 URL 与 key 由运营者在各自环境后台手工填写，不写入仓库或 Wrangler 配置。
