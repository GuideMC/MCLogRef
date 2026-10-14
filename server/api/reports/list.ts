import { getReports } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  try {
    const query = getQuery(event)
    const page = Math.max(1, Math.floor(Number(query.page) || 1))
    const pageSize = Math.min(200, Math.max(1, Math.floor(Number(query.pageSize) || 100)))
    const statusValue = typeof query.status === 'string' && query.status !== '' ? Number(query.status) : undefined
    const status = statusValue !== undefined && [0, 1, 2].includes(statusValue) ? statusValue : undefined
    const isDate = (value: unknown): value is string => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
      const date = new Date(`${value}T00:00:00Z`)
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    }
    const filters = {
      q: typeof query.q === 'string' ? query.q.trim().slice(0, 200) : undefined,
      error: typeof query.error === 'string' ? query.error.trim().slice(0, 200) : undefined,
      version: typeof query.version === 'string' ? query.version.trim().slice(0, 100) : undefined,
      loader: typeof query.loader === 'string' ? query.loader.trim().slice(0, 100) : undefined,
      status,
      from: isDate(query.from) ? query.from : undefined,
      to: isDate(query.to) ? query.to : undefined,
    }
    return { status: 200, data: getReports(pageSize, (page - 1) * pageSize, filters) }
  } catch {
    return { status: 500, data: { message: 'Getting List Failed' } }
  }
})
