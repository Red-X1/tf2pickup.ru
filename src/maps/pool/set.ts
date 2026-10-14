import { collections } from '../../database/collections'
import { mapPoolSchema, type MapPoolEntry } from '../../database/models/map-pool-entry.model'
import { events } from '../../events'
import type { QueueId } from '../../queue/types/queue-id'
import { get } from './get'

/**
 * @throws {ZodError<MapPoolEntry>}
 */
export async function set(queue: QueueId, maps: MapPoolEntry[]): Promise<MapPoolEntry[]> {
  const parsed = mapPoolSchema.parse(maps)
  await collections.maps.deleteMany({ queue })
  await collections.maps.insertMany(parsed)
  const ret = await get(queue)
  events.emit('queue/mapPool:reset', { queue, maps: ret })
  return ret
}
