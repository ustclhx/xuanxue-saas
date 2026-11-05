import type { SiteId } from '@xuanxue/config'
import { newId } from '@xuanxue/shared'
import { describe, expect, it } from 'vitest'
import { workspaceContentDeletionStep } from '../src/features/readings/deletion.server.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

const db = createAdminTestDb()
const sql = db.$client

describe('详批删号步骤按站点隔离', () => {
  it.each<SiteId>(['east', 'west'])(
    '保留另一站报告与 %s 订阅中的另一站记录',
    async (subscriberSite) => {
      const email = `${newId()}@readings-deletion-site.example`
      const westId = newId()
      const eastId = newId()
      const ids = [westId, eastId]
      try {
        for (const [site, id] of [
          ['west', westId],
          ['east', eastId],
        ] as const) {
          await sql`insert into "user" (id,name,email,site) values (${id},'Reader',${email},${site})`
          await sql`insert into organization (id,name,slug,is_personal,site) values (${id},'Reader',${id},true,${site})`
          await sql`insert into reading (id,workspace_id,user_id,kind,input_hash,input,locale,engine_version,prompt_version,model_key,credits,content)
          values (${newId()},${id},${id},'numerology-full',${id},'{}'::jsonb,'en','test','test','test',0,'Private report')`
          const conversationId = newId()
          await sql`insert into ai_conversation (id,workspace_id,user_id,title,model_key)
          values (${conversationId},${id},${id},'Private title','test')`
          await sql`insert into ai_message (id,conversation_id,workspace_id,role,parts)
          values (${newId()},${conversationId},${id},'assistant','[{"type":"text","text":"Private content"}]'::jsonb)`
        }
        // 大小写不同仍匹配同一邮箱；订阅表保持现有的全局邮箱唯一约束。
        await sql`insert into newsletter_subscriber (id,email,site,confirm_token) values (${newId()},${email.toUpperCase()},${subscriberSite},${newId()})`
        await sql.begin((tx) =>
          workspaceContentDeletionStep.execute?.(
            { actorUserId: westId, workspaceIds: [westId], db },
            tx,
          ),
        )

        expect(await sql`select id from reading where workspace_id=${westId}`).toHaveLength(0)
        expect(await sql`select content from reading where workspace_id=${eastId}`).toEqual([
          { content: 'Private report' },
        ])
        expect(await sql`select parts from ai_message where workspace_id=${westId}`).toEqual([
          { parts: [] },
        ])
        expect(await sql`select title from ai_conversation where workspace_id=${westId}`).toEqual([
          { title: '' },
        ])
        expect(await sql`select parts from ai_message where workspace_id=${eastId}`).toEqual([
          { parts: [{ type: 'text', text: 'Private content' }] },
        ])
        expect(await sql`select title from ai_conversation where workspace_id=${eastId}`).toEqual([
          { title: 'Private title' },
        ])
        expect(
          await sql`select site from newsletter_subscriber where lower(email)=lower(${email})`,
        ).toEqual(subscriberSite === 'west' ? [] : [{ site: 'east' }])
      } finally {
        await sql`delete from newsletter_subscriber where lower(email)=lower(${email})`
        await sql`delete from reading where workspace_id in ${sql(ids)}`
        await sql`delete from ai_message where workspace_id in ${sql(ids)}`
        await sql`delete from ai_conversation where workspace_id in ${sql(ids)}`
        await sql`delete from organization where id in ${sql(ids)}`
        await sql`delete from "user" where id in ${sql(ids)}`
      }
    },
  )
})
