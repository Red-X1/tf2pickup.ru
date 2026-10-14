import { collections } from '../database/collections'
import { logger } from '../logger'
import { queueIds } from '../queue/types/queue-id'
import { getFriends } from './get-friends'
import { getMapVoteResults } from './get-map-vote-results'
import { getMapWinner } from './get-map-winner'
import { getSlots } from './get-slots'
import { kick } from './kick'
import { reset } from './reset'
import { unreadyQueue } from './unready-queue'
import { getState } from '../queue/get-state'

for (const queue of queueIds) {
  const slotCount = await collections.queueSlots.countDocuments({ queue })
  if (slotCount === 0) {
    logger.info({ queue }, `no queue initialized, initializing one now...`)
    await reset(queue)
  }
}

export const queue = {
  getFriends,
  getMapVoteResults,
  getMapWinner,
  getSlots,
  getState,
  kick,
  unreadyQueue,
} as const
