import { loadEmbeddingModel } from '../utils/llama'
import { hasSearchableVectors } from '../utils/database/lance'

export default defineNitroPlugin(async () => {
  try {
    if (await hasSearchableVectors()) await loadEmbeddingModel()
  } catch (error) {
    console.warn('[Preload] 加载嵌入模型失败：', error)
  }
})
