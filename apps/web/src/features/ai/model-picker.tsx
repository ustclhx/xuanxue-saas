import { Label, Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import type { PickerModel } from './model-picker.ts'

/** 模型下拉框；`models` 已按空间权益与启用状态过滤（`getPickerModels`） */
export function ModelPicker({
  models,
  value,
  onChange,
  disabled = false,
}: {
  models: readonly PickerModel[]
  value: string | undefined
  onChange: (id: string) => void
  disabled?: boolean
}) {
  if (models.length === 0) return <p role="status">{m.ai_chat_no_models()}</p>
  const current = models.find((model) => model.id === (value ?? models[0]?.id))
  return (
    <div>
      <Label htmlFor="ai-model">{m.ai_chat_model_label()}</Label>
      <Select name="model" value={current?.id ?? ''} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger
          id="ai-model"
          className="w-full"
          placeholder={m.ai_chat_model_label()}
          valueLabel={current?.key}
        />
        <SelectContent>
          {models.map((model, index) => (
            <SelectItem key={model.id} index={index} value={model.id}>
              {model.key}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
