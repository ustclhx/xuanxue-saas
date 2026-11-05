import type { DataTableLabels } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'

// 渲染时读取当前语言，避免在模块初始化时固定为默认语言。
export function appTableLabels(): DataTableLabels {
  return {
    previous: m.app_table_previous(),
    next: m.app_table_next(),
    page: (page, pageCount) =>
      pageCount === null ? m.app_table_page({ page }) : m.app_table_page_of({ page, pageCount }),
    empty: m.app_table_empty(),
    applyFilters: m.app_table_apply(),
    resetFilters: m.app_table_reset(),
    filters: m.app_table_filters(),
    pagination: m.app_table_pagination(),
  }
}
