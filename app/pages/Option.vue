<template>
  <div class="flex flex-col gap-6 p-8 min-h-screen w-full">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold text-slate-800">配置选项</h2>
      </div>
      <div class="flex items-center gap-4">
        <svg v-if="status === 'success'" class="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <svg v-else-if="status === 'error'" class="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <Button variant="primary" size="md" :disabled="status === 'saving'" @click="saveConfig">{{ status === 'saving' ? '保存中...' : '保存' }}</Button>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="font-bold text-slate-800">LLM 配置</h3>
          </div>
        </template>
        <div class="flex flex-col gap-6 p-6">
          <Input v-model="config.apiUrl" label="API 地址" placeholder="https://api.deepseek.com" />
          <Input v-model="config.apiKey" label="API 密钥" type="password" placeholder="sk-..." />
          <Input v-model="config.apiModel" label="模型名称" placeholder="deepseek-v4-pro" />
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-2">温度：{{ config.temperature }}</label>
            <input v-model.number="config.temperature" type="range" min="0" max="2" step="0.1" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500">
          </div>
        </div>
      </Card>
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7m-4 0v10M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3" />
              </svg>
            </div>
            <h3 class="font-bold text-slate-800">RAG 配置</h3>
          </div>
        </template>
        <div class="flex flex-col gap-6 p-6">
          <Input v-model="config.dataDir" label="数据目录" placeholder="./data" />
          <Input v-model.number="config.textChunk" label="切片字符数" type="number" />
          <Input v-model.number="config.chunkOffset" label="切片偏移量" type="number" />
          <Input v-model.number="config.searchLimit" label="搜索结果数" type="number" />
          <Input v-model.number="config.searchCandidate" label="搜索候选数" type="number" />
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-2">向量权重：{{ config.semanticWeight }}</label>
            <input v-model.number="config.semanticWeight" type="range" min="0" max="1" step="0.1" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500">
          </div>
        </div>
      </Card>
      <Card class="lg:col-span-2">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 class="font-bold text-slate-800">MCP 配置</h3>
          </div>
          <Button variant="outline" size="sm" @click="openModal()">添加 Server</Button>
        </template>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div v-for="entry in entries" :key="entry.key" class="flex items-center gap-3 px-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
              <Check :model-value="entry.enabled" size="sm" @update:model-value="updateTool(entry.name, { enabled: $event })" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-slate-700 truncate">{{ entry.name }}</p>
                <p :class="['text-xs text-slate-400 truncate', entry.mono && 'font-[Consolas,Monaco,monospace]']">{{ entry.sub }}</p>
              </div>
              <button :disabled="!entry.editable" class="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" @click="openModal(entry)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button :disabled="!entry.deletable" class="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" @click="removeTool(entry.name)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
    <Modal :model-value="editing !== null" title="MCP 配置" @update:model-value="editing = null">
      <div class="flex flex-col gap-5 pt-5">
        <template v-if="editing?.type === 'tool'">
          <Input v-for="field in toolEnvFields" :key="field.key" :model-value="toolEnvValue(editing.name, field.key)" :label="field.label" :type="field.secret ? 'password' : 'text'" :placeholder="field.placeholder" size="sm" @update:model-value="setToolEnvValue(editing.name, field.key, $event)" />
        </template>
        <template v-else>
          <Input v-model="form.name" label="名称" placeholder="github" size="sm" />
          <Input v-model="form.command" label="命令" placeholder="npx" size="sm" />
          <Input v-model="form.args" label="参数" placeholder="-y @modelcontextprotocol/server-github" size="sm" />
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500">环境变量</label>
            <textarea v-model="form.env" rows="3" placeholder="GITHUB_ACCESS_TOKEN=ghp_xxx" class="block w-full rounded-xl bg-white/80 border border-slate-200 shadow-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 text-xs text-slate-700 transition-all placeholder:text-slate-400 outline-none px-3 py-2 font-[Consolas,Monaco,monospace]" />
          </div>
        </template>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="ghost" size="md" @click="editing = null">{{ editing?.type === 'tool' ? '完成' : '取消' }}</Button>
          <Button v-if="editing?.type !== 'tool'" variant="primary" size="md" :disabled="!form.name.trim() || !form.command.trim()" @click="saveServer">{{ editing?.type === 'server' ? '保存' : '添加' }}</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>
<script setup lang="ts">
import type { AppConfig, ToolConfig } from '../../server/utils/config'
import type { ToolMeta } from '../../server/utils/tool'

type PageConfig = Omit<AppConfig, 'adminSecret'>
type Editing = { type: 'add' } | { type: 'tool'; name: string } | { type: 'server'; name: string }

interface Entry {
  key: string
  name: string
  sub: string
  mono?: boolean
  enabled: boolean
  kind: 'tool' | 'server'
  editable: boolean
  deletable: boolean
}

const status = ref<'idle' | 'saving' | 'success' | 'error'>('idle')

const config = ref<PageConfig>({
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  temperature: 0.2,
  dataDir: './data',
  textChunk: 6144,
  chunkOffset: 2048,
  searchLimit: 5,
  searchCandidate: 64,
  semanticWeight: 0.6,
  tools: {},
})

const builtinTools = ref<ToolMeta[]>([])
const editing = ref<Editing | null>(null)
const form = ref({ name: '', command: '', args: '', env: '' })

const toolEnvFields = computed(() => {
  const target = editing.value
  if (target?.type !== 'tool') return []
  return builtinTools.value.find(tool => tool.name === target.name)?.env ?? []
})

const entries = computed<Entry[]>(() => [
  ...builtinTools.value.map(tool => ({
    key: `tool:${tool.name}`,
    name: tool.name,
    sub: tool.description,
    enabled: config.value.tools[tool.name]?.enabled !== false,
    kind: 'tool' as const,
    editable: (tool.env?.length ?? 0) > 0,
    deletable: false,
  })),
  ...Object.entries(config.value.tools).filter(([, tool]) => !!tool.command).map(([name, tool]) => ({
    key: `server:${name}`,
    name,
    sub: `${tool.command} ${(tool.args ?? []).join(' ')}`,
    mono: true,
    enabled: tool.enabled !== false,
    kind: 'server' as const,
    editable: true,
    deletable: true,
  })),
])

function updateTool(name: string, patch: Partial<ToolConfig>) {
  const tools = config.value.tools
  const current = tools[name] ?? { enabled: true, env: {} }
  tools[name] = Object.assign(current, patch)
}

function toolEnvValue(name: string, key: string) {
  return config.value.tools[name]?.env?.[key] ?? ''
}

function setToolEnvValue(name: string, key: string, value: string) {
  updateTool(name, { env: { ...config.value.tools[name]?.env, [key]: value } })
}

function removeTool(name: string) {
  const rest: Record<string, ToolConfig> = {}
  for (const [key, value] of Object.entries(config.value.tools)) {
    if (key !== name) rest[key] = value
  }
  config.value.tools = rest
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
  }
  return env
}

function openModal(entry?: Entry) {
  if (entry?.kind === 'tool') {
    editing.value = { type: 'tool', name: entry.name }
    return
  }
  const tool = entry ? config.value.tools[entry.name] : undefined
  form.value = {
    name: entry?.name ?? '',
    command: tool?.command ?? '',
    args: (tool?.args ?? []).join(' '),
    env: Object.entries(tool?.env ?? {}).map(([key, value]) => `${key}=${value}`).join('\n'),
  }
  editing.value = entry ? { type: 'server', name: entry.name } : { type: 'add' }
}

function saveServer() {
  const name = form.value.name.trim()
  const command = form.value.command.trim()
  if (!name || !command) return
  const previous = editing.value?.type === 'server' ? editing.value.name : ''
  if (builtinTools.value.some(tool => tool.name === name)) return
  if (name !== previous && config.value.tools[name]) return
  const enabled = previous ? config.value.tools[previous]?.enabled !== false : true
  if (previous && previous !== name) removeTool(previous)
  updateTool(name, { enabled, env: parseEnv(form.value.env), command, args: form.value.args.split(/\s+/).filter(Boolean) })
  form.value = { name: '', command: '', args: '', env: '' }
  editing.value = null
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
  return result?.data ?? null
}

async function load() {
  try {
    const data = await request('/api/config')
    if (!data) return
    const { builtinTools: tools, ...configData } = data
    config.value = { ...config.value, ...configData }
    if (Array.isArray(tools)) builtinTools.value = tools
  } catch (error) {
    console.error('[Option] 加载配置失败：', error)
  }
}

async function saveConfig() {
  status.value = 'saving'
  try {
    await request('/api/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.value) })
    status.value = 'success'
  } catch (error) {
    status.value = 'error'
    console.error('[Option] 保存配置失败：', error)
  } finally {
    setTimeout(() => { status.value = 'idle' }, 1000)
  }
}

onMounted(load)
</script>
