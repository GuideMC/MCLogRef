import { MODRINTH_HEADERS, MODRINTH_LOADERS, errorText, fetchTimeout, optionalString, type ToolDefinition } from '../tool'

export const modrinthSearch: ToolDefinition = {
  name: 'modrinth_search',
  description: '查询 Modrinth 项目内容。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '名称：sodium' },
      project: { type: 'string', description: '项目：sodium' },
      game_versions: { type: 'string', description: '版本：1.20.1' },
      loaders: { type: 'string', description: '加载器：fabric' },
    },
  },
  async handler(args) {
    const query = optionalString(args, 'query')
    const project = optionalString(args, 'project')
    if (!query && !project) return '错误：无内容'
    try {
      if (project) {
        const params = new URLSearchParams()
        const gameVersions = optionalString(args, 'game_versions')
        const loaders = optionalString(args, 'loaders')
        if (gameVersions) params.set('game_versions', JSON.stringify([gameVersions]))
        if (loaders) params.set('loaders', JSON.stringify([loaders]))
        const suffix = params.toString()
        const response = await fetchTimeout(`https://api.modrinth.com/v2/project/${encodeURIComponent(project)}/version${suffix ? `?${suffix}` : ''}`, { headers: MODRINTH_HEADERS })
        if (!response.ok) return `查询失败：HTTP ${response.status}`
        const versions = await response.json() as Array<{ version_number?: string; name?: string; version_type?: string; game_versions?: string[]; loaders?: string[]; dependencies?: Array<{ project_id?: string; dependency_type?: string }> }>
        if (versions.length === 0) return '无匹配版本'
        return `共 ${versions.length} 个版本，展示前 10 个：\n\n${versions.slice(0, 10).map((version, index) => {
          const required = (version.dependencies ?? []).filter(dep => dep.dependency_type === 'required').map(dep => dep.project_id ?? '').filter(Boolean)
          return [
            `${index + 1}. ${version.version_number ?? ''}（${version.version_type ?? ''}）`,
            `   游戏版本：${(version.game_versions ?? []).join(', ')}`,
            `   加载器：${(version.loaders ?? []).join(', ')}`,
            required.length ? `   必需依赖：${required.join(', ')}` : '',
          ].filter(Boolean).join('\n')
        }).join('\n\n')}`
      }
      const facets = encodeURIComponent('[["project_type:mod"]]')
      const response = await fetchTimeout(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=5&facets=${facets}`, { headers: MODRINTH_HEADERS })
      if (!response.ok) return `搜索失败：HTTP ${response.status}`
      const data = await response.json() as { hits?: Array<{ slug?: string; project_id?: string; title?: string; description?: string; downloads?: number; categories?: string[]; versions?: string[] }> }
      const hits = data.hits ?? []
      if (hits.length === 0) return '无结果'
      return hits.map((hit, index) => {
        const loaders = (hit.categories ?? []).filter(category => MODRINTH_LOADERS.includes(category))
        return [
          `${index + 1}. ${hit.title ?? ''}（slug: ${hit.slug ?? ''}，ID: ${hit.project_id ?? ''}）`,
          `   简介：${hit.description ?? ''}`,
          `   下载量：${hit.downloads ?? 0}；加载器：${loaders.join(', ') || '未知'}`,
          `   支持版本：${(hit.versions ?? []).slice(-8).join(', ') || '未知'}`,
        ].join('\n')
      }).join('\n\n')
    } catch (err) {
      return `查询失败：${errorText(err)}`
    }
  },
}
