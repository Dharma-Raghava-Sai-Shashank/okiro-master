import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function resourcesDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'resources') : join(app.getAppPath(), 'resources')
}

export function dataDir(...parts: string[]): string {
  const dir = join(app.getPath('userData'), ...parts)
  mkdirSync(dir, { recursive: true })
  return dir
}

export const includeDir = () => join(resourcesDir(), 'include')
export const workDir = () => dataDir('work')
export const binDir = () => dataDir('bin')
