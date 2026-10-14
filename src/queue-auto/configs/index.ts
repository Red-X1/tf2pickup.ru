import { _6v6 } from './6v6'
import { _9v9 } from './9v9'
import { ultiduo } from './ultiduo'
import type { QueueConfig } from '../../queue/types/queue-config'
import type { QueueId } from '../../queue/types/queue-id'

export const queueConfigs: Record<QueueId, QueueConfig> = {
  '6v6': _6v6,
  '9v9': _9v9,
  ultiduo,
}
