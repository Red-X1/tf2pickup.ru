import fp from 'fastify-plugin'
import { events } from '../../events'
import { QueueState } from '../../database/models/queue-state.model'
import { logger } from '../../logger'
import { getState } from '../../queue/get-state'
import { queueIds } from '../../queue/types/queue-id'
import { debounce } from 'es-toolkit'
import { safe } from '../../utils/safe'
import { launchGame } from '../launch-game'
import { assignGameServer } from '../assign-game-server'
import { configure } from '../rcon/configure'
import { getOrphanedGames } from '../get-orphaned-games'
import { collections } from '../../database/collections'
import { GameState } from '../../database/models/game.model'

export default fp(
  // eslint-disable-next-line @typescript-eslint/require-await
  async app => {
    const launchGameDebounced = new Map<string, ReturnType<typeof debounce>>()

    events.on('queue/state:updated', ({ queue, state }) => {
      if (state === QueueState.launching) {
        const existing = launchGameDebounced.get(queue)
        const fn =
          existing ??
          debounce(
            safe(() => launchGame(queue)),
            100,
          )
        launchGameDebounced.set(queue, fn)
        fn()
      }
    })

    app.addHook('onListen', async () => {
      for (const queue of queueIds) {
        if ((await getState(queue)) === QueueState.launching) {
          void launchGame(queue)
        }
      }

      const orphanedGames = await getOrphanedGames()
      for (const game of orphanedGames) {
        try {
          await assignGameServer(game.number, { retries: 3 })
          void configure(game.number)
        } catch (error) {
          logger.error(
            { error, gameNumber: game.number },
            'failed to assign server to orphaned game',
          )
        }
      }

      const pendingGames = await collections.games
        .find({
          state: { $in: [GameState.created, GameState.configuring] },
          'gameServer.pendingTaskId': { $exists: true },
        })
        .toArray()

      for (const game of pendingGames) {
        logger.info(
          { gameNumber: game.number, pendingTaskId: game.gameServer?.pendingTaskId },
          'resuming configure for game with pending tf2QuickServer task',
        )
        void configure(game.number)
      }
    })
  },
  {
    name: 'launch new game',
    encapsulate: true,
  },
)
