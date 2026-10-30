import { createFileRoute } from '@tanstack/react-router'
import { getPickerModels } from '../../../../features/ai/model-picker.functions.ts'

// 对话区布局：读一次当前空间可用的文本模型，供列表页与对话页共用。
// 一个也没有时（specs/ai-chat「无可用模型时隐藏对话入口」），列表页只显示多语言空态与购买积分入口，
// 对话页保留历史消息但以空态取代输入框。
export const Route = createFileRoute('/app/$slug/chat')({
  beforeLoad: async ({ params }) => ({
    chatModels: await getPickerModels({ data: { slug: params.slug, kind: 'text' } }),
  }),
})
