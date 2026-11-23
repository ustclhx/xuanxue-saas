import { cn } from '@xuanxue/ui'
import { FactTable, PageWidth } from '@xuanxue/ui/project'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { AlmanacDisclaimer, AlmanacHeader, AlmanacProse, Mark, Tile } from '../almanac/parts.tsx'
import { ALMANAC_TOOL_PATHS } from '../almanac/paths.ts'
import { TAI_SUI_COPY as copy } from './copy.ts'
import type { TaiSuiRow, TaiSuiYearPageData } from './page.functions.ts'
import { TAI_SUI_YEAR_LOCALE } from './paths.ts'

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const href = (path: string) => toolHref(path, TAI_SUI_YEAR_LOCALE)

/**
 * 年度太歲页（openspec content-growth-v2-tools 决策 10，第 18 组）。沿用第 2 阶段已确认的黄历 / 生肖版式
 * （页首、Tile、FactTable、正文排版与 FAQ），没有新区块：年份资料卡、十二生肖关系表（引擎）、撰写正文、FAQ。
 * 关系表段以 data-table-section 标记；不出现消灾方法、法會報名或商品链接。
 */
export function TaiSuiYearPage({ page }: { page: TaiSuiYearPageData }) {
  const ganzhi = `${copy.stem(page.stem)}${copy.branch(page.branch)}`
  return (
    <MarketingShell>
      <PageWidth className="flex flex-col gap-10 pb-16 sm:gap-14 sm:pb-28">
        <AlmanacHeader
          crumbs={[
            { name: copy.home, href: href('/') },
            { name: copy.almanacCrumb, href: href(ALMANAC_TOOL_PATHS[TAI_SUI_YEAR_LOCALE]) },
            { name: copy.crumb(page.year) },
          ]}
          title={page.heading}
        >
          <p className="m-0">{page.lede}</p>
        </AlmanacHeader>

        <section
          aria-label={copy.factsLabel}
          data-locale-fixed
          className="grid max-w-190 grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <Tile label={copy.factYear} value={`${ganzhi}・屬${copy.zodiac(page.branch)}`} />
          {page.nayinIndex !== null && (
            <Tile label={copy.factNayin} value={copy.nayin(page.nayinIndex)} />
          )}
          {page.lichun && (
            <Tile
              label={copy.factLichun}
              value={copy.monthDay(page.lichun.month, page.lichun.day)}
            />
          )}
          {page.lunarNewYear && (
            <Tile
              label={copy.factLunarNewYear}
              value={copy.monthDay(page.lunarNewYear.month, page.lunarNewYear.day)}
            />
          )}
        </section>

        <section
          aria-labelledby="tai-sui-table"
          data-table-section=""
          className="flex flex-col gap-5"
        >
          <h2 id="tai-sui-table" className={h2}>
            {copy.tableTitle(page.year, ganzhi)}
          </h2>
          <p className="m-0 max-w-180 text-body text-ink-muted">{page.tableNote}</p>
          <FactTable
            caption={copy.tableCaption(page.year)}
            rows={page.rows}
            rowKey={(row) => row.branch}
            isCurrent={(row) => row.relations.some(copy.isTaiSui)}
            stack
            containerProps={{ 'data-locale-fixed': true }}
            columns={[
              {
                key: 'zodiac',
                header: copy.colZodiac,
                kind: 'key',
                cell: (row: TaiSuiRow) =>
                  copy.zodiacCell(copy.zodiac(row.branch), copy.branch(row.branch)),
              },
              {
                key: 'relation',
                header: copy.colRelation,
                stacked: 'label',
                cell: (row: TaiSuiRow) =>
                  row.relations.length ? (
                    <span className="inline-flex flex-wrap gap-1.5">
                      {row.relations.map((relation) => (
                        <span
                          key={relation}
                          className={cn(copy.isTaiSui(relation) && 'font-medium text-ink')}
                        >
                          {copy.isTaiSui(relation) ? (
                            copy.relation(relation)
                          ) : (
                            <Mark>{copy.relation(relation)}</Mark>
                          )}
                        </span>
                      ))}
                    </span>
                  ) : (
                    copy.none
                  ),
              },
              {
                key: 'years',
                header: copy.colYears,
                stackLabel: copy.colYearsShort,
                stacked: 'full',
                cell: (row: TaiSuiRow) => row.years.join(copy.yearsJoin),
              },
            ]}
          />
        </section>

        <article className="flex max-w-180 flex-col gap-5">
          <AlmanacProse html={page.html} />
          <AlmanacDisclaimer text={copy.disclaimer} />
        </article>

        <ToolFaq
          title={copy.faqTitle}
          items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))}
        />
      </PageWidth>
    </MarketingShell>
  )
}
