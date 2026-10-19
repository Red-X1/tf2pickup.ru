import { secondsToMilliseconds } from 'date-fns'
import { expect, launchGame as test } from '../fixtures/launch-game'
import { GamePage } from '../pages/game.page'

test.use({ waitForStage: 'launching', autoSubstitute: true })

// Mayflower is scout-2 in every supported format
const autoSubstitutee = 'Mayflower'

test.beforeEach(async ({ users }) => {
  const page = await users.getAdmin().adminPage()
  await page.configureGames({ joinGameServerTimeout: 10, rejoinGameServerTimeout: 5 })

  const adminsPage = await users.getAdmin().adminPage()
  await adminsPage.setPlayerCooldown(users.byName(autoSubstitutee).steamId, 0)
})

test.describe('when a player gets auto-subbed @6v6 @9v9 @4v4 @3v3', () => {
  test.beforeEach(async ({ page, gameNumber, gameServer }) => {
    const gamePage = new GamePage(page, gameNumber)
    await gamePage.goto()
    await gameServer.connectAllPlayers()
    await gameServer.matchStarts()

    await gameServer.playerDisconnects(autoSubstitutee)

    await expect
      .poll(() => gamePage.slot(autoSubstitutee).status(), { timeout: secondsToMilliseconds(15) })
      .toBe('waiting for substitute')
    await expect(gamePage.playerLink(autoSubstitutee)).not.toBeVisible()
  })

  test.describe('and they get replaced by other player @6v6 @9v9 @4v4 @3v3', () => {
    test.beforeEach(async ({ users, gameNumber }) => {
      const ghostWalker = await users.byName('GhostWalker').gamePage(gameNumber)
      await ghostWalker.goto()
      await ghostWalker.replacePlayer(autoSubstitutee)
    })

    test('the cooldown is increased @6v6 @9v9 @4v4 @3v3', async ({ users }) => {
      const admin = await users.getAdmin().adminPage()
      const cooldown = await admin.playerCooldown(users.byName(autoSubstitutee).steamId)
      await expect(cooldown).toHaveValue('1')
    })

    test.afterEach(async ({ users }) => {
      const adminsPage = await users.getAdmin().adminPage()
      await adminsPage.setPlayerCooldown(users.byName(autoSubstitutee).steamId, 0)
      await adminsPage.revokeAllBans(users.byName(autoSubstitutee).steamId)
    })
  })

  test.describe('and they replace themselves @6v6 @9v9 @4v4 @3v3', () => {
    test.beforeEach(async ({ users, gameNumber }) => {
      const mayflowersPage = await users.byName(autoSubstitutee).gamePage(gameNumber)
      await mayflowersPage.goto()
      await mayflowersPage.replacePlayer(autoSubstitutee)
    })

    test('the cooldown is not increased @6v6 @9v9 @4v4 @3v3', async ({ users }) => {
      const admin = await users.getAdmin().adminPage()
      const cooldown = await admin.playerCooldown(users.byName(autoSubstitutee).steamId)
      await expect(cooldown).toHaveValue('0')
    })
  })
})
