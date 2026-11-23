import { lazyRouteComponent, notFound } from '@tanstack/react-router'
import { createElement, type ReactNode } from 'react'
import type { pageHead } from '../seo/metadata.ts'
import type { WestContentRoute } from './routes.ts'

export interface WestContentPayload {
  readonly head: ReturnType<typeof pageHead>
  readonly content: unknown
}

export interface WestContentData extends WestContentPayload {
  readonly route: WestContentRoute
}

interface WestContentCollectionModule {
  readonly load: (
    route: WestContentRoute,
    search: Readonly<Record<string, unknown>>,
  ) => Promise<WestContentPayload | null>
  readonly Page: (props: { data: WestContentData }) => ReactNode
}

// 每个集合在 <集合>/route-data.ts 或 .tsx 导出 load 与 Page。
// Vite 为各集合生成独立的动态 import，loader 只预载匹配的集合。
const modules = import.meta.glob<WestContentCollectionModule>('./*/route-data.{ts,tsx}')
const collections = new Map(
  Object.entries(modules).map(([path, importModule]) => [
    path.split('/')[1],
    { importModule, Page: lazyRouteComponent(importModule, 'Page') },
  ]),
)

export async function loadWestContent(
  route: WestContentRoute,
  search: Readonly<Record<string, unknown>> = {},
): Promise<WestContentData> {
  const collection = collections.get(route.collection)
  if (!collection) throw notFound()
  const [{ load }] = await Promise.all([collection.importModule(), collection.Page.preload?.()])
  const payload = await load(route, search)
  if (!payload) throw notFound()
  return { route, ...payload }
}

export function WestContentPage({ data }: { data: WestContentData }) {
  const Page = collections.get(data.route.collection)?.Page
  return Page ? createElement(Page, { data }) : null
}
