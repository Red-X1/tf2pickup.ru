import { collections } from '../database/collections'
import { QueueState } from '../database/models/queue-state.model'
import { errors } from '../errors'
import type { QueueId } from './types/queue-id'

export async function getState(queue: QueueId): Promise<QueueState> {
  const state = await collections.queueState.findOne({ queue })
  if (!state) {
    throw errors.internalServerError(`queue state unavailable: ${queue}`)
  }

  return state.state
}
