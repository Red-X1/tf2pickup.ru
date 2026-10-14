import fp from 'fastify-plugin'
import { events } from '../../events'
import { cleanupFriendships } from '../cleanup-friendships'
import { debounce } from 'es-toolkit'

export default fp(
  // eslint-disable-next-line @typescript-eslint/require-await
  async () => {
    const debounced = new Map<string, ReturnType<typeof debounce>>()

    events.on('queue/slots:updated', ({ queue }) => {
      const existing = debounced.get(queue)
      const fn =
        existing ??
        debounce(() => {
          void cleanupFriendships(queue)
        }, 100)
      debounced.set(queue, fn)
      fn()
    })
  },
  {
    name: 'auto cleanup friendships',
  },
)
