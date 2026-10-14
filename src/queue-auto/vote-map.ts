import { collections } from '../database/collections'
import { errors } from '../errors'
import { events } from '../events'
import { logger } from '../logger'
import type { SteamId64 } from '../shared/types/steam-id-64'
import type { QueueId } from '../queue/types/queue-id'
import { getMapVoteResults } from './get-map-vote-results'
import { withQueueLock } from '../queue/with-queue-lock'
import { withLogLevel } from '../utils/with-log-level'

export async function voteMap(
  queue: QueueId,
  steamId: SteamId64,
  map: string,
): Promise<Record<string, number>> {
  return await withQueueLock('vote-map', async () => {
    logger.trace({ queue, steamId, map }, 'queue.voteMap()')
    const mapCount = await collections.queueMapOptions.countDocuments({ queue, name: map })
    if (mapCount === 0) {
      throw errors.notFound('this map not an option in the vote')
    }

    const slotCount = await collections.queueSlots.countDocuments({
      queue,
      'player.steamId': steamId,
    })
    if (slotCount === 0) {
      throw withLogLevel(errors.badRequest('player not in the queue'), 'debug')
    }

    const { deletedCount } = await collections.queueMapVotes.deleteOne({
      queue,
      player: steamId,
      map,
    })
    if (deletedCount === 0) {
      await collections.queueMapVotes.findOneAndUpdate(
        { queue, player: steamId },
        { $set: { map } },
        { upsert: true },
      )
    }

    const results = await getMapVoteResults(queue)
    events.emit('queue/mapVoteResults:updated', { queue, results })
    return results
  })
}
