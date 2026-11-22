import { lazyRouteComponent, notFound } from '@tanstack/react-router'
import { createElement, type ReactNode } from 'react'
import type { pageHead } from '../seo/metadata.ts'
import type { EastContentRoute } from './routes.ts'

export interface EastContentPayload {
  readonly head: ReturnType<typeof pageHead>
  readonly content: unknown
}

export interface EastContentData extends EastContentPayload {
  readonly route: EastContentRoute
}

interface EastContentCollectionModule {
  readonly load: (route: EastContentRoute, date: unknown) => Promise<EastContentPayload | null>
  readonly Page: (props: { data: EastContentData }) => ReactNode
}

// 每个集合在 <集合>/route-data.ts 或 .tsx 导出 load 与 Page。
// Vite 为各集合生成独立的动态 import，loader 只预载匹配的集合。
const modules = import.meta.glob<EastContentCollectionModule>('./*/route-data.{ts,tsx}')
const collections = new Map(
  Object.entries(modules).map(([path, importModule]) => [
    path.split('/')[1],
    { importModule, Page: lazyRouteComponent(importModule, 'Page') },
  ]),
)

export async function loadEastContent(route: EastContentRoute, date?: unknown) {
  const collection = collections.get(route.collection)
  if (!collection) throw notFound()
  const [{ load }] = await Promise.all([collection.importModule(), collection.Page.preload?.()])
  const payload = await load(route, date)
  if (!payload) throw notFound()
  return { route, ...payload }
}

export function EastContentPage({ data }: { data: EastContentData }) {
  const Page = collections.get(data.route.collection)?.Page
  return Page ? createElement(Page, { data }) : null
}
