import { authUsers } from './auth-users'
import { expect, mergeTests } from '@playwright/test'
import { simulateGameServer } from './simulate-game-server'
import type { UserContext, UserName } from '../user-manager'
import { waitForEmptyQueue } from './wait-for-empty-queue'
import { GamePage } from '../pages/game.page'
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns'
import { getPlayerCount, getQueueConfig, type SlotId } from '../queue-slots'
import type { QueueId } from '../../src/queue/types/queue-id'

export interface LaunchGameOptions {
  // Set to true to kill the game after the test
  // Default: true
  killGame?: boolean

  // Keep the automatic substitute timers (join/rejoin gameserver timeouts)
  // intact. By default the fixture sets them to 0 for the whole test so that a
  // game whose players haven't connected yet isn't force-ended mid-test.
  // Default: false
  autoSubstitute?: boolean

  // Wait for the specific game state before carrying on with the test
  // Default: 'created'
  waitForStage:
    | 'created' // the game was created, but nothing is ready yet
    | 'launching' // the gameserver is configured, but the match hasn't started yet
    | 'started' // all players are connected and the match has started
}

export const desiredSlots6v6: [UserName, SlotId][] = [
  ['Promenader', 'scout-1'],
  ['Mayflower', 'scout-2'],
  ['Polemic', 'scout-3'],
  ['Shadowhunter', 'scout-4'],
  ['MoonMan', 'soldier-1'],
  ['Underfire', 'soldier-2'],
  ['Astropower', 'soldier-3'],
  ['LlamaDrama', 'soldier-4'],
  ['SlitherTuft', 'demoman-1'],
  ['Blacklight', 'demoman-2'],
  ['AstraGirl', 'medic-1'],
  ['BellBoy', 'medic-2'],
]

export const desiredSlots9v9: [UserName, SlotId][] = [
  ['Promenader', 'scout-1'],
  ['Mayflower', 'scout-2'],
  ['Polemic', 'soldier-1'],
  ['Shadowhunter', 'soldier-2'],
  ['MoonMan', 'pyro-1'],
  ['Underfire', 'pyro-2'],
  ['Astropower', 'demoman-1'],
  ['LlamaDrama', 'demoman-2'],
  ['SlitherTuft', 'heavy-1'],
  ['Blacklight', 'heavy-2'],
  ['AstraGirl', 'engineer-1'],
  ['BellBoy', 'engineer-2'],
  ['TommyGun', 'medic-1'],
  ['NeonBlitz', 'medic-2'],
  ['CrazyComet', 'sniper-1'],
  ['FrostByte', 'sniper-2'],
  ['IronViper', 'spy-1'],
  ['ShadowPulse', 'spy-2'],
]

export const desiredSlots4v4: [UserName, SlotId][] = [
  ['Promenader', 'scout-1'],
  ['Mayflower', 'scout-2'],
  ['Polemic', 'soldier-1'],
  ['Shadowhunter', 'soldier-2'],
  ['MoonMan', 'demoman-1'],
  ['Underfire', 'demoman-2'],
  ['Astropower', 'medic-1'],
  ['LlamaDrama', 'medic-2'],
]

export const desiredSlots3v3: [UserName, SlotId][] = [
  ['Promenader', 'scout-1'],
  ['Mayflower', 'scout-2'],
  ['Polemic', 'soldier-1'],
  ['Shadowhunter', 'soldier-2'],
  ['MoonMan', 'medic-1'],
  ['Underfire', 'medic-2'],
]

export const desiredSlotsUltiduo: [UserName, SlotId][] = [
  ['Promenader', 'soldier-1'],
  ['Mayflower', 'soldier-2'],
  ['Polemic', 'medic-1'],
  ['Shadowhunter', 'medic-2'],
]

export const desiredSlotsByQueue: Record<QueueId, [UserName, SlotId][]> = {
  '6v6': desiredSlots6v6,
  '9v9': desiredSlots9v9,
  ultiduo: desiredSlotsUltiduo,
  '4v4': desiredSlots4v4,
  '3v3': desiredSlots3v3,
}

export const launchGame = mergeTests(authUsers, simulateGameServer, waitForEmptyQueue).extend<
  LaunchGameOptions & {
    gameNumber: number
    players: UserContext[]
    desiredSlots: Map<UserName, SlotId>
  }
>({
  killGame: [true, { option: true }],
  waitForStage: ['created', { option: true }],
  autoSubstitute: [false, { option: true }],

  desiredSlots: async ({}, use) => {
    const slots = desiredSlotsByQueue[getQueueConfig()]
    await use(new Map<UserName, SlotId>(slots))
  },
  players: async ({ users, desiredSlots }, use) => {
    const requiredCount = getPlayerCount(getQueueConfig())
    if (users.count < requiredCount) {
      throw new Error(`at least ${requiredCount} users are required to launch a game`)
    }

    const players = Array.from(desiredSlots.keys()).map(name => users.byName(name))
    await use(players)
  },
  gameNumber: [
    async (
      { users, players, gameServer, killGame, desiredSlots, waitForStage, autoSubstitute, db },
      use,
    ) => {
      let gameNumber: number | undefined
      let setupCompleted = false
      const autoSubTimeoutKeys = [
        'games.join_gameserver_timeout',
        'games.rejoin_gameserver_timeout',
      ] as const
      let savedAutoSubTimeouts: { key: string; value: number }[] = []

      try {
        if (!autoSubstitute) {
          savedAutoSubTimeouts = await db
            .collection<{ key: string; value: number }>('configuration')
            .find({ key: { $in: [...autoSubTimeoutKeys] } })
            .toArray()
          for (const key of autoSubTimeoutKeys) {
            await db
              .collection('configuration')
              .updateOne({ key }, { $set: { value: 0 } }, { upsert: true })
          }
        }

        await gameServer.sendHeartbeat()

        // resolve the launched game from the database: player pages may still sit on a
        // previous game's URL when a spec leaks browser contexts across tests
        const latestGame = await db
          .collection<{ number: number }>('games')
          .find()
          .sort({ number: -1 })
          .limit(1)
          .toArray()
        const minNewGameNumber = (latestGame[0]?.number ?? 0) + 1

        const lastPlayer = players.at(-1)!
        const playersToReadyUp = players.slice(0, -1)
        const batchSize = 6
        for (let i = 0; i < playersToReadyUp.length; i += batchSize) {
          const batch = playersToReadyUp.slice(i, i + batchSize)
          await Promise.all(
            batch.map(async user => {
              const page = await user.queuePage()
              await page.goto()
              const slot = desiredSlots.get(user.playerName)!
              await page.slot(slot).join()
            }),
          )
        }

        // The player who fills the final slot is automatically readied by the queue.
        const lastQueuePage = await lastPlayer.queuePage()
        await lastQueuePage.goto()
        await lastQueuePage.slot(desiredSlots.get(lastPlayer.playerName)!).join()

        await Promise.all(
          players.map(async user => {
            if (user === lastPlayer) {
              return
            }
            const queuePage = await user.queuePage()
            const slot = desiredSlots.get(user.playerName)!
            await queuePage.readyUp(slot)
          }),
        )

        await expect
          .poll(
            async () => {
              const game = await db
                .collection<{ number: number }>('games')
                .findOne({ number: { $gte: minNewGameNumber } })
              return game?.number ?? 0
            },
            {
              timeout: secondsToMilliseconds(30),
              message: 'game should be created',
            },
          )
          .toBeGreaterThanOrEqual(minNewGameNumber)

        const created = await db
          .collection<{ number: number }>('games')
          .findOne({ number: { $gte: minNewGameNumber } })
        if (!created) {
          throw new Error('could not launch game')
        }

        const resolvedGameNumber = created.number
        gameNumber = resolvedGameNumber

        // players should land on their game page
        await Promise.all(
          players.map(async user => {
            const page = await user.page()
            await page.waitForURL(new RegExp(`/games/${created.number}$`))
          }),
        )

        const page = await users.byName('Promenader').page()

        if (['launching', 'started'].includes(waitForStage)) {
          const gamePage = new GamePage(page, gameNumber)
          await gamePage.goto()
          await expect(gamePage.gameEvent('Game server assigned')).toBeVisible()
          await expect(gamePage.gameEvent('Game server initialized')).toBeVisible({
            timeout: secondsToMilliseconds(45),
          })

          // the game page renders connection status and connect info only past "configuring"
          await expect
            .poll(
              async () => {
                const game = await db
                  .collection<{ number: number; state: string }>('games')
                  .findOne({ number: resolvedGameNumber })
                return game?.state
              },
              {
                timeout: secondsToMilliseconds(30),
                message: 'game should reach the launching state',
              },
            )
            .toBe('launching')

          if (waitForStage === 'started') {
            await gameServer.connectAllPlayers()
            await gameServer.matchStarts()
          }
        }

        for (const user of players) {
          await user.dispose()
        }

        setupCompleted = true
        await use(gameNumber)
      } finally {
        if (!autoSubstitute) {
          try {
            for (const key of autoSubTimeoutKeys) {
              const saved = savedAutoSubTimeouts.find(entry => entry.key === key)
              if (saved) {
                await db
                  .collection('configuration')
                  .updateOne({ key }, { $set: { value: saved.value } })
              } else {
                await db.collection('configuration').deleteOne({ key })
              }
            }
          } catch {
            // restore is best-effort: the game cleanup below still has to run
          }
        }
        try {
          const shouldCleanup = [killGame, !setupCompleted].includes(true)
          if (shouldCleanup && gameNumber === undefined) {
            for (const user of players) {
              const page = await user.page()
              const matches = /games\/(\d+)/.exec(page.url())
              if (matches) {
                gameNumber = Number(matches[1])
                break
              }
            }
          }

          if (shouldCleanup && gameNumber !== undefined) {
            const gamePage = await users.getAdmin().gamePage(gameNumber)
            await gamePage.goto()
            if (await gamePage.isLive()) {
              if (waitForStage === 'started') {
                await gameServer.matchEnds()
              } else {
                await gamePage.forceEnd()
              }
            }

            await expect
              .poll(() => gameServer.logAddresses.size === 0, {
                message: 'make sure logaddress is cleared',
                timeout: secondsToMilliseconds(40),
              })
              .toBe(true)

            const adminPage = await users.getAdmin().adminPage()
            await adminPage.freeStaticGameServer()
          } else if (shouldCleanup) {
            const queuePage = await users.getAdmin().queuePage()
            await queuePage.goto()
            await queuePage.clearQueue()
          }
        } finally {
          for (const user of players) {
            await user.dispose()
          }
        }
      }
    },
    { timeout: minutesToMilliseconds(2) },
  ],
})

export { expect } from './simulate-game-server'
