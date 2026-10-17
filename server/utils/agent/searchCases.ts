import { searchSimilar } from '../llama'
import { getReport } from '../database/sqlite'
import { errorText, optionalString, truncate, type ToolDefinition } from '../tool'

export const searchCases: ToolDefinition = {
  name: 'search_cases',
  description: '搜索本地的已有案例内容。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '内容：错误特征、异常类名' },
      rid: { type: 'number', description: 'ID：报告 ID' },
      loader: { type: 'string', description: '加载器：Forge' },
      version: { type: 'string', description: '版本：1.20.1' },
      error: { type: 'string', description: '异常：NoSuchMethodError' },
      limit: { type: 'number', description: '数量：5' },
    },
  },
  async handler(args, context) {
    const rid = Number(args.rid)
    if (Number.isInteger(rid) && rid > 0) {
      const report = getReport(rid)
      if (!report) return `错误：报告 #${rid} 不存在`
      if (!report.solution) return '无方案'
      return `报告 #${rid}（${report.name}）的解决方案：\n${truncate(report.solution, 4096)}`
    }
    const query = optionalString(args, 'query')
    if (!query) return '错误：内容非空'
    const filter: Record<string, string> = {}
    for (const key of ['loader', 'version', 'error'] as const) {
      const value = optionalString(args, key)
      if (value) filter[key] = value
    }
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10)
    let results
    try {
      results = await searchSimilar(query, limit + 2, filter)
    } catch (err) {
      return `检索失败：${errorText(err)}`
    }
    const cases = results.filter(result => result.rid !== context.rid).slice(0, limit)
    if (cases.length === 0) return '无相似案例'
    return cases.map((item, index) => {
      const report = getReport(item.rid)
      return [
        `## 案例 ${index + 1}（报告 #${item.rid}${report ? `：${report.name}` : ''}）`,
        `- 相似度：${item.score.toFixed(3)}`,
        `- 报错特征：\n\`\`\`text\n${truncate(item.text, 1024)}\n\`\`\``,
        `- 解决方案：${report?.solution ? truncate(report.solution, 1024) : '无'}`,
      ].join('\n')
    }).join('\n\n')
  },
}
