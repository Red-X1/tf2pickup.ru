import { secondsToMilliseconds } from 'date-fns'
import { launchGame as test, expect } from '../fixtures/launch-game'

test.use({ autoSubstitute: true })

test.beforeEach(async ({ users }) => {
  const page = await users.getAdmin().adminPage()
  await page.configureGames({ joinGameServerTimeout: 30, rejoinGameServerTimeout: 20 })
})

test('renders join game button @6v6 @9v9 @4v4 @3v3', async ({
  gameNumber,
  gameServer,
  players,
}) => {
  const rosterPlayer = players.at(-1)!
  const page = await rosterPlayer.gamePage(gameNumber)
  await expect(page.waitingForGameServer()).toBeVisible()

  await expect(page.gameEvent('Game server initialized')).toBeVisible({
    timeout: secondsToMilliseconds(15),
  })

  const joinGameButton = page.joinGameButton()
  await expect(joinGameButton).toBeVisible()
  await expect(joinGameButton).toContainText(/join in \d+:\d+/)
  await gameServer.playerConnects(rosterPlayer.playerName)
  await expect(joinGameButton).toContainText('join game')
})
