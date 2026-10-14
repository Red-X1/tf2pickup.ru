import { collections } from '../database/collections'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import type { QueueId } from '../queue/types/queue-id'

export async function getSlots(queue: QueueId): Promise<QueueSlotModel[]> {
  return await collections.queueSlots.find({ queue }).toArray()
}
