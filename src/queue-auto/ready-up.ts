import { collections } from '../database/collections'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import { QueueState } from '../database/models/queue-state.model'
import { events } from '../events'
import { logger } from '../logger'
import type { SteamId64 } from '../shared/types/steam-id-64'
import { getState } from '../queue/get-state'
import type { QueueId } from '../queue/types/queue-id'
import { withQueueLock } from '../queue/with-queue-lock'
import { preReady } from '../pre-ready'
import { errors } from '../errors'

export async function readyUp(queue: QueueId, steamId: SteamId64): Promise<QueueSlotModel> {
  return await withQueueLock('ready-up', async () => {
    logger.trace({ queue, steamId }, 'queue.readyUp()')
    const state = await getState(queue)
    if (state !== QueueState.ready) {
      throw errors.badRequest('wrong queue state')
    }

    const slot = await collections.queueSlots.findOneAndUpdate(
      { queue, 'player.steamId': steamId },
      { $set: { ready: true } },
      { returnDocument: 'after' },
    )
    if (!slot) {
      throw errors.badRequest(`player not in queue: ${steamId}`)
    }

    events.emit('queue/slots:updated', { queue, slots: [slot] })
    await preReady.start(queue, steamId)
    return slot
  })
}
