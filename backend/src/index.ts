import 'dotenv/config'
import { buildServer } from './server.js'
import { config } from './config.js'

async function main() {
  const app = await buildServer()
  await app.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`KampKollen running on http://0.0.0.0:${config.port}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
