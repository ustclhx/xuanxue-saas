// 定价页与首页一行价格共用的积分数（openspec separate-landing-homepage design.md D2a、specs/home-hub
// 「定价与订阅入口」）：两处显示的数字取自这一份，首页不为此打包定价页或读取数据库。

/** 未读到运行时设置时的每份详批积分（与 packages/db 设置默认值一致） */
export const DEFAULT_READING_CREDITS = 10

/**
 * 每日登录赠送的积分数：定价页文案 `pricing_free_daily` 写的数，即运行时设置 `credits.dailyAmount` 的默认值
 * （2026-11-18「版本 B」为 5）。`home-hub.test.tsx` 断言三者一致，改默认值时一并更新。
 */
export const DAILY_LOGIN_CREDITS = 5
