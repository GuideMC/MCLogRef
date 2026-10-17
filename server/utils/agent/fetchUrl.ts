import { USER_AGENT, errorText, fetchTimeout, htmlText, optionalString, truncate, type ToolDefinition } from '../tool'

export const fetchUrl: ToolDefinition = {
  name: 'fetch_url',
  description: '抓取网页文本内容。',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', description: '路径：https://example.com/' } },
    required: ['url'],
  },
  async handler(args) {
    const url = optionalString(args, 'url')
    if (!/^https?:\/\//i.test(url)) return '错误：非网页'
    try {
      const response = await fetchTimeout(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
      if (!response.ok) return `抓取失败：HTTP ${response.status}`
      const contentType = response.headers.get('content-type') ?? ''
      const body = await response.text()
      const text = contentType.includes('html') ? htmlText(body) : body
      if (!text) return '无可读文本'
      return `来源：${url}\n\n${truncate(text, 12000)}`
    } catch (err) {
      return `抓取失败：${errorText(err)}`
    }
  },
}
