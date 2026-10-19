import { mergeTests } from '@playwright/test'
import { accessMongoDb } from './access-mongo-db'
import { QueuePage } from '../pages/queue.page'
import { secondsToMilliseconds } from 'date-fns'
import { getQueueConfig } from '../queue-slots'

// eslint-disable-next-line @typescript-eslint/no-deprecated
const base = mergeTests(accessMongoDb)

export const waitForEmptyQueue = base.extend<{ queueIsEmpty: void }>({
  queueIsEmpty: [
    async ({ page, db }, use) => {
      await db
        .collection('queue.slots')
        .updateMany({ queue: getQueueConfig() }, { $set: { player: null, ready: false } })
      await db
        .collection('players')
        .updateMany({}, { $unset: { activeGame: '', preReadyUntil: '' } })
      await db
        .collection('queue.state')
        .updateMany({ queue: getQueueConfig() }, { $set: { state: 'waiting' } })
      // stale ready-up timers from the previous test would kick players mid-test
      await db.collection('tasks').deleteMany({
        name: { $in: ['queue:readyUpTimeout', 'queue:unready', 'preReady:cancel'] },
      })
      const q = new QueuePage(page)
      await q.goto()
      await q.waitToBeEmpty({ timeout: secondsToMilliseconds(14) })
      await use()
    },
    { auto: true },
  ],
})
