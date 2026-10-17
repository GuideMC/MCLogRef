import { searchSimilar } from './llama'
import { getReport, getTagsByReport, getFilesByReport, type Report, type Tag } from './database/sqlite'
import { getConfig } from './config'
import { chunkText } from './extract'
import { errorText, type OpenAITool } from './tool'

export interface ApiOptions {
  apiUrl?: string
  apiKey?: string
  apiModel?: string
}

export interface ApiConfig {
  endpoint: string
  apiKey: string
  apiModel: string
  temperature: number
}

interface SimilarCase {
  rid: number
  text: string
  meta: Record<string, string>
  solution: string
}

export interface ReportContext {
  report: Report
  tags: Tag[]
  mainContent: string
  similarCases: SimilarCase[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

export interface StreamEvent {
  content?: string
  toolCalls?: ToolCall[]
  error?: string
}

const OUTPUT_RULES = `  ## 诊断结果
   - **核心问题**: 根据解决方案，用一句话概括问题的原因。
   - **错误特征**: 提取关键异常，以及涉及的 Mod ID 或类名。
  ## 解决方案
   - **核心方案**: 若参考了，请给出最贴切的修复建议。
   - **详细步骤**: 分条列出操作步骤。涉及文件操作必须指明路径。
  ## 补充建议 (可选)
   - 针对内存分配、显卡驱动、Java 环境或其它风险的相关提醒。`

const DIAGNOSIS_RULES = `# 诊断逻辑

1. **Java 环境与版本匹配**
   - **特征识别**: 识别 "Unsupported class file major version" 或 "ClassMetadataNotFoundException" 等。
   - **类版本映射**: 主版本号：65 -> Java 21, 61 -> Java 17, 60 -> Java 16, 55 -> Java 11, 52 -> Java 8。
2. **依赖关系与版本不匹配**
   - **特征识别**: 搜索 "Missing or unsupported mandatory dependencies"、"requires... which is missing!"。
   - **环境错位**: 若 SERVER 环境出现 "Attempted to load class net/minecraft/client"，则误装了仅客户端的模组。
3. **模组冲突与 Mixin 注入**
   - **特征识别**: 搜索 "MixinTransformerError" 或 "InjectionError"。
   - **逻辑**: 若日志中出现 "handler$xxx$method" 模式，定位注入失败的类。
   - **硬冲突**: 若识别到 Overwrite/Redirect 导致的冲突，建议用户二选一。
   - **地物循环**: 若 "Feature order cycle"，建议安装 Cyanide 模组再分析。
4. **实体与模型崩溃**
   - **特征识别**: 搜索 "Ticking Entity"、"Rendering Block Entity" 或 "Tesselating block model"。
   - **定位**: 寻找坐标（Location）和区块信息（Region: r.x.z.mca）。
   - **方案**: 建议使用 Neruina 自动处理或 NBTExplorer/Amulet 手动删除。
5. **JVM 错误与驱动**
   - **特征识别**: 识别 "EXCEPTION_ACCESS_VIOLATION" 及生成的 hs_err_pid.log。
   - **显卡关联**: nvoglv64.dll -> NVIDIA（更新驱动），atio6axx.dll -> AMD（更新/降级驱动，关闭 XMP），ig*.dll -> Intel（关闭 VBOs 或更换 Java 8u51）。
   - **编译器错误**: 若出现 "C2 CompilerThread"，添加参数 -XX:TieredStopAtLevel=3。`

export const AGENT_PROMPT = `你是专业的 Minecraft 模组崩溃分析专家，具备自主调查能力。
你精通 Java 异常堆栈分析，了解游戏机制，擅长解决各种 Mod 之间的冲突。

# 工作方式
- 初始信息包含日志标签与核心日志。开始分析时，优先调用 search_cases 检索历史相似案例，这是最重要的参考来源。
- 信息不足时，主动调用工具深入调查，不要凭空猜测：
  - 需要更多日志细节 → read_report
  - 查找历史相似案例与方案 → search_cases（传 rid 获取完整方案）
  - 查询错误特征 / 已知问题 → web_search、github_search
  - 查看 Mod 源码 → github_search、github_file
  - 版本 / 依赖 / 兼容性 → modrinth_search
- 工具列表中还可能包含用户配置的扩展工具（名称带 mcp__ 前缀），按需使用。
- 每次工具调用后仔细阅读结果，再决定下一步；工具结果与日志矛盾时以日志为准。
- 信息充分后立即给出结论，不要做无意义的工具调用。

# 输出规范：最终回复必须包含且仅包含以下内容：
${OUTPUT_RULES}

${DIAGNOSIS_RULES}`

const RAG_PROMPT = `你是专业的 Minecraft 模组崩溃分析专家。
你精通 Java 异常堆栈分析，了解游戏机制，擅长解决各种 Mod 之间的冲突。
你需要根据用户提供的相关信息及核心日志，结合相似案例，给出解决方案。
若信息不足以准确确定原因，请加以说明，并给出可能性最高的几个排查方向。

# 输出规范：回复必须包含且仅包含以下内容：
${OUTPUT_RULES}

${DIAGNOSIS_RULES}`

function extractSignature(content: string): string {
  const { textChunk, chunkOffset } = getConfig()
  const lowerLimit = textChunk - chunkOffset
  const upperLimit = textChunk + chunkOffset
  const chunks = chunkText(content).sort((a, b) => a.priority - b.priority)
  let result = ''
  for (const chunk of chunks) {
    if (result.length + chunk.text.length > upperLimit && result.length >= lowerLimit) break
    result += (result ? '\n\n' : '') + chunk.text
    if (result.length >= upperLimit) break
  }
  return result || content.slice(0, textChunk)
}

export async function buildContext(rid: number, withCases = false): Promise<ReportContext | null> {
  const report = getReport(rid)
  if (!report) return null
  const files = getFilesByReport(rid)
  const tags = getTagsByReport(rid)
  const crashFile = files.find(file => file.type === 'crash' || file.type === 'gamelog') ?? files[0]
  const mainContent = crashFile ? extractSignature(crashFile.content) : report.name
  let similarCases: SimilarCase[] = []
  if (withCases) {
    const { searchLimit } = getConfig()
    const filter: Record<string, string> = {}
    for (const type of ['loader', 'version', 'error'] as const) {
      const tag = tags.find(item => item.type === type)
      if (tag) filter[type] = tag.value
    }
    try {
      similarCases = (await searchSimilar(mainContent, searchLimit, filter)).flatMap((result) => {
        const historyReport = getReport(result.rid)
        return historyReport?.solution ? [{ rid: result.rid, text: result.text, meta: result.meta, solution: historyReport.solution }] : []
      })
    } catch (error) {
      console.warn('[Analyse] 相似案例检索失败：', error)
    }
  }
  return { report, tags, mainContent, similarCases }
}

export function buildPrompt(context: ReportContext): string {
  const tagSummary = context.tags.map(tag => `- ${tag.type}: ${tag.value}`).join('\n')
  const base = `# 相关信息\n${tagSummary}\n# 核心日志\n\`\`\`text\n${context.mainContent}\n\`\`\``
  if (context.similarCases.length === 0) return base
  const section = context.similarCases.map((item, index) => `## 案例 ${index + 1}\n- 报错特征: \n\`\`\`text\n${item.text}\n\`\`\`\n- 解决方案: ${item.solution}`).join('\n\n')
  return `${base}\n# 相似案例\n${section}`
}

export function resolveApi(options?: ApiOptions): ApiConfig | null {
  const config = getConfig()
  const apiUrl = options?.apiUrl || config.apiUrl
  const apiKey = options?.apiKey || config.apiKey
  const apiModel = options?.apiModel || config.apiModel
  if (!apiUrl || !apiKey || !apiModel) return null
  return { endpoint: `${apiUrl}/chat/completions`, apiKey, apiModel, temperature: config.temperature }
}

export async function* streamCompletion(api: ApiConfig, messages: ChatMessage[], tools?: OpenAITool[]): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = { model: api.apiModel, stream: true, temperature: api.temperature, messages }
  if (tools && tools.length > 0) body.tools = tools
  const response = await fetch(api.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.apiKey}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    yield { error: `HTTP ${response.status} ${response.statusText}` }
    return
  }
  const reader = response.body?.getReader()
  if (!reader) {
    yield { error: '响应流读取失败' }
    return
  }
  const decoder = new TextDecoder()
  const accumulator = new Map<number, ToolCall>()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      let parsed: { choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> }
      try {
        parsed = JSON.parse(data)
      } catch (err) {
        console.error(`[Analysis] 解析响应流数据 ${data.slice(0, 256)} 失败：`, errorText(err))
        continue
      }
      const delta = parsed.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content) yield { content: delta.content }
      if (Array.isArray(delta.tool_calls)) {
        for (const call of delta.tool_calls) {
          const index = call.index ?? 0
          const entry = accumulator.get(index) ?? { id: '', name: '', arguments: '' }
          if (call.id) entry.id = call.id
          if (call.function?.name) entry.name += call.function.name
          if (call.function?.arguments) entry.arguments += call.function.arguments
          accumulator.set(index, entry)
        }
      }
    }
  }
  if (accumulator.size > 0) {
    const toolCalls = Array.from(accumulator.entries())
      .filter(([, call]) => call.name)
      .map(([index, call]) => ({ ...call, id: call.id || `call_${index}` }))
    if (toolCalls.length > 0) yield { toolCalls }
  }
}

export async function* analyzeStream(rid: number, options?: ApiOptions): AsyncGenerator<string> {
  try {
    const context = await buildContext(rid, true)
    if (!context) {
      yield `错误：报告 ${rid} 不存在`
      return
    }
    const api = resolveApi(options)
    if (!api) {
      yield '错误：未配置 LLM API'
      return
    }
    const messages: ChatMessage[] = [
      { role: 'system', content: RAG_PROMPT },
      { role: 'user', content: buildPrompt(context) },
    ]
    for await (const event of streamCompletion(api, messages)) {
      if (event.error) {
        yield `错误：内容请求失败：${event.error}`
        return
      }
      if (event.content) yield event.content
    }
  } catch (err) {
    console.error(`[Analyse] 分析报告 ${rid} 失败：`, err)
    yield `\n错误：${errorText(err)}`
  }
}
