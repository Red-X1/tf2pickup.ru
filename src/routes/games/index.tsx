import z from 'zod'
import { GameList, GameListPage } from '../../games/views/html/game-list.page'
import { routes } from '../../utils/routes'
import { queueIds } from '../../queue/types/queue-id'

// eslint-disable-next-line @typescript-eslint/require-await
export default routes(async app => {
  app.get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().optional(),
          queue: z.enum(queueIds).optional(),
        }),
      },
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1
      const { queue } = request.query
      await reply.html(
        request.isPartialFor('gameList') ? (
          <GameList page={page} queue={queue} />
        ) : (
          <GameListPage page={page} queue={queue} />
        ),
      )
    },
  )
})
