import fp from 'fastify-plugin'
import { collections } from '../../database/collections'
import { logger } from '../../logger'
import { queueIds } from '../../queue/types/queue-id'
import { reset } from '../reset'

export default fp(
  async () => {
    for (const queue of queueIds) {
      const slotCount = await collections.queueSlots.countDocuments({ queue })
      if (slotCount === 0) {
        logger.info({ queue }, `no queue initialized, initializing one now...`)
        await reset(queue)
      }
    }
  },
  {
    name: 'initialize empty queues',
  },
)
