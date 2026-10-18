# Storage 接口

业务从 `@xuanxue/storage` 导入文件函数、`Storage` 和 `MediaOutputCopier`。中立入口不加载 Workers 模块，也不需要 Workers 全局类型。Cloudflare composition root 从 `@xuanxue/storage/cloudflare` 导入两个工厂，每个请求或事件显式装配，再向业务注入。

```ts
const storage = createCloudflareStorage(env)
const copyOutput = createCloudflareMediaCopier(env.FILES)
await declareUpload(db, storage, input)
await persistMediaOutputs({ db, storage, copyOutput, task, result, limits })
```

`Storage` 提供四项操作：

- `head(key)` 返回 `{ size, mime }` 或 `null`；缺少 Content-Type 时 `mime` 为 `null`，上传确认按不匹配拒绝。
- `delete(key)` 幂等删除单个对象；失败必须传播，以保留数据库重试线索。
- `presignUpload(key, mime)` 返回 `{ uploadUrl, headers, expiresIn }`；Cloudflare 保留十分钟 PUT、签入 Content-Type 与 If-None-Match，已确认文件不可覆盖。
- `presignDownload(key, attachment?)` 返回 URL；Cloudflare 保留五分钟 GET，显式下载的 attachment 响应头参与签名。

`MediaOutputCopier(key, output, limits)` 返回实际存储的 `{ mime, size }`。adapter 负责禁重定向的 HTTPS 域名白名单下载、响应 MIME 匹配、实际字节限额和流释放，不能仅信任 Content-Length。对象写入失败应拒绝；`persistMediaOutputs` 负责 pending 记录、空间锁、最终配额确认、重放幂等与失败清理。Cloudflare copier 保留 FixedLengthStream 长度检查、未知长度的 5 MiB multipart 与 abort 清理。

`cleanupFiles` 仅要求 `Pick<Storage, 'delete'>`，原 R2 bucket 也结构兼容。分享 token 的授权、撤销和租户校验仍由业务函数执行。

## 验证

`pnpm --filter @xuanxue/storage typecheck` 分别检查中立、Cloudflare 与 CF 测试；`pnpm --filter @xuanxue/storage test` 运行 CF 签名单元用例及文件/媒体集成用例，集成需要本 worktree 或 CI 隔离数据库配置。
