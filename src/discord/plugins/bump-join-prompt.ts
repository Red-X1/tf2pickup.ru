import fp from 'fastify-plugin'
import { forEachEnabledChannel } from '../for-each-enabled-channel'
import { collections } from '../../database/collections'
import { getMessage } from '../get-message'
import { minutesToMilliseconds } from 'date-fns'
import { getSlots } from '../../queue-auto/get-slots'
import { queueIds } from '../../queue/types/queue-id'
import { client } from '../client'
import { safe } from '../../utils/safe'
import { queuePromptMutex } from '../queue-prompt-mutex'

// eslint-disable-next-line @typescript-eslint/require-await
export default fp(async app => {
  if (!client) {
    return
  }

  app.addHook('onReady', async () => {
    setInterval(safe(ensurePromptIsVisible), minutesToMilliseconds(5))
    await ensurePromptIsVisible()
  })
})

async function ensurePromptIsVisible() {
  await queuePromptMutex.runExclusive(async () => {
    await forEachEnabledChannel('queuePrompts', async (channel, config) => {
      const state = await collections.discordBotState.findOne({ guildId: channel.guild.id })
      const thresholdRatio = config.bumpPlayerThresholdRatio

      for (const queue of queueIds) {
        const message = await getMessage(channel, state?.promptMessageIds?.[queue])
        if (!message) {
          continue
        }

        const messages = await channel.messages.fetch({ limit: 1 })
        if (messages.size === 0) {
          continue
        }

        if (message.id === messages.first()!.id) {
          continue
        }

        const slots = await getSlots(queue)
        const playerCount = slots.filter(slot => !!slot.player).length
        const requiredPlayerCount = slots.length

        if (playerCount < requiredPlayerCount * thresholdRatio) {
          continue
        }

        const embeds = message.embeds
        const content = message.content
        await message.delete()

        const sentMessage = await channel.send({
          content,
          embeds,
        })
        await collections.discordBotState.updateOne(
          { guildId: channel.guild.id },
          { $set: { [`promptMessageIds.${queue}`]: sentMessage.id } },
        )
      }
    })
  })
}
