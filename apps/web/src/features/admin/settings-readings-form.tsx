import { Button, Input } from '@xuanxue/ui'
import { type FormEvent, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getReadingSettings, saveReadingSettings } from './settings-readings.functions.ts'
import { CheckboxField, Field, NativeSelect, panelClass } from './ui.tsx'

type Saved = Awaited<ReturnType<typeof getReadingSettings>>
type Row = Saved['readings'][number]

const KIND_LABELS: Record<Row['kind'], () => string> = {
  'bazi-full': m.admin_reading_kind_bazi_full,
  'saju-full': m.admin_reading_kind_saju_full,
  'ziwei-full': m.admin_reading_kind_ziwei_full,
  'saju-compat': m.admin_reading_kind_saju_compat,
  'numerology-full': m.admin_reading_kind_numerology_full,
  'tarot-spread': m.admin_reading_kind_tarot_spread,
}

export function ReadingSettingsForm() {
  const [models, setModels] = useState<Saved['models']>()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const apply = (value: Saved) => {
    setModels(value.models)
    setRows(value.readings)
  }
  useEffect(() => {
    void getReadingSettings()
      .then((value) => {
        setModels(value.models)
        setRows(value.readings)
      })
      .catch(() => setMessage(m.admin_paid_readings_unavailable()))
  }, [])
  const update = (kind: Row['kind'], patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.kind === kind ? { ...row, ...patch } : row)))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await saveReadingSettings({ data: { readings: rows } })
      apply(await getReadingSettings())
      setMessage(result.ok ? m.admin_paid_readings_saved() : m.admin_save_failed())
    } catch {
      setMessage(m.admin_paid_readings_unavailable())
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} aria-label={m.admin_paid_readings()} className={panelClass()}>
      <h3 className="font-semibold text-lg">{m.admin_paid_readings()}</h3>
      <p className="text-muted-foreground text-sm">{m.admin_paid_readings_description()}</p>
      <fieldset disabled={!models || busy} className="grid min-w-0 gap-4">
        {rows.map((row) => {
          // 已保存的模型被停用后仍显示，避免保存时被悄悄清空
          const options =
            row.modelKey && !models?.some((model) => model.key === row.modelKey)
              ? [{ key: row.modelKey, provider: '' }, ...(models ?? [])]
              : (models ?? [])
          return (
            <div
              key={row.kind}
              className="grid min-w-0 gap-3 border-border border-b pb-4 last:border-b-0 sm:grid-cols-[1fr_auto_8rem_14rem] sm:items-end"
            >
              <p className="font-medium text-sm">{KIND_LABELS[row.kind]()}</p>
              <CheckboxField
                label={m.admin_reading_enabled()}
                checked={row.enabled}
                onChange={(event) => update(row.kind, { enabled: event.target.checked })}
              />
              <Field label={m.admin_reading_credits()} htmlFor={`reading-credits-${row.kind}`}>
                <Input
                  id={`reading-credits-${row.kind}`}
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  required
                  value={row.credits}
                  onChange={(event) => update(row.kind, { credits: Number(event.target.value) })}
                />
              </Field>
              <Field label={m.admin_reading_model()} htmlFor={`reading-model-${row.kind}`}>
                <NativeSelect
                  id={`reading-model-${row.kind}`}
                  value={row.modelKey}
                  onChange={(event) => update(row.kind, { modelKey: event.target.value })}
                >
                  <option value="">{m.admin_reading_model_unset()}</option>
                  {options.map((model) => (
                    <option key={model.key} value={model.key}>
                      {model.key}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )
        })}
        <Button type="submit" className="w-fit">
          {m.admin_save_paid_readings()}
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  )
}
