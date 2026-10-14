import { PlayerRole } from '../../../database/models/player.model'
import { routes } from '../../../utils/routes'
import { getSlots } from '../../../queue-auto/get-slots'
import { kick } from '../../../queue-auto/kick'
import { queueIds } from '../../../queue/types/queue-id'
import { events } from '../../../events'
import { activityLog } from '../../../activity-log'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/require-await
export default routes(async app => {
  app.delete(
    '/',
    {
      config: {
        authorize: [PlayerRole.admin],
      },
      schema: {
        querystring: z.object({
          queue: z.enum(queueIds).optional(),
        }),
      },
    },
    async (request, reply) => {
      const requested = request.query.queue
      const queues = requested ? [requested] : queueIds

      let playerCount = 0
      for (const queue of queues) {
        const slots = await getSlots(queue)
        const steamIds = slots.flatMap(slot => (slot.player ? [slot.player.steamId] : []))

        if (steamIds.length > 0) {
          await kick(queue, ...steamIds)
          playerCount += steamIds.length
        }
      }

      if (playerCount > 0) {
        events.emit('queue:cleared', {
          admin: request.user!.player.steamId,
          playerCount,
        })
        await activityLog.record({
          type: 'queue cleared',
          actor: request.user!.player.steamId,
          playerCount,
        })
      }

      await reply.status(204).send()
    },
  )
})
