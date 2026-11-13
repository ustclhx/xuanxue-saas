# @xuanxue/numerology

无 IO 的毕达哥拉斯数字命理函数。日期使用 `{ year, month, day }` 公历字段，不经 UTC 转换；`personalYear(date, localYear)` 的年份须由页面按访客本地日期提供。

```ts
import { numerologyChart, compatibility } from '@xuanxue/numerology'
const birthDate = { year: 1987, month: 11, day: 29 }
const chart = numerologyChart(birthDate, 2027, 'Hélène Dupont')
// chart.lifePath.value === 11
// total 步骤：11 + 11 + 7 → 29 → 11
// chart.personalYear.value === 33：月 11、日 29 → 11、当前年 2027 → 11，11 + 11 + 11 = 33
```

`lifePath`、`birthdayNumber`、`personalYear`、`reduceNumber` 返回 `{ value, master, steps }`，步骤包含阶段、操作数与结果；11/22/33 在归约中保留。姓名数字返回 expression / soulUrge / personality，Y 仅在同一词内前后都没有 A/E/I/O/U 时作元音；没有该类字母时相应数字为 0。NFD 去重音后仅接受 A–Z、空白、连字符和撇号，未能规范化成 A–Z 的字母也报告姓名字段错误。

`numerologyChart` 在姓名错误时保留日期结果，以 `nameError` 返回字段错误；姓名为空返回 `name: null`。单独调用 `nameNumbers` / `normalizeName` 的非法输入会抛出带 `details.field = 'name'` 的 AppError。

`compatibility(firstDate, secondDate)` 返回双方生命灵数、固定等级和可本地化说明 key；表格行列次序见 `LIFE_PATH_VALUES`。该矩阵为常见流派主题的编辑综合，只供娱乐，不能用来预测关系结果。

## 每日数字

`universalDay(local)`、`personalMonth(birth, { year, month })`、`personalDay(birth, local)` 返回
`{ value, master, steps }`；`local` 必须是访客本地日期，由调用方传入，服务端不按 UTC 推断。

- 宇宙日：当日年、月、日分别归约后相加再归约，例 2026-11-13：1 + 11 + 4 = 16 → 7。
- 个人月 = 个人年 + 当月数后归约；个人日 = 个人月 + 当日数后归约。`personalDay` 的 `steps` 只含个人日一段，
  另带 `personalYear`、`personalMonth`，页面依次展示三段。例 生日 5/15 在 2026-11-13：
  个人年 5 + 6 + 1 = 12 → 3，个人月 3 + 11 = 14 → 5，个人日 5 + 4 = 9。
- 每日数字只保留 11、22 为主数（取值 1–9、11、22），33 继续归约；个人年仍按原规则保留 33。
- 算法变化时，web 侧依赖它的文案表与 `NUMEROLOGY_ENGINE_VERSION` 一并更新。
