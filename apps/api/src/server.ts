import 'dotenv/config'
import { createApp } from './app'
import { logger } from './shared/logger'

const port = Number(process.env['API_PORT'] ?? 3001)
const app = createApp()

app.listen(port, () => {
  logger.info({ port }, `CashMind API running`)
})
