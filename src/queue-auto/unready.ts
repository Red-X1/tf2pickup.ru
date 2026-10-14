import { collections } from '../database/collections'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import { events } from '../events'
import { logger } from '../logger'
import type { SteamId64 } from '../shared/types/steam-id-64'
import type { QueueId } from '../queue/types/queue-id'
import { withQueueLock } from '../queue/with-queue-lock'

export async function unready(queue: QueueId, ...steamIds: SteamId64[]): Promise<QueueSlotModel[]> {
  return await withQueueLock('unready', async () => {
    logger.trace({ queue, steamIds }, 'queue.unready()')
    const slots: QueueSlotModel[] = []
    for (const steamId of steamIds) {
      const slot = await collections.queueSlots.findOneAndUpdate(
        {
          queue,
          'player.steamId': steamId,
        },
        {
          $set: { ready: false },
        },
        {
          returnDocument: 'after',
        },
      )

      if (!slot) {
        continue
      }

      slots.push(slot)
    }

    if (slots.length > 0) {
      events.emit('queue/slots:updated', { queue, slots })
    }

    return slots
  })
}
