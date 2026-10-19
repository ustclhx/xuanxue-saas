/**
 * 读取 `POST /api/readings` 返回的 UI message 流（SSE，每行 `data: <JSON chunk>`），
 * 只累积正文 `text-delta`；`error` chunk 视为生成失败。报告页不需要会话历史与工具调用，
 * 因此不引入 useChat。
 */
export interface StreamProgress {
  readonly text: string
  readonly done: boolean
  readonly failed: boolean
}

export function applyChunk(state: StreamProgress, chunk: unknown): StreamProgress {
  if (typeof chunk !== 'object' || chunk === null) return state
  const { type, delta } = chunk as { type?: unknown; delta?: unknown }
  if (type === 'text-delta' && typeof delta === 'string')
    return { ...state, text: state.text + delta }
  if (type === 'error') return { ...state, failed: true }
  if (type === 'finish' || type === 'abort') return { ...state, done: true }
  return state
}

/** 按 SSE 帧解析，跨读取块的半行留到下一次 */
export async function readReadingStream(
  body: ReadableStream<Uint8Array>,
  onProgress: (state: StreamProgress) => void,
): Promise<StreamProgress> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let state: StreamProgress = { text: '', done: false, failed: false }
  let buffer = ''
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    try {
      state = applyChunk(state, JSON.parse(data))
    } catch {
      // 非 JSON 帧忽略
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handle(line)
    onProgress(state)
  }
  handle(buffer)
  state = { ...state, done: true }
  onProgress(state)
  return state
}
