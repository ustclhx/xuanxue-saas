import type { SiteId } from '@xuanxue/config'

/** 站点标志：东方站为阴阳圆（朱砂点），西方站为四角星；内联描边 SVG，1.5px，装饰性 */
export function SiteLogo({ site }: { site: SiteId }) {
  if (site === 'east')
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M14 1.5a6.25 6.25 0 0 1 0 12.5a6.25 6.25 0 0 0 0 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="14" cy="7.75" r="1.6" className="fill-brand" />
        <circle cx="14" cy="20.25" r="1.6" fill="currentColor" />
      </svg>
    )
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
      <path
        d="M13 2l2.6 7.4L23 13l-7.4 2.6L13 23l-2.6-7.4L3 13l7.4-3.6z"
        fill="none"
        className="stroke-brand"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
