import { errorText, fetchTimeout, optionalString, truncate, type ToolDefinition } from '../tool'

export const githubFile: ToolDefinition = {
  name: 'github_file',
  description: '读取 GitHub 仓库内容。',
  parameters: {
    type: 'object',
    properties: {
      repo: { type: 'string', description: '仓库：owner/name' },
      path: { type: 'string', description: '路径：xxx/xxx' },
      ref: { type: 'string', description: '分支：HEAD' },
    },
    required: ['repo', 'path'],
  },
  async handler(args) {
    const repo = optionalString(args, 'repo')
    const path = optionalString(args, 'path')
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return '格式错误'
    if (!path) return '错误：路径非空'
    const ref = optionalString(args, 'ref') || 'HEAD'
    try {
      const response = await fetchTimeout(`https://raw.githubusercontent.com/${repo}/${ref}/${path}`, { headers: { 'User-Agent': 'MCLogRef' } })
      if (!response.ok) return `读取失败：HTTP ${response.status}`
      const text = await response.text()
      return `文件：${repo}/${path}（${ref}）\n\`\`\`\n${truncate(text, 12000)}\n\`\`\``
    } catch (err) {
      return `读取失败：${errorText(err)}`
    }
  },
}
