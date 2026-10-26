import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSecrets } from '../staging/check-secrets.mjs'

export function checkProductionSecrets(options = {}) {
  return checkSecrets({ ...options, environment: 'production' })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await checkProductionSecrets()
}
