import type { QueueId } from '../src/queue/types/queue-id'
import { isQueueId } from '../src/queue/types/queue-id'

type SlotId6v6 = `${'scout' | 'soldier'}-${1 | 2 | 3 | 4}` | `${'demoman' | 'medic'}-${1 | 2}`

type SlotId9v9 =
  `${'scout' | 'soldier' | 'pyro' | 'demoman' | 'heavy' | 'engineer' | 'medic' | 'sniper' | 'spy'}-${1 | 2}`

export type SlotId = SlotId6v6 | SlotId9v9

const classes6v6 = [
  { name: 'scout', count: 4 },
  { name: 'soldier', count: 4 },
  { name: 'demoman', count: 2 },
  { name: 'medic', count: 2 },
]

const classes9v9 = [
  { name: 'scout', count: 2 },
  { name: 'soldier', count: 2 },
  { name: 'pyro', count: 2 },
  { name: 'demoman', count: 2 },
  { name: 'heavy', count: 2 },
  { name: 'engineer', count: 2 },
  { name: 'medic', count: 2 },
  { name: 'sniper', count: 2 },
  { name: 'spy', count: 2 },
]

const classesUltiduo = [
  { name: 'soldier', count: 2 },
  { name: 'medic', count: 2 },
]

const classes4v4 = [
  { name: 'scout', count: 2 },
  { name: 'soldier', count: 2 },
  { name: 'demoman', count: 2 },
  { name: 'medic', count: 2 },
]

const classes3v3 = [
  { name: 'scout', count: 2 },
  { name: 'soldier', count: 2 },
  { name: 'medic', count: 2 },
]

const classesByQueue: Record<QueueId, { name: string; count: number }[]> = {
  '6v6': classes6v6,
  '9v9': classes9v9,
  ultiduo: classesUltiduo,
  '4v4': classes4v4,
  '3v3': classes3v3,
}

const playerCountByQueue: Record<QueueId, number> = {
  '6v6': 12,
  '9v9': 18,
  ultiduo: 4,
  '4v4': 8,
  '3v3': 6,
}

export function* queueSlots(queue: QueueId = '6v6'): Generator<SlotId> {
  for (const gc of classesByQueue[queue]) {
    for (let i = 1; i <= gc.count; ++i) {
      yield `${gc.name}-${i}` as SlotId
    }
  }
}

export function getPlayerCount(queue: QueueId = '6v6'): number {
  return playerCountByQueue[queue]
}

export function getQueueConfig(queue?: QueueId): QueueId {
  if (queue) {
    return queue
  }
  const env = process.env['QUEUE_CONFIG']
  if (env && isQueueId(env)) {
    return env
  }
  return '6v6'
}
