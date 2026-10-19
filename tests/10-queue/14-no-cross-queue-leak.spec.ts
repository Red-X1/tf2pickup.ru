import { mergeTests } from '@playwright/test'
import { authUsers, expect } from '../fixtures/auth-users'
import { waitForEmptyQueue } from '../fixtures/wait-for-empty-queue'
import { QueuePage } from '../pages/queue.page'
import { getPlayerCount, getQueueConfig } from '../queue-slots'
import type { QueueId } from '../../src/queue/types/queue-id'

const test = mergeTests(authUsers, waitForEmptyQueue)

// Queue slot ids repeat across queue modes, so slot fragments must only ever
// be delivered to their own queue page. Give the websocket a chance to deliver
// a wrongly-scoped fragment before asserting that nothing changed: the whole
// point is that no `slots:updated` payload arrives.
const wsDeliveryBudget = 1500

test('queue slot updates do not leak across queue modes @6v6 @9v9 @4v4 @3v3', async ({
  page,
  users,
  db,
}) => {
  const primary = getQueueConfig()
  const secondary = (primary === '3v3' ? '6v6' : '3v3') as QueueId
  const secondaryUrl = `/${secondary}`

  await db
    .collection('queue.slots')
    .updateMany({ queue: secondary }, { $set: { player: null, ready: false } })
  await db
    .collection('queue.state')
    .updateMany({ queue: secondary }, { $set: { state: 'waiting' } })

  const observer = new QueuePage(page)
  await observer.goto()
  await expect(observer.slot('scout-1').locator).not.toHaveAttribute('data-player')

  const p1 = await users.getNext().queuePage()
  await p1.goto()
  await p1.joinQueue('scout-1')
  await expect(observer.slot('scout-1').locator).toHaveAttribute('data-player', /\S/)
  const p1SteamId = await observer.slot('scout-1').locator.getAttribute('data-player')
  expect(p1SteamId).not.toBeNull()
  await expect(observer.header()).toHaveText(`Players: 1/${getPlayerCount(primary)}`)

  const p2User = users.getNext()
  const p2 = await p2User.queuePage()
  await p2.page.goto(secondaryUrl)
  await p2.joinQueue('scout-1')

  await p2.page.waitForTimeout(wsDeliveryBudget)

  // the foreign join must not touch the observer's slot or player count
  await expect(observer.slot('scout-1').locator).toHaveAttribute('data-player', p1SteamId!)
  await expect(observer.header()).toHaveText(`Players: 1/${getPlayerCount(primary)}`)

  await p2.leaveQueue()
  await p2.page.waitForTimeout(wsDeliveryBudget)

  // the foreign leave must not free the observer's slot either
  await expect(observer.slot('scout-1').locator).toHaveAttribute('data-player', p1SteamId!)
  await expect(observer.header()).toHaveText(`Players: 1/${getPlayerCount(primary)}`)

  await p1.leaveQueue()
})
