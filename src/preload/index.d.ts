import type { OkiroApi } from '../shared/api'

declare global {
  interface Window {
    okiro: OkiroApi
  }
}
