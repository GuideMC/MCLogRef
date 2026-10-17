import { USER_AGENT, errorText, fetchTimeout, getEnv, optionalString, stripTags, truncate, type ToolDefinition, type EnvField } from '../tool'

const ENV: EnvField[] = [
  { key: 'SEARCH_API_URL', label: 'API Url', placeholder: 'https://api.tavily.com/search' },
  { key: 'SEARCH_API_KEY', label: 'API Key', secret: true, placeholder: 'tvly-...' },
]

export const webSearch: ToolDefinition = {
  name: 'web_search',
  description: '网络搜索相关内容。',
  env: ENV,
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: '关键词：错误内容' } },
    required: ['query'],
  },
  async handler(args) {
    const query = optionalString(args, 'query')
    if (!query) return '错误：无内容'
    const { SEARCH_API_URL = '', SEARCH_API_KEY = '' } = getEnv('web_search', ENV)
    try {
      if (SEARCH_API_URL) {
        const response = await fetchTimeout(SEARCH_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: SEARCH_API_KEY, query, max_results: 6 }),
        })
        if (!response.ok) return `搜索失败：HTTP ${response.status}`
        const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> }
        const results = data.results ?? []
        if (results.length === 0) return '无结果'
        return results.map((item, index) => `${index + 1}. ${item.title || ''}\n   ${item.url || ''}\n   ${truncate(item.content || '', 400)}`).join('\n\n')
      }
      const response = await fetchTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': USER_AGENT },
      })
      if (!response.ok) return `搜索失败：HTTP ${response.status}`
      const html = await response.text()
      const results: Array<{ title: string; url: string; snippet: string }> = []
      const regex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(html)) !== null && results.length < 6) {
        const rawUrl = match[1] ?? ''
        const target = rawUrl.match(/uddg=([^&]+)/)
        results.push({ title: stripTags(match[2] ?? ''), url: target?.[1] ? decodeURIComponent(target[1]) : rawUrl, snippet: stripTags(match[3] ?? '') })
      }
      if (results.length === 0) return '无结果'
      return results.map((item, index) => `${index + 1}. ${item.title}\n   ${item.url}\n   ${item.snippet}`).join('\n\n')
    } catch (err) {
      return `搜索失败：${errorText(err)}`
    }
  },
}
