import { closeEmbeddingModel } from '../utils/llama'
import { closeLanceConnection } from '../utils/database/lance'
import { closeDatabase } from '../utils/database/sqlite'
import { closeMcp } from '../utils/agent'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await Promise.allSettled([
      closeEmbeddingModel(),
      closeLanceConnection(),
      closeDatabase(),
      closeMcp(),
    ])
    console.log('[Shutdown] 进程终止')
  })
})
