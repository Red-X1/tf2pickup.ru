import { collections } from '../database/collections'
import type { MapPoolEntry } from '../database/models/map-pool-entry.model'
import { events } from '../events'
import type { QueueId } from '../queue/types/queue-id'
import { mapPool } from './pool'

export async function resetMapOptions(queue: QueueId) {
  if ((await collections.maps.countDocuments({ queue })) === 0) {
    await mapPool.reset(queue)
  }

  const choices = await collections.maps
    .aggregate<MapPoolEntry>([
      {
        $match: {
          queue,
          $or: [
            {
              cooldown: {
                $eq: 0,
              },
            },
            {
              cooldown: {
                $exists: false,
              },
            },
          ],
        },
      },
      { $sample: { size: 3 } },
    ])
    .toArray()
  await collections.queueMapOptions.deleteMany({ queue })
  await collections.queueMapOptions.insertMany(choices.map(({ name }) => ({ queue, name })))
  await collections.queueMapVotes.deleteMany({ queue })
  events.emit('queue/mapOptions:reset', { queue, mapOptions: choices.map(({ name }) => name) })
}
