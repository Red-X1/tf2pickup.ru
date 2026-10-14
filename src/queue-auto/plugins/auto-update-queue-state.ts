import fp from 'fastify-plugin'
import { events } from '../../events'
import { safe } from '../../utils/safe'
import { getState } from '../../queue/get-state'
import { collections } from '../../database/collections'
import { logger } from '../../logger'
import { QueueState } from '../../database/models/queue-state.model'
import { setState } from '../../queue/set-state'
import type { QueueId } from '../../queue/types/queue-id'
import { kick } from '../kick'
import { unreadyQueue } from '../unready-queue'
import { configuration } from '../../configuration'
import { tasks } from '../../tasks'

export default fp(
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => {
    async function maybeUpdateQueueState(queue: QueueId) {
      const state = await getState(queue)
      const [currentPlayerCount, readyPlayerCount, requiredPlayerCount] = await Promise.all([
        collections.queueSlots.countDocuments({ queue, player: { $ne: null } }),
        collections.queueSlots.countDocuments({ queue, ready: { $eq: true } }),
        collections.queueSlots.countDocuments({ queue }),
      ])

      logger.debug({ queue, currentPlayerCount, requiredPlayerCount })

      switch (state) {
        case QueueState.waiting: {
          if (currentPlayerCount === requiredPlayerCount) {
            logger.info({ queue }, 'queue full, wait for players to ready up')
            await readyUp(queue)
          }

          break
        }

        case QueueState.ready: {
          if (currentPlayerCount === 0) {
            await unreadyQueue(queue)
          } else if (readyPlayerCount === requiredPlayerCount) {
            logger.info({ queue }, 'all players ready, queue ready')
            await setState(queue, QueueState.launching)
            await tasks.cancel('queue:readyUpTimeout', { queue })
            await tasks.cancel('queue:unready', { queue })
          }

          break
        }
      }
    }

    async function kickUnreadyPlayers(queue: QueueId) {
      const unreadyPlayers = (
        await collections.queueSlots
          .find({ queue, player: { $ne: null }, ready: { $eq: false } })
          .toArray()
      ).map(slot => slot.player!.steamId)
      if (unreadyPlayers.length > 0) {
        await kick(queue, ...unreadyPlayers)
      }
    }

    async function readyUpTimeout({ queue }: { queue: QueueId }) {
      if ((await getState(queue)) !== QueueState.ready) {
        return
      }

      logger.info({ queue }, 'ready up timeout, kick players that are not ready')
      await kickUnreadyPlayers(queue)

      const readyStateTimeout = (await configuration.get('queue.ready_state_timeout'))[queue]
      const readyUpTimeoutMs = (await configuration.get('queue.ready_up_timeout'))[queue]

      const nextTimeout = readyStateTimeout - readyUpTimeoutMs

      if (nextTimeout > 0) {
        await tasks.schedule('queue:unready', nextTimeout, { queue })
      } else {
        await unreadyQueue(queue)
      }
    }

    async function readyUp(queue: QueueId) {
      await setState(queue, QueueState.ready)
      const timeout = (await configuration.get('queue.ready_up_timeout'))[queue]
      await tasks.schedule('queue:readyUpTimeout', timeout, { queue })
    }

    tasks.register('queue:readyUpTimeout', readyUpTimeout)
    tasks.register('queue:unready', async ({ queue }: { queue: QueueId }) => {
      if ((await getState(queue)) === QueueState.ready) {
        await unreadyQueue(queue)
      }
    })

    events.on(
      'queue/slots:updated',
      safe(async ({ queue }) => {
        await maybeUpdateQueueState(queue)
      }),
    )
  },
  { name: 'auto update queue state' },
)
