import { Label } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import {
  creditEstimate,
  type EstimateOptions,
  formatEstimate,
  type PickerModel,
  typicalMessageEstimate,
} from './model-picker.ts'

/** 模型下拉框；`models` 已按空间权益与启用状态过滤（`getPickerModels`） */
export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: readonly PickerModel[]
  value: string | undefined
  onChange: (id: string) => void
  disabled?: boolean
}) {
  if (models.length === 0) return <p role="status">{m.ai_chat_no_models()}</p>
  return (
    <p>
      <Label htmlFor="ai-model">{m.ai_chat_model_label()}</Label>
      <select
        id="ai-model"
        name="model"
        className="rounded-md border p-2"
        value={value ?? models[0]?.id}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.key}
          </option>
        ))}
      </select>
    </p>
  )
}

/** 提交按钮旁的预计消耗 */
export function CreditEstimateText({
  model,
  ...options
}: { model: PickerModel | undefined } & EstimateOptions) {
  if (!model) return null
  return (
    <span data-testid="credit-estimate" className="text-muted-foreground text-sm">
      <span className="sr-only">{m.ai_chat_estimate_label()}: </span>
      {formatEstimate(creditEstimate(model.pricing, options))}
    </span>
  )
}

/**
 * 对话输入区的模型名称与每条消息的预计积分（specs/ai-chat「发送前显示预计消耗」）：
 * 按模型单价 × 典型回复长度估算，只用于展示。
 */
export function ChatCostHint({
  model,
  inputTokens,
}: {
  model: PickerModel | undefined
  inputTokens: number
}) {
  if (!model) return null
  const estimate = formatEstimate(typicalMessageEstimate(model.pricing, { inputTokens }))
  return (
    <span data-testid="chat-cost-hint" className="text-muted-foreground text-sm">
      <span data-testid="chat-cost-model">{model.key}</span>
      {' · '}
      <span className="sr-only">{m.ai_chat_estimate_label()}: </span>
      <span data-testid="chat-cost-estimate">{m.ai_chat_per_message({ estimate })}</span>
    </span>
  )
}
