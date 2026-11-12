import { totalmem } from 'node:os'

export const totalMemGb = (): number => Math.round(totalmem() / 1024 ** 3)

/** Best default chat model for this machine's memory. */
export function recommendedModel(): string {
  const gb = totalMemGb()
  if (gb >= 24) return 'gpt-oss:20b'
  if (gb >= 16) return 'qwen3:8b'
  return 'qwen3:4b'
}
