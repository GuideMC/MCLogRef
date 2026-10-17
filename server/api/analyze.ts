import { analysisStream } from '../utils/agent'
import { incrementStat } from '../utils/database/sqlite'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ rid?: number; tools?: boolean; apiUrl?: string; apiKey?: string; apiModel?: string }>(event).catch(() => null)
    const rid = Number(body?.rid || getQuery(event).rid)
    if (isNaN(rid) || rid <= 0) return { status: 400, data: { message: 'Validating Report ID' } }
    incrementStat('analyses')
    setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const options = { apiUrl: body?.apiUrl, apiKey: body?.apiKey, apiModel: body?.apiModel, tools: body?.tools !== false }
          for await (const agentEvent of analysisStream(rid, options)) controller.enqueue(`data: ${JSON.stringify({ status: 200, data: agentEvent })}\n\n`)
        } catch (err) {
          console.error('[Analyze] Streaming Analysis Failed:', err)
          const message = err instanceof Error ? err.message : 'Streaming failed'
          controller.enqueue(`data: ${JSON.stringify({ status: 500, data: { type: 'content', content: `\nError: ${message}`, done: true } })}\n\n`)
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
  } catch (err) {
    console.error('[Analyze] Handler Failed:', err)
    return { status: 500, data: { message: 'Processing Analysis Failed' } }
  }
})
