/**
 * 西方站精选区主卡的样例图形（设计稿 content-growth-v2-tools/HomeWest.dc.html）：三张牌背，纯装饰、对读屏隐藏。
 * 与抽牌页的内联牌背（features/tools/tarot/card.tsx CardBack）同一画法；这里单独一份，
 * 首页因此不加载塔罗牌组与牌义数据。
 */
export function WestSampleCards() {
  return (
    <div
      aria-hidden="true"
      data-sample-cards
      className="mx-auto grid w-full max-w-75 grid-cols-3 gap-3"
    >
      {['past', 'present', 'future'].map((slot) => (
        <span
          key={slot}
          className="flex aspect-3/5 items-center justify-center rounded-field bg-surface-2 ring-1 ring-line-strong ring-inset"
        >
          <svg viewBox="0 0 44 44" className="w-1/2 max-w-14" fill="none" aria-hidden="true">
            <circle
              cx="22"
              cy="22"
              r="19"
              className="text-illus"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M22 6l3.5 12.5L38 22l-12.5 3.5L22 38l-3.5-12.5L6 22l12.5-3.5z"
              className="text-mark"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ))}
    </div>
  )
}
