import { configuration } from '../configuration'
import { collections } from '../database/collections'
import { logger } from '../logger'
import type { QueueId } from '../queue/types/queue-id'

export async function applyMapCooldown(queue: QueueId, map: string) {
  logger.trace({ queue, map }, 'queue.applyMapCooldown()')
  await collections.maps.updateMany(
    { queue, name: { $ne: map }, cooldown: { $gt: 0 } },
    { $inc: { cooldown: -1 } },
  )
  const cooldown = (await configuration.get('queue.map_cooldown'))[queue]
  await collections.maps.updateOne({ queue, name: map }, { $set: { cooldown } })
}
