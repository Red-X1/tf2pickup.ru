import { collections } from '../database/collections'
import { QueueState } from '../database/models/queue-state.model'
import { logger } from '../logger'
import { setState } from '../queue/set-state'
import type { QueueId } from '../queue/types/queue-id'
import { tasks } from '../tasks'
import { unready } from './unready'

export async function unreadyQueue(queue: QueueId) {
  logger.info({ queue }, 'unready queue')
  // left over, they would fire into the queue's next ready-up
  await tasks.cancel('queue:readyUpTimeout', { queue })
  await tasks.cancel('queue:unready', { queue })
  await setState(queue, QueueState.waiting)
  const allPlayers = (
    await collections.queueSlots.find({ queue, player: { $ne: null } }).toArray()
  ).map(slot => slot.player!.steamId)
  await unready(queue, ...allPlayers)
}
