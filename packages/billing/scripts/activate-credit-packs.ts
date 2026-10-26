#!/usr/bin/env -S node --experimental-strip-types
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from '@xuanxue/db'
import { activateCreditPackMappings } from '../src/catalog.ts'

// 只读取显式注入的进程环境，不回退到本地 dotenv 或 worktree 数据库。
export function activationDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
  if (!value) throw new Error('Explicit billing database URL is required')
  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new Error('Invalid billing database URL')
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol))
    throw new Error('Expected a PostgreSQL billing database URL')
  const database = decodeURIComponent(target.pathname.slice(1))
  if (!database || env.BILLING_ACTIVATE_CONFIRM !== database)
    throw new Error('BILLING_ACTIVATE_CONFIRM must match the target database name')
  return value
}

async function activate(connectionString: string) {
  const db = createDb({ connectionString })
  try {
    console.log(
      `Activated ${await activateCreditPackMappings(db, 'paypal')} credit pack price mapping changes.`,
    )
  } finally {
    await db.$client.end()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let connectionString: string
  try {
    // 校验错误只包含固定文本；数据库驱动错误可能包含连接信息，不直接打印。
    connectionString = activationDatabaseUrl()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid activation configuration')
    process.exit(1)
  }
  try {
    await activate(connectionString)
  } catch {
    console.error('Credit pack activation failed')
    process.exitCode = 1
  }
}
