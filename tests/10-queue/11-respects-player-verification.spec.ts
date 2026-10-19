import { expect, mergeTests } from '@playwright/test'
import { authUsers } from '../fixtures/auth-users'
import { waitForEmptyQueue } from '../fixtures/wait-for-empty-queue'
import { getQueueConfig, queueSlots } from '../queue-slots'
import { queueIds } from '../../src/queue/types/queue-id'

const test = mergeTests(authUsers, waitForEmptyQueue)

const moonManSteamId = '76561199195972852'

test.describe('when player verification is required @6v6 @9v9 @4v4 @3v3', () => {
  test.beforeAll(async ({ users }) => {
    const admin = await users.getAdmin().adminPage()
    await admin.configureRequirePlayerVerification(true)
  })

  test.afterAll(async ({ users, db }) => {
    try {
      const admin = await users.getAdmin().adminPage()
      // Un-verify before disabling the feature: setPlayerVerified is a no-op when the
      // feature is off (checkbox not rendered), so order matters here.
      await admin.setPlayerVerified(moonManSteamId, false)
      await admin.configureRequirePlayerVerification(false)
    } finally {
      // never leave verification on: it would block every later queue join
      await db.collection('configuration').updateOne(
        { key: 'queue.require_player_verification' },
        {
          $set: {
            value: Object.fromEntries(queueIds.map(queue => [queue, false])),
          },
        },
        { upsert: true },
      )
      await db
        .collection('players')
        .updateOne({ steamId: moonManSteamId }, { $set: { verified: false } })
    }
  })

  test('unverified player cannot join the queue', async ({ users }) => {
    const page = await users.byName('MoonMan').queuePage()
    await page.goto()

    for (const slot of queueSlots(getQueueConfig())) {
      await expect(page.slot(slot).joinButton()).toBeDisabled()
    }
  })

  test.describe('and the player is verified', () => {
    test.beforeEach(async ({ users }) => {
      const admin = await users.getAdmin().adminPage()
      await admin.setPlayerVerified(moonManSteamId, true)
    })

    test.afterEach(async ({ users }) => {
      const admin = await users.getAdmin().adminPage()
      await admin.setPlayerVerified(moonManSteamId, false)
    })

    test('verified player can join the queue', async ({ users }) => {
      const page = await users.byName('MoonMan').queuePage()
      await page.goto()

      for (const slot of queueSlots(getQueueConfig())) {
        await expect(page.slot(slot).joinButton()).not.toBeDisabled()
      }

      await page.joinQueue('scout-1')
      await expect(page.slot('scout-1').joinButton()).not.toBeVisible()
    })
  })
})

test.describe('when player verification is not required @6v6 @9v9 @4v4 @3v3', () => {
  test('unverified player can join the queue freely', async ({ users }) => {
    const page = await users.byName('MoonMan').queuePage()
    await page.goto()

    for (const slot of queueSlots(getQueueConfig())) {
      await expect(page.slot(slot).joinButton()).not.toBeDisabled()
    }
  })
})
