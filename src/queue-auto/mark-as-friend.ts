import { collections } from '../database/collections'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import { QueueState } from '../database/models/queue-state.model'
import { errors } from '../errors'
import { events } from '../events'
import { logger } from '../logger'
import type { SteamId64 } from '../shared/types/steam-id-64'
import { getState } from '../queue/get-state'
import type { QueueId } from '../queue/types/queue-id'
import { withQueueLock } from '../queue/with-queue-lock'

export async function markAsFriend(
  queue: QueueId,
  source: SteamId64,
  target: SteamId64 | null,
): Promise<QueueSlotModel | null> {
  return await withQueueLock('mark-as-friend', async () => {
    logger.trace({ queue, source, target }, `queue.markAsFriend()`)

    const queueState = await getState(queue)
    if (queueState === QueueState.launching) {
      throw errors.badRequest('cannot mark as friend at this stage')
    }

    const sourceSlot = await collections.queueSlots.findOne({
      queue,
      'player.steamId': source,
    })
    if (!sourceSlot) {
      throw errors.notFound(`source slot not found: ${source}`)
    }

    if (target === null) {
      const friendship = await collections.queueFriends.findOne({ queue, source })
      if (!friendship) {
        throw errors.notFound(`friendship not found: ${source}`)
      }
      const targetSlot = await collections.queueSlots.findOne({
        queue,
        'player.steamId': friendship.target,
      })
      await collections.queueFriends.deleteOne({ queue, source })
      events.emit('queue/friendship:removed', { queue, source, target: friendship.target })
      return targetSlot
    } else {
      const targetSlot = await collections.queueSlots.findOne({
        queue,
        'player.steamId': target,
      })
      const friendship = await collections.queueFriends.findOne({ queue, source })
      const after = await collections.queueFriends.findOneAndUpdate(
        { queue, source },
        { $set: { target } },
        { upsert: true, returnDocument: 'after' },
      )
      if (!after) {
        throw errors.badRequest(`failed to update friendship: ${source} -> ${target}`)
      }
      if (friendship) {
        events.emit('queue/friendship:updated', {
          queue,
          source,
          target: { before: friendship.target, after: after.target },
        })
      } else {
        events.emit('queue/friendship:created', { queue, source, target: after.target })
      }
      return targetSlot
    }
  })
}
