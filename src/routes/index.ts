import { routes } from '../utils/routes'

// eslint-disable-next-line @typescript-eslint/require-await
export default routes(async app => {
  app.get('/', async (_req, reply) => {
    return reply.redirect('/6v6', 302)
  })
})
