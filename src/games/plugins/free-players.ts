import fp from 'fastify-plugin'
import { tasks } from '../../tasks'
import { collections } from '../../database/collections'
import { configuration } from '../../configuration'
import { events } from '../../events'
import { GameEventType, type PlayerReplaced } from '../../database/models/game-event.model'

export default fp(
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => {
    tasks.register('games.freePlayer', async ({ player, gameNumber }) => {
      // conditional: a player may already belong to a newer game when a delayed
      // free from a previous one fires, and must not lose their activeGame then
      const { modifiedCount } = await collections.players.updateOne(
        { steamId: player, activeGame: gameNumber },
        { $unset: { activeGame: 1 } },
      )
      if (modifiedCount === 0) {
        return
      }
      events.emit('player/activeGame:updated', { steamId: player, activeGame: undefined })
    })

    events.on('game:ended', async ({ game }) => {
      const substitutes = new Set(
        game.events
          .filter(
            (e): e is PlayerReplaced =>
              e.event === GameEventType.playerReplaced && e.replacee !== e.replacement,
          )
          .map(({ replacement }) => replacement),
      )

      await Promise.all(
        game.slots.map(async ({ gameClass, player }) => {
          const queueCooldown = await configuration.get('games.join_queue_cooldown')
          const cooldownMs = substitutes.has(player) ? 0 : queueCooldown[gameClass]
          await tasks.schedule('games.freePlayer', cooldownMs, {
            player,
            gameNumber: game.number,
          })
        }),
      )
    })
  },
  {
    name: 'free players',
  },
)
