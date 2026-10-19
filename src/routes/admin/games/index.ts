import { PlayerRole } from '../../../database/models/player.model'
import { CooldownLevelEntry, GamesPage } from '../../../admin/games/views/html/games.page'
import { z } from 'zod'
import { LogsTfUploadMethod } from '../../../shared/types/logs-tf-upload-method'
import { requestContext } from '@fastify/request-context'
import { secondsToMilliseconds } from 'date-fns'
import { routes } from '../../../utils/routes'
import { configuration } from '../../../configuration'
import { durationUnit } from '../../../admin/games/duration-unit'
import { queueIds } from '../../../queue/types/queue-id'
import type { QueueId } from '../../../queue/types/queue-id'

// A single form field is submitted as a scalar, multiple as an array; normalize both to an array.
const formArray = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value): unknown[] => {
    if (value === undefined) return []
    return Array.isArray(value) ? (value as unknown[]) : [value]
  }, z.array(schema))

const whitelistIdField = z.string().transform(value => (value === '' ? null : value))

const executeExtraCommandsField = z.string().transform(value =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0),
)

const gamesSchema = z
  .object({
    joinGameserverTimeout: z.coerce.number(),
    rejoinGameserverTimeout: z.coerce.number(),
    'executeExtraCommands.6v6': executeExtraCommandsField,
    'executeExtraCommands.9v9': executeExtraCommandsField,
    'executeExtraCommands.ultiduo': executeExtraCommandsField,
    'executeExtraCommands.4v4': executeExtraCommandsField,
    'executeExtraCommands.3v3': executeExtraCommandsField,
    logsTfUploadMethod: z.enum(LogsTfUploadMethod),
    'banLength[]': formArray(z.coerce.number().min(0)),
    'banLengthUnit[]': formArray(z.enum(durationUnit.all)),
    'whitelistId.6v6': whitelistIdField,
    'whitelistId.9v9': whitelistIdField,
    'whitelistId.ultiduo': whitelistIdField,
    'whitelistId.4v4': whitelistIdField,
    'whitelistId.3v3': whitelistIdField,
  })
  .refine(({ 'banLength[]': length, 'banLengthUnit[]': unit }) => length.length === unit.length, {
    message: 'banLength[] and banLengthUnit[] must be of the same length',
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
        await reply.status(200).html(GamesPage())
      },
    )
    .post(
      '/',
      {
        config: {
          authorize: [PlayerRole.admin],
        },
        schema: {
          body: gamesSchema,
        },
      },
      async (request, reply) => {
        const actor = request.user!.player.steamId
        const cooldownLevels = request.body['banLength[]'].map((value, i) => ({
          level: i,
          banLengthMs: durationUnit.toMs(value, request.body['banLengthUnit[]'][i]!),
        }))
        const whitelistIds = Object.fromEntries(
          queueIds.map(queue => [queue, request.body[`whitelistId.${queue}`] ?? null]),
        ) as Record<QueueId, string | null>
        const executeExtraCommands = Object.fromEntries(
          queueIds.map(queue => [queue, request.body[`executeExtraCommands.${queue}`]]),
        ) as Record<QueueId, string[]>
        await Promise.all([
          configuration.set('games.whitelist_id', whitelistIds, actor),
          configuration.set(
            'games.join_gameserver_timeout',
            secondsToMilliseconds(request.body.joinGameserverTimeout),
            actor,
          ),
          configuration.set(
            'games.rejoin_gameserver_timeout',
            secondsToMilliseconds(request.body.rejoinGameserverTimeout),
            actor,
          ),
          configuration.set('games.execute_extra_commands', executeExtraCommands, actor),
          configuration.set('games.logs_tf_upload_method', request.body.logsTfUploadMethod, actor),
          configuration.set('games.cooldown_levels', cooldownLevels, actor),
        ])
        requestContext.set('messages', { success: ['Configuration saved'] })
        await reply.status(200).html(GamesPage())
      },
    )
    .post(
      '/cooldown-level',
      {
        config: {
          authorize: [PlayerRole.admin],
        },
      },
      async (_request, reply) => {
        return await reply.send(CooldownLevelEntry({ banLengthMs: 0 }))
      },
    )
})
