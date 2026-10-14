import { collections } from '../../database/collections'
import type { MapPoolEntry } from '../../database/models/map-pool-entry.model'
import type { QueueId } from '../../queue/types/queue-id'

export async function get(queue?: QueueId): Promise<MapPoolEntry[]> {
  return await collections.maps.find(queue ? { queue } : {}).toArray()
}
