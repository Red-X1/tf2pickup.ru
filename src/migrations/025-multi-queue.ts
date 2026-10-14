import { MongoServerError } from 'mongodb'
import { collections } from '../database/collections'
import { queueIds } from '../queue/types/queue-id'
import { getQueueConfig } from '../queue-auto/config'
import { defaultMapPools } from '../maps/pool/reset'
import { Tf2ClassName } from '../shared/types/tf2-class-name'
import { QueueState } from '../database/models/queue-state.model'
import type { QueueSlotModel } from '../database/models/queue-slot.model'
import type { QueueId } from '../queue/types/queue-id'
import { logger } from '../logger'

const perQueueConfigurationKeys = [
  'queue.ready_up_timeout',
  'queue.ready_state_timeout',
  'queue.map_cooldown',
  'queue.require_player_verification',
  'queue.player_skill_threshold',
  'queue.pre_ready_up_timeout',
] as const

export async function up() {
  await backfillGamesQueue()
  await dropLegacySlotIdIndex()
  await reseedQueueSlots()
  await dropLegacyMapNameIndex()
  await migrateMapPool()
  await migrateMapOptions()
  await migrateConfiguration()
  await migrateDiscordBotState()
}

async function backfillGamesQueue() {
  const result = await collections.games.updateMany(
    { queue: { $exists: false } },
    { $set: { queue: '6v6' } },
  )
  logger.info({ modifiedCount: result.modifiedCount }, 'backfilled games.queue')
}

async function dropLegacySlotIdIndex() {
  try {
    await collections.queueSlots.dropIndex('id_1')
    logger.info('dropped legacy unique index queue.slots.id_1')
  } catch (error) {
    if (error instanceof MongoServerError && error.codeName === 'IndexNotFound') {
      logger.info('legacy index queue.slots.id_1 not present, nothing to drop')
      return
    }
    throw error
  }
}

async function dropLegacyMapNameIndex() {
  try {
    await collections.maps.dropIndex('name_1')
    logger.info('dropped legacy unique index maps.name_1')
  } catch (error) {
    if (error instanceof MongoServerError && error.codeName === 'IndexNotFound') {
      logger.info('legacy index maps.name_1 not present, nothing to drop')
      return
    }
    throw error
  }

  try {
    await collections.queueMapOptions.dropIndex('name_1')
    logger.info('dropped legacy unique index queue.mapoptions.name_1')
  } catch (error) {
    if (error instanceof MongoServerError && error.codeName === 'IndexNotFound') {
      logger.info('legacy index queue.mapoptions.name_1 not present, nothing to drop')
      return
    }
    throw error
  }
}

async function reseedQueueSlots() {
  // wipe-and-reseed pattern of 009-reset-queue.ts; boot seeds empty formats
  await collections.queueSlots.deleteMany({})
  for (const queue of queueIds) {
    const slots = generateEmptyQueue(queue)
    await collections.queueSlots.insertMany(slots)
    await collections.queueState.updateOne(
      { queue },
      { $set: { state: QueueState.waiting } },
      { upsert: true },
    )
  }
  logger.info('reseeded queue slots for all formats')
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

async function migrateMapPool() {
  // legacy map pool entries (pre multi-queue) had no queue field
  await collections.maps.updateMany({ queue: { $exists: false } }, { $set: { queue: '6v6' } })

  for (const queue of queueIds) {
    const count = await collections.maps.countDocuments({ queue })
    if (count === 0) {
      await collections.maps.insertMany(defaultMapPools[queue].map(map => ({ queue, ...map })))
      logger.info({ queue }, 'seeded default map pool')
    }
  }
}

async function migrateMapOptions() {
  // legacy mapoptions (pre multi-queue) had no queue field
  await collections.queueMapOptions.deleteMany({ queue: { $exists: false } })

  for (const queue of queueIds) {
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

async function migrateConfiguration() {
  for (const key of perQueueConfigurationKeys) {
    const entry = await collections.configuration.findOne({ key })
    if (entry === null) {
      continue
    }

    // already migrated
    if (typeof entry.value === 'object' && entry.value !== null) {
      continue
    }

    const scalar = entry.value
    const value = Object.fromEntries(queueIds.map(queue => [queue, scalar]))
    // the ConfigurationEntryModel union does not model the intermediate scalar→record step
    await collections.configuration.updateOne({ key }, { $set: { value } as never })
    logger.info({ key }, 'migrated configuration to per-queue record')
  }
}

async function migrateDiscordBotState() {
  const states = await collections.discordBotState.find({}).toArray()
  for (const state of states) {
    // legacy shape was promptMessageId: string
    const legacy = state as unknown as { promptMessageId?: string }
    if (legacy.promptMessageId && !state.promptMessageIds) {
      await collections.discordBotState.updateOne(
        { guildId: state.guildId },
        {
          $set: { promptMessageIds: { '6v6': legacy.promptMessageId } },
          $unset: { promptMessageId: '' },
        },
      )
    }
  }
}
