import { collections } from '../database/collections'
import { queueIds } from '../queue/types/queue-id'
import { logger } from '../logger'

const key = 'games.execute_extra_commands'

export async function up() {
  const entry = await collections.configuration.findOne({ key })
  if (entry === null) {
    // get() falls back to schema defaults (all empty) for missing documents
    return
  }

  const legacy = entry.value as unknown
  if (!Array.isArray(legacy)) {
    // already a per-queue record
    return
  }

  // the legacy global list keeps applying to every queue
  const commands = legacy.filter((command): command is string => typeof command === 'string')
  const value = Object.fromEntries(queueIds.map(queue => [queue, [...commands]]))
  await collections.configuration.updateOne({ key }, { $set: { value } as never })
  logger.info('migrated games.execute_extra_commands to per-queue record')
}
