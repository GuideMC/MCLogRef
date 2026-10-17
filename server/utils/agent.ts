import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { getConfig, type ToolConfig } from './config'
import {
  AGENT_PROMPT, analyzeStream, buildContext, buildPrompt, resolveApi, streamCompletion,
  type ApiConfig, type ApiOptions, type ChatMessage, type ReportContext, type ToolCall,
} from './analyse'
import { builtinTools, errorText, toolSchema, truncate, type ToolContext, type ToolDefinition } from './tool'

export interface AgentEvent {
  type: 'content' | 'tool_call' | 'tool_result' | 'done'
  content?: string
  done?: boolean
  id?: string
  name?: string
  args?: string
  result?: string
  ok?: boolean
}

export type AnalysisOptions = ApiOptions & { tools?: boolean }

interface McpConnection {
  client: Client
  tools: ToolDefinition[]
}

let cache: { signature: string; connections: McpConnection[] } | null = null

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  promise.catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function extractTexts(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const texts: string[] = []
  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const block = item as { type?: string; text?: unknown }
    if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text)
  }
  return texts.join('\n')
}

async function connectServer(name: string, tool: ToolConfig): Promise<McpConnection> {
  const client = new Client({ name: 'mclogref', version: '1.0.0' }, { capabilities: {} })
  const transport = new StdioClientTransport({
    command: tool.command ?? '',
    args: tool.args || [],
    env: Object.fromEntries([...Object.entries(process.env), ...Object.entries(tool.env || {})].filter(([, value]) => value !== undefined)) as Record<string, string>,
    stderr: 'ignore',
  })
  await withTimeout(client.connect(transport), 30000, '连接超时')
  const { tools } = await client.listTools()
  const prefix = `mcp__${name.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}__`
  const converted: ToolDefinition[] = tools.map(item => ({
    name: `${prefix}${item.name}`,
    description: item.description || `Tool of MCP Server ${name}`,
    parameters: (item.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>,
    handler: async (args) => {
      try {
        const result = await client.callTool({ name: item.name, arguments: args })
        return truncate(extractTexts(result.content))
      } catch (err) {
        return `MCP 工具调用失败：${errorText(err)}`
      }
    },
  }))
  return { client, tools: converted }
}

export async function loadMcp(): Promise<ToolDefinition[]> {
  const servers = Object.entries(getConfig().tools || {}).filter(([, tool]) => tool.enabled !== false && !!tool.command)
  if (servers.length === 0) {
    await closeMcp()
    return []
  }
  const signature = JSON.stringify(servers)
  if (cache && cache.signature === signature) return cache.connections.flatMap(connection => connection.tools)
  await closeMcp()
  const connections: McpConnection[] = []
  for (const [name, tool] of servers) {
    try {
      connections.push(await connectServer(name, tool))
    } catch (err) {
      console.warn(`[MCP] 连接 ${name} 失败：`, errorText(err))
    }
  }
  cache = { signature, connections }
  return connections.flatMap(connection => connection.tools)
}

export async function closeMcp(): Promise<void> {
  if (!cache) return
  const connections = cache.connections
  cache = null
  await Promise.allSettled(connections.map(async (connection) => { await connection.client.close() }))
}

async function* fallbackStream(rid: number, options?: AnalysisOptions): AsyncGenerator<AgentEvent> {
  for await (const content of analyzeStream(rid, options)) {
    if (content) yield { type: 'content', content }
  }
}

async function* toolStream(rid: number, context: ReportContext, api: ApiConfig, options?: AnalysisOptions): AsyncGenerator<AgentEvent> {
  const toolStates = getConfig().tools || {}
  let mcpTools: ToolDefinition[] = []
  try {
    mcpTools = await loadMcp()
  } catch (err) {
    console.warn('[Analysis] 加载 MCP 工具失败：', errorText(err))
  }
  const tools = [...builtinTools.filter(tool => toolStates[tool.name]?.enabled !== false), ...mcpTools]
  const toolMap = new Map(tools.map(tool => [tool.name, tool]))
  const toolContext: ToolContext = { rid }
  const messages: ChatMessage[] = [
    { role: 'system', content: AGENT_PROMPT },
    { role: 'user', content: buildPrompt(context) },
  ]
  const openaiTools = toolSchema(tools)

  let turn = 0
  while (true) {
    let assistantContent = ''
    let toolCalls: ToolCall[] = []
    let streamError = ''
    for await (const event of streamCompletion(api, messages, openaiTools)) {
      if (event.error) { streamError = event.error; break }
      if (event.content) { assistantContent += event.content; yield { type: 'content', content: event.content } }
      if (event.toolCalls) toolCalls = event.toolCalls
    }
    if (streamError) {
      if (turn === 0) {
        console.warn(`[Analysis] 工具调用失败：${streamError}`)
        yield { type: 'content', content: `（当前模型不支持工具调用：${streamError}）\n\n` }
        yield* fallbackStream(rid, options)
        return
      }
      yield { type: 'content', content: `\n错误：${streamError}` }
      break
    }
    if (toolCalls.length === 0) break
    turn++

    messages.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } })),
    })
    for (const call of toolCalls) {
      yield { type: 'tool_call', id: call.id, name: call.name, args: call.arguments }
      const tool = toolMap.get(call.name)
      let ok = true
      let resultText: string
      if (!tool) {
        ok = false
        resultText = `错误：未知工具 ${call.name}`
      } else {
        try {
          const parsed = call.arguments ? JSON.parse(call.arguments) as unknown : {}
          resultText = await tool.handler(typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}, toolContext)
        } catch (err) {
          ok = false
          resultText = `工具执行失败：${errorText(err)}`
        }
      }
      resultText = truncate(resultText)
      yield { type: 'tool_result', id: call.id, name: call.name, result: truncate(resultText, 300), ok }
      messages.push({ role: 'tool', tool_call_id: call.id, content: resultText })
    }
  }
}

export async function* analysisStream(rid: number, options?: AnalysisOptions): AsyncGenerator<AgentEvent> {
  try {
    if (options?.tools === false) {
      yield* fallbackStream(rid, options)
    } else {
      const api = resolveApi(options)
      if (!api) {
        yield { type: 'content', content: '错误：未配置 LLM API' }
      } else {
        const context = await buildContext(rid)
        if (!context) yield { type: 'content', content: `错误：报告 ${rid} 不存在` }
        else yield* toolStream(rid, context, api, options)
      }
    }
  } catch (err) {
    console.error(`[Analysis] 分析报告 ${rid} 失败：`, err)
    yield { type: 'content', content: `\n错误：${errorText(err)}` }
  }
  yield { type: 'done', done: true }
}
