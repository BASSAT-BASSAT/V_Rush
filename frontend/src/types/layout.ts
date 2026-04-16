import type { OpInfo } from './cv'

export interface AppLayoutOutlet {
  ops: OpInfo[]
  opsError: string | null
  accessToken: string | null
}
