import { PlayerRole } from '../../../database/models/player.model'
import { PlayerRestrictionsPage } from '../../../admin/player-restrictions/views/html/player-restrictions.page'
import { z } from 'zod'
import { configuration } from '../../../configuration'
import { requestContext } from '@fastify/request-context'
import { routes } from '../../../utils/routes'
import { queueIds } from '../../../queue/types/queue-id'
import { allGameClasses } from '../../../queue-auto/all-classes'
import type { QueueId } from '../../../queue/types/queue-id'
import type { Tf2ClassName } from '../../../shared/types/tf2-class-name'

const playerRestrictionsSchema = z.object({
  etf2lAccountRequired: z.coerce.boolean().default(false),
  minimumInGameHours: z.coerce.number(),
  skillSuggestions: z.coerce.boolean().default(false),
  skillStep: z.coerce.number().positive(),
  'requirePlayerVerification.6v6': z.coerce.boolean().default(false),
  'requirePlayerVerification.9v9': z.coerce.boolean().default(false),
  'requirePlayerVerification.ultiduo': z.coerce.boolean().default(false),
  'playerSkillThresholdEnabled.6v6': z.coerce.boolean().default(false),
  'playerSkillThresholdEnabled.9v9': z.coerce.boolean().default(false),
  'playerSkillThresholdEnabled.ultiduo': z.coerce.boolean().default(false),
  'playerSkillThreshold.6v6': z.coerce.number().optional(),
  'playerSkillThreshold.9v9': z.coerce.number().optional(),
  'playerSkillThreshold.ultiduo': z.coerce.number().optional(),
  ...Object.fromEntries(
    allGameClasses().map(key => [`defaultPlayerSkill.${key}`, z.coerce.number()]),
  ),
})

// eslint-disable-next-line @typescript-eslint/require-await
export default routes(async app => {
  app
    .get(
      '/',
      {
        config: {
          authorize: [PlayerRole.admin],
        },
      },
      async (_request, reply) => {
        await reply.status(200).html(PlayerRestrictionsPage())
      },
    )
    .post(
      '/',
      {
        config: {
          authorize: [PlayerRole.admin],
        },
        schema: {
          body: playerRestrictionsSchema,
        },
      },
      async (request, reply) => {
        const { etf2lAccountRequired, minimumInGameHours, skillSuggestions, skillStep } =
          request.body
        const body = request.body as Record<string, unknown>
        const defaultPlayerSkill = Object.entries(body)
          .filter(([key]) => key.startsWith('defaultPlayerSkill.'))
          .reduce<Partial<Record<Tf2ClassName, number>>>(
            (acc, [key, value]) => ({
              ...acc,
              [key.split('.')[1] as Tf2ClassName]: value as number,
            }),
            {},
          )

        const requirePlayerVerification = Object.fromEntries(
          queueIds.map(queue => [queue, Boolean(body[`requirePlayerVerification.${queue}`])]),
        ) as Record<QueueId, boolean>
        const playerSkillThreshold = Object.fromEntries(
          queueIds.map(queue => [
            queue,
            body[`playerSkillThresholdEnabled.${queue}`]
              ? ((body[`playerSkillThreshold.${queue}`] as number | undefined) ?? null)
              : null,
          ]),
        ) as Record<QueueId, number | null>

        const actor = request.user!.player.steamId
        await Promise.all([
          configuration.set('players.etf2l_account_required', etf2lAccountRequired, actor),
          configuration.set('players.minimum_in_game_hours', minimumInGameHours, actor),
          configuration.set('queue.require_player_verification', requirePlayerVerification, actor),
          configuration.set('queue.player_skill_threshold', playerSkillThreshold, actor),
          configuration.set('games.default_player_skill', defaultPlayerSkill, actor),
          configuration.set('games.skill_step', skillStep, actor),
          configuration.set('games.skill_suggestions', skillSuggestions, actor),
        ])
        requestContext.set('messages', { success: ['Configuration saved'] })
        await reply.status(200).html(PlayerRestrictionsPage())
      },
    )
})
