import { secondsToMilliseconds, minutesToMilliseconds } from 'date-fns'
import { collections } from '../database/collections'
import { queueIds } from '../queue/types/queue-id'
import { getQueueConfig } from '../queue-auto/config'
import { defaultMapPools } from '../maps/pool/reset'
import { QueueState } from '../database/models/queue-state.model'
import { Tf2ClassName } from '../shared/types/tf2-class-name'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import type { QueueId } from '../queue/types/queue-id'
import { logger } from '../logger'

const newQueues = ['4v4', '3v3'] as const satisfies readonly QueueId[]

const perQueueConfigurationKeys = [
  'queue.ready_up_timeout',
  'queue.ready_state_timeout',
  'queue.map_cooldown',
  'queue.require_player_verification',
  'queue.player_skill_threshold',
  'queue.pre_ready_up_timeout',
] as const

const perQueueConfigurationDefaults: Record<(typeof perQueueConfigurationKeys)[number], unknown> = {
  'queue.ready_up_timeout': secondsToMilliseconds(40),
  'queue.ready_state_timeout': secondsToMilliseconds(60),
  'queue.map_cooldown': 2,
  'queue.require_player_verification': false,
  'queue.player_skill_threshold': null,
  'queue.pre_ready_up_timeout': minutesToMilliseconds(5),
}

export async function up() {
  await seedQueueSlots()
  await seedMapPool()
  await seedMapOptions()
  await mergePerQueueConfiguration()
  await migrateWhitelistId()
}

async function seedQueueSlots() {
  for (const queue of newQueues) {
    const slotCount = await collections.queueSlots.countDocuments({ queue })
    if (slotCount > 0) {
      continue
    }
    await collections.queueSlots.insertMany(generateEmptyQueue(queue))
    await collections.queueState.updateOne(
      { queue },
      { $set: { state: QueueState.waiting } },
      { upsert: true },
    )
    logger.info({ queue }, 'seeded queue slots and state')
  }
}

type EmptyQueueSlot = Omit<QueueSlotModel, 'player' | 'queue'> & { player: null }

function generateEmptyQueue(queue: QueueId): (EmptyQueueSlot & { queue: QueueId })[] {
  const config = getQueueConfig(queue)
  const classCounts = Object.fromEntries(Object.keys(Tf2ClassName).map(gc => [gc, 1])) as Record<
    Tf2ClassName,
    number
  >

  return config.classes.reduce<(EmptyQueueSlot & { queue: QueueId })[]>((prev, curr) => {
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
}

async function seedMapPool() {
  for (const queue of newQueues) {
    const count = await collections.maps.countDocuments({ queue })
    if (count > 0) {
      continue
    }
    await collections.maps.insertMany(defaultMapPools[queue].map(map => ({ queue, ...map })))
    logger.info({ queue }, 'seeded default map pool')
  }
}

async function seedMapOptions() {
  for (const queue of newQueues) {
    const count = await collections.queueMapOptions.countDocuments({ queue })
    if (count > 0) {
      continue
    }
    const choices = await collections.maps
      .aggregate<{ name: string }>([
        { $match: { queue, $or: [{ cooldown: { $eq: 0 } }, { cooldown: { $exists: false } }] } },
        { $sample: { size: 3 } },
        { $project: { _id: 0, name: 1 } },
      ])
      .toArray()
    if (choices.length > 0) {
      await collections.queueMapOptions.insertMany(choices.map(({ name }) => ({ queue, name })))
      logger.info({ queue }, 'seeded default map options')
    }
  }
}

async function mergePerQueueConfiguration() {
  for (const key of perQueueConfigurationKeys) {
    const defaultValue = perQueueConfigurationDefaults[key]
    const entry = await collections.configuration.findOne({ key })
    if (entry === null) {
      // get() falls back to schema defaults for missing documents
      continue
    }

    if (typeof entry.value !== 'object' || entry.value === null) {
      // pre multi-queue scalar value; defensive - 025 should have converted it already
      const value = Object.fromEntries(queueIds.map(queue => [queue, entry.value]))
      await collections.configuration.updateOne({ key }, { $set: { value } as never })
      logger.info({ key }, 'migrated configuration to per-queue record')
      continue
    }

    const value = entry.value as Record<string, unknown>
    const missing = newQueues.filter(queue => !(queue in value))
    if (missing.length === 0) {
      continue
    }

    await collections.configuration.updateOne(
      { key },
      {
        $set: {
          value: {
            ...value,
            ...Object.fromEntries(missing.map(queue => [queue, defaultValue])),
          },
        } as never,
      },
    )
    logger.info({ key, queues: missing }, 'added new queues to per-queue configuration')
  }
}

async function migrateWhitelistId() {
  const key = 'games.whitelist_id'
  const entry = await collections.configuration.findOne({ key })
  if (entry === null) {
    // get() falls back to schema defaults (all null) for missing documents
    return
  }

  if (typeof entry.value !== 'object' || entry.value === null) {
    // global whitelist id keeps applying to the pre-existing formats only
    const value = {
      '6v6': entry.value,
      '9v9': entry.value,
      ultiduo: entry.value,
      '4v4': null,
      '3v3': null,
    }
    await collections.configuration.updateOne({ key }, { $set: { value } as never })
    logger.info('migrated games.whitelist_id to per-queue record')
    return
  }

  const value = entry.value as Record<string, unknown>
  const missing = newQueues.filter(queue => !(queue in value))
  if (missing.length === 0) {
    return
  }

  await collections.configuration.updateOne(
    { key },
    {
      $set: {
        value: { ...value, ...Object.fromEntries(missing.map(queue => [queue, null])) },
      } as never,
    },
  )
  logger.info({ queues: missing }, 'added new queues to games.whitelist_id')
}
