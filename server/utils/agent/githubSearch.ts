import { errorText, fetchTimeout, getEnv, githubHeaders, optionalString, stripTags, truncate, type EnvField, type ToolDefinition } from '../tool'

const ENV: EnvField[] = [
  { key: 'GITHUB_TOKEN', label: 'GitHub Token', secret: true, placeholder: 'ghp_xxx' },
]

export const githubSearch: ToolDefinition = {
  name: 'github_search',
  description: '搜索 GitHub 内容，包括 Code 与 Issue。',
  env: ENV,
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '关键词：Mod 名称/错误内容' },
      type: { type: 'string', enum: ['code', 'issue'], description: '类型：code/issue' },
      repo: { type: 'string', description: '仓库：owner/name' },
    },
    required: ['query'],
  },
  async handler(args) {
    const query = optionalString(args, 'query')
    if (!query) return '错误：无内容'
    const repo = optionalString(args, 'repo')
    const searchQuery = repo ? `${query} repo:${repo}` : query
    const { GITHUB_TOKEN = '' } = getEnv('github_search', ENV)
    try {
      if (optionalString(args, 'type') === 'issue') {
        const response = await fetchTimeout(`https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=8`, { headers: githubHeaders(GITHUB_TOKEN) })
        if (!response.ok) return `搜索失败：HTTP ${response.status}`
        const data = await response.json() as { total_count?: number; items?: Array<{ title?: string; state?: string; html_url?: string; body?: string }> }
        const items = data.items ?? []
        if (items.length === 0) return '无结果'
        return `共 ${data.total_count ?? items.length} 条，展示前 ${items.length} 条：\n\n${items.map((item, index) => `${index + 1}. [${item.state === 'closed' ? '已关闭' : '开放'}] ${item.title ?? ''}\n   ${item.html_url ?? ''}\n   ${truncate(stripTags((item.body ?? '').replace(/\r?\n/g, ' ')), 300)}`).join('\n\n')}`
      }
      if (!GITHUB_TOKEN) return '错误：无 GitHub Token'
      const response = await fetchTimeout(`https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=10`, { headers: githubHeaders(GITHUB_TOKEN) })
      if (!response.ok) return `搜索失败：HTTP ${response.status}`
      const data = await response.json() as { total_count?: number; items?: Array<{ repository?: { full_name?: string }; path?: string; html_url?: string }> }
      const items = data.items ?? []
      if (items.length === 0) return '无结果'
      return `共 ${data.total_count ?? items.length} 条，展示前 ${items.length} 条：\n\n${items.map((item, index) => `${index + 1}. ${item.repository?.full_name ?? ''} / ${item.path ?? ''}\n   ${item.html_url ?? ''}`).join('\n')}`
    } catch (err) {
      return `搜索失败：${errorText(err)}`
    }
  },
}
