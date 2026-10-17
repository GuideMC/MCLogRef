import { getConfig } from './config'
import { searchCases } from './agent/searchCases'
import { readReport } from './agent/readReport'
import { webSearch } from './agent/webSearch'
import { fetchUrl } from './agent/fetchUrl'
import { githubSearch } from './agent/githubSearch'
import { githubFile } from './agent/githubFile'
import { modrinthSearch } from './agent/modrinthSearch'

export interface ToolContext {
  rid: number
}

export interface EnvField {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  env?: EnvField[]
  parameters: Record<string, unknown>
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<string>
}

export interface ToolMeta {
  name: string
  description: string
  env: EnvField[]
}

export interface OpenAITool {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export function getEnv(name: string, fields: EnvField[] = []): Record<string, string> {
  const stored = getConfig().tools?.[name]?.env ?? {}
  const keys = fields.length > 0 ? fields.map(field => field.key) : Object.keys(stored)
  const env: Record<string, string> = {}
  for (const key of keys) env[key] = process.env[key] || stored[key] || ''
  return env
}

export function fetchTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(30000) })
}
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
export const MODRINTH_HEADERS = { 'User-Agent': 'MCLogRef/1.0 (github.com/YisRime)' }
export const MODRINTH_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'modloader', 'rift', 'risugami']

export function truncate(text: string, limit: number = 8192): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n…（共 ${text.length} 字符）`
}

export function optionalString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, '\'')
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

export function htmlText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article|pre|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(stripped)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function githubHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'MCLogRef' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export const builtinTools: ToolDefinition[] = [
  searchCases,
  readReport,
  webSearch,
  fetchUrl,
  githubSearch,
  githubFile,
  modrinthSearch,
]

export function toolSchema(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }))
}
