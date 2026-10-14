import type { QueueId } from '../queue/types/queue-id'
import type { QueueConfig } from '../queue/types/queue-config'
import { queueConfigs } from './configs'

export function getQueueConfig(queue: QueueId): QueueConfig {
  return queueConfigs[queue]
}
