import { collections } from '../database/collections'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import { QueueState } from '../database/models/queue-state.model'
import { events } from '../events'
import { logger } from '../logger'
import { Tf2ClassName } from '../shared/types/tf2-class-name'
import type { QueueId } from '../queue/types/queue-id'
import { getQueueConfig } from './config'
import { getSlots } from './get-slots'
import { getState } from '../queue/get-state'
import { resetMapOptions } from '../maps/reset-options'

export async function reset(queue: QueueId) {
  logger.trace({ queue }, 'queue.reset()')
  const slots = generateEmptyQueue(queue)
  await collections.queueSlots.deleteMany({ queue })
  await collections.queueSlots.insertMany(slots)
  await collections.queueState.updateOne(
    { queue },
    {
      $set: {
        state: QueueState.waiting,
      },
    },
    {
      upsert: true,
    },
  )
  events.emit('queue/slots:updated', { queue, slots: await getSlots(queue) })
  events.emit('queue/state:updated', { queue, state: await getState(queue) })
  await resetMapOptions(queue)
  logger.info({ queue }, 'queue reset')
}

type EmptyQueueSlot = Omit<QueueSlotModel, 'player' | 'queue'> & { player: null }

function generateEmptyQueue(queue: QueueId): (EmptyQueueSlot & { queue: QueueId })[] {
  const config = getQueueConfig(queue)
  const classCounts = Object.fromEntries(Object.keys(Tf2ClassName).map(gc => [gc, 1])) as Record<
    Tf2ClassName,
    number
  >

  const slots = config.classes.reduce<(EmptyQueueSlot & { queue: QueueId })[]>((prev, curr) => {
    const classSlots: (EmptyQueueSlot & { queue: QueueId })[] = []
    for (let i = 0; i < curr.count * config.teamCount; ++i) {
      classSlots.push({
        queue,
        id: `${curr.name}-${classCounts[curr.name]++}`,
        gameClass: curr.name,
        canMakeFriendsWith: curr.canMakeFriendsWith ?? [],
        player: null,
        ready: false,
      })
    }

    return prev.concat(classSlots)
  }, [])

  return slots
}
