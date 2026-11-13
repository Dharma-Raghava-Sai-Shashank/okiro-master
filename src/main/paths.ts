import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function resourcesDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'resources')
  const root = app.getAppPath()
  return existsSync(join(root, 'resources')) ? join(root, 'resources') : join(root, '..', '..', 'resources')
}

export function dataDir(...parts: string[]): string {
  const dir = join(app.getPath('userData'), ...parts)
  mkdirSync(dir, { recursive: true })
  return dir
}

export const includeDir = () => join(resourcesDir(), 'include')
export const workDir = () => dataDir('work')
export const binDir = () => dataDir('bin')
