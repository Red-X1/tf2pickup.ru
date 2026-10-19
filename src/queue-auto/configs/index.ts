import { _6v6 } from './6v6'
import { _9v9 } from './9v9'
import { ultiduo } from './ultiduo'
import { _4v4 } from './4v4'
import { _3v3 } from './3v3'
import type { QueueConfig } from '../../queue/types/queue-config'
import type { QueueId } from '../../queue/types/queue-id'

export const queueConfigs: Record<QueueId, QueueConfig> = {
  '6v6': _6v6,
  '9v9': _9v9,
  ultiduo,
  '4v4': _4v4,
  '3v3': _3v3,
}
