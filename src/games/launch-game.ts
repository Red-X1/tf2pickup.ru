import type { GameModel } from '../database/models/game.model'
import { logger } from '../logger'
import { getFriends } from '../queue-auto/get-friends'
import { getMapWinner } from '../queue-auto/get-map-winner'
import { getSlots } from '../queue-auto/get-slots'
import { unreadyQueue } from '../queue-auto/unready-queue'
import type { QueueId } from '../queue/types/queue-id'
import { assignGameServer } from './assign-game-server'
import { create } from './create'
import { configure } from './rcon/configure'

export async function launchGame(queue: QueueId) {
  logger.info({ queue }, 'launching game')

  let game: GameModel
  try {
    const slots = await getSlots(queue)
    const map = await getMapWinner(queue)
    const friends = await getFriends(queue)
    logger.trace({ queue, slots, map, friends }, 'launchGame()')
    game = await create(queue, slots, map, friends)
  } catch (error) {
    logger.error({ error, queue }, 'failed to launch game; reverting queue')
    await unreadyQueue(queue)
    return
  }

  await assignGameServer(game.number, { retries: 3 })
  void configure(game.number)
}
