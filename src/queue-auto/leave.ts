import { collections } from '../database/collections'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import { QueueState } from '../database/models/queue-state.model'
import { events } from '../events'
import { logger } from '../logger'
import type { SteamId64 } from '../shared/types/steam-id-64'
import { getMapVoteResults } from './get-map-vote-results'
import { getState } from '../queue/get-state'
import type { QueueId } from '../queue/types/queue-id'
import { withQueueLock } from '../queue/with-queue-lock'
import { preReady } from '../pre-ready'
import { errors } from '../errors'
import { withLogLevel } from '../utils/with-log-level'

export async function leave(queue: QueueId, steamId: SteamId64): Promise<QueueSlotModel> {
  return await withQueueLock('leave', async () => {
    logger.trace({ queue, steamId }, 'queue.leave()')
    const state = await getState(queue)
    if (state === QueueState.launching) {
      throw withLogLevel(errors.badRequest('invalid queue state'), 'debug')
    }

    const slot = await collections.queueSlots.findOneAndUpdate(
      {
        queue,
        'player.steamId': steamId,
      },
      {
        $set: { player: null, ready: false },
      },
      {
        returnDocument: 'after',
      },
    )

    if (!slot) {
      throw withLogLevel(errors.badRequest('player not in the queue'), 'debug')
    }
    events.emit('queue/slots:updated', { queue, slots: [slot] })

    const { deletedCount } = await collections.queueMapVotes.deleteMany({ queue, player: steamId })
    if (deletedCount > 0) {
      events.emit('queue/mapVoteResults:updated', {
        queue,
        results: await getMapVoteResults(queue),
      })
    }

    await preReady.cancel(steamId)
    return slot
  })
}
