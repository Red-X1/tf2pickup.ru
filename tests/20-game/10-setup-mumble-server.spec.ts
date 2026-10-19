import { mergeTests } from '@playwright/test'
import { expect, launchGame } from '../fixtures/launch-game'
import { configureMumbleServer } from '../fixtures/configure-mumble-server'

const test = mergeTests(launchGame, configureMumbleServer)

test('renders join voice button @6v6 @9v9 @4v4 @3v3', async ({
  gameNumber,
  players,
  mumbleConfiguration,
  mumbleClient,
}) => {
  const rosterPlayer = players.at(-1)!
  const page = await rosterPlayer.gamePage(gameNumber)

  const joinVoiceButton = page.joinVoiceButton()
  await expect(joinVoiceButton).toBeVisible()
  await expect(joinVoiceButton).toHaveAttribute(
    'href',
    new RegExp(
      `mumble://${rosterPlayer.playerName}@.+/${mumbleConfiguration.channelName}/${gameNumber}/(RED|BLU)`,
    ),
  )

  expect(
    mumbleClient.channels.byPath(mumbleConfiguration.channelName, gameNumber.toString(), 'RED'),
  ).toBeTruthy()
  expect(
    mumbleClient.channels.byPath(mumbleConfiguration.channelName, gameNumber.toString(), 'BLU'),
  ).toBeTruthy()
})
