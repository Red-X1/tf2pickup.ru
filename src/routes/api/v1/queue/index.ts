import { routes } from '../../../../utils/routes'
import { getState } from '../../../../queue/get-state'
import { getSlots } from '../../../../queue-auto/get-slots'
import { getMapVoteResults } from '../../../../queue-auto/get-map-vote-results'
import { queueConfigs } from '../../../../queue-auto/configs'
import { queueIds } from '../../../../queue/types/queue-id'
import type { QueueId } from '../../../../queue/types/queue-id'
import { isQueueId } from '../../../../queue/types/queue-id'

// eslint-disable-next-line @typescript-eslint/require-await
export default routes(async app => {
  async function queueRepresentation(queue: QueueId) {
    const [state, slots, mapVoteResults] = await Promise.all([
      getState(queue),
      getSlots(queue),
      getMapVoteResults(queue),
    ])

    const config = queueConfigs[queue]

    return {
      state,
      config: {
        teamCount: config.teamCount,
        classes: config.classes.map(c => ({
          name: c.name,
          count: c.count,
          ...(c.canMakeFriendsWith ? { canMakeFriendsWith: c.canMakeFriendsWith } : {}),
        })),
      },
      slots: slots.map(slot => ({
        id: slot.id,
        gameClass: slot.gameClass,
        player: slot.player
          ? {
              steamId: slot.player.steamId,
              name: slot.player.name,
              avatarUrl: slot.player.avatarUrl,
            }
          : null,
        ready: slot.ready,
      })),
      mapVoteResults,
    }
  }

  app.get('/', async (_req, reply) => {
    const body = await queueRepresentation('6v6')
    return reply
      .type('application/hal+json')
      .status(200)
      .header('Deprecation', 'true')
      .send({
        ...body,
        _links: {
          self: { href: '/api/v1/queue' },
          queues: { href: '/api/v1/queues' },
        },
      })
  })

  app.get('/queues', async (_req, reply) => {
    const representations = await Promise.all(
      queueIds.map(async queue => ({
        queue,
        ...(await queueRepresentation(queue)),
      })),
    )

    return reply
      .type('application/hal+json')
      .status(200)
      .send({
        queues: representations,
        _links: {
          self: { href: '/api/v1/queues' },
          ...Object.fromEntries(
            queueIds.map(queue => [queue, { href: `/api/v1/queues/${queue}` }]),
          ),
        },
      })
  })

  app.get<{ Params: { queue: string } }>('/queues/:queue', async (request, reply) => {
    const { queue } = request.params
    if (!isQueueId(queue)) {
      return reply.status(404).send({ error: 'no such queue' })
    }

    const body = await queueRepresentation(queue)
    return reply
      .type('application/hal+json')
      .status(200)
      .send({
        ...body,
        _links: {
          self: { href: `/api/v1/queues/${queue}` },
          queues: { href: '/api/v1/queues' },
        },
      })
  })
})
