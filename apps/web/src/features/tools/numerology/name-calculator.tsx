import { type NumberResult, nameNumbers } from '@xuanxue/numerology'
import { useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { useTool } from '../context.tsx'
import { SubmitButton, TextField, ToolForm } from '../form.tsx'
import { ResultBlock } from '../result-block.tsx'
import { nameLetters, rawTotal, reductionText } from './calc.ts'
import { FieldError, NumberHeadline, StepLines } from './parts.tsx'
import { NumerologyReadingGuide } from './reading-guide.tsx'

export type NameNumberKey = 'expression' | 'soulUrge' | 'personality'
type NameResult = ReturnType<typeof nameNumbers>

export const NAME_NUMBER_COPY: Record<
  NameNumberKey,
  { id: string; title: () => string; description: () => string }
> = {
  expression: {
    id: 'expression',
    title: m.numerology_number_expression,
    description: m.numerology_desc_expression,
  },
  soulUrge: {
    id: 'soul-urge',
    title: m.numerology_number_soul_urge,
    description: m.numerology_desc_soul_urge,
  },
  personality: {
    id: 'personality',
    title: m.numerology_number_personality,
    description: m.numerology_desc_personality,
  },
}

/** 姓名数字：字母合计 → 归约（引擎只给归约步骤，合计由第一步拼回） */
export function NameNumberSteps({ result }: { result: NumberResult }) {
  return (
    <StepLines>
      <div>
        {m.numerology_letters_total({ total: rawTotal(result) })}
        {result.steps.length > 0 && ` → ${reductionText(result)}`}
      </div>
    </StepLines>
  )
}

/** 规范化后的姓名逐字母取值表：按词换行，窄屏自动折行 */
export function LetterTable({ normalized }: { normalized: string }) {
  return (
    <ResultBlock id="letters" title={m.numerology_name_letters()}>
      <p className="m-0 text-ink-subtle text-sm">
        {m.numerology_name_normalized({ name: normalized })}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {nameLetters(normalized).map((word) => (
          <ol key={word[0]?.position} className="m-0 flex list-none flex-wrap gap-1 p-0">
            {word.map(({ letter, value, position }) => (
              <li
                key={position}
                className="flex w-8 flex-col items-center rounded-md bg-surface-2 py-1"
              >
                <span className="text-ink">{letter}</span>
                <span className="text-brand text-sm tabular-nums">{value}</span>
              </li>
            ))}
          </ol>
        ))}
      </div>
    </ResultBlock>
  )
}

export function NameNumberBlock({ which, result }: { which: NameNumberKey; result: NumberResult }) {
  const copy = NAME_NUMBER_COPY[which]
  return (
    <ResultBlock id={copy.id} title={copy.title()} description={copy.description()}>
      <NumberHeadline result={result} size="sm" />
      <NameNumberSteps result={result} />
    </ResultBlock>
  )
}

/**
 * 姓名数字计算器（/name-numerology 与 soul urge / destiny 枢纽页共用）：只要求姓名，
 * 输出表达数、灵魂数、人格数与逐字母取值；`focus` 指定的数字排在最前。姓名不进入分享链接与埋点。
 */
export function NameCalculator({ focus = 'expression' }: { focus?: NameNumberKey }) {
  const { track } = useTool()
  const errorId = useId()
  const [result, setResult] = useState<NameResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const submit = (data: FormData) => {
    const name = String(data.get('name') ?? '')
    try {
      setResult(nameNumbers(name))
      setError(null)
      track('result_view')
    } catch {
      setResult(null)
      setError(name.trim() ? m.numerology_name_invalid() : m.numerology_name_required())
    }
  }
  const order: NameNumberKey[] = [
    focus,
    ...(['expression', 'soulUrge', 'personality'] as const).filter((key) => key !== focus),
  ]
  return (
    <div className="flex flex-col gap-5">
      <ToolForm label={m.numerology_name_form_label()} onSubmit={submit}>
        <TextField
          label={m.numerology_name_only_label()}
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        />
        <SubmitButton>{m.numerology_calculate()}</SubmitButton>
      </ToolForm>
      <FieldError id={errorId}>{error}</FieldError>
      {result && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            {order.map((key) => (
              <NameNumberBlock key={key} which={key} result={result[key]} />
            ))}
          </div>
          <LetterTable normalized={result.normalized} />
          <NumerologyReadingGuide />
        </div>
      )}
    </div>
  )
}
