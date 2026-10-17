import { getFilesByReport } from '../database/sqlite'
import { optionalString, type ToolDefinition } from '../tool'

export const readReport: ToolDefinition = {
  name: 'read_report',
  description: '读取当前案例的文件内容。',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: '文件：latest.log' },
      offset: { type: 'number', description: '偏移：0' },
      limit: { type: 'number', description: '长度：4096' },
    },
  },
  async handler(args, context) {
    const files = getFilesByReport(context.rid)
    if (files.length === 0) return '无文件'
    let target = files.find(file => file.type === 'crash') || files.find(file => file.type === 'gamelog') || files[0]!
    const keyword = optionalString(args, 'file').toLowerCase()
    if (keyword) {
      const found = files.find(file => file.file.toLowerCase() === keyword) || files.find(file => file.file.toLowerCase().includes(keyword))
      if (!found) return `错误：文件不存在；可用：${files.map(file => `${file.file}（${file.type}）`).join('、')}`
      target = found
    }
    const offset = Math.max(Number(args.offset) || 0, 0)
    const limit = Math.min(Math.max(Number(args.limit) || 4096, 512), 10240)
    const content = target.content
    if (offset >= content.length) return `错误：长度 ${content.length} > 偏移 ${offset}`
    const slice = content.slice(offset, offset + limit)
    return `文件：${target.file}（${target.type}[${offset}~${offset + slice.length}/${content.length} 字符]）\n\`\`\`text\n${slice}\n\`\`\``
  },
}
