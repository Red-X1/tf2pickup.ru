import { describe, expect, it, vi } from 'vitest'
import { QueueState } from '../database/models/queue-state.model'
import { setState } from '../queue/set-state'
import { tasks } from '../tasks'
import { unready } from './unready'
import { unreadyQueue } from './unready-queue'

vi.mock('../database/collections', () => ({
  collections: {
    queueSlots: {
      find: () => ({
        toArray: () => Promise.resolve([{ player: { steamId: '1' } }]),
      }),
    },
  },
}))
vi.mock('../logger', () => ({ logger: { info: vi.fn() } }))
vi.mock('../tasks', () => ({ tasks: { cancel: vi.fn() } }))
vi.mock('../queue/set-state', () => ({ setState: vi.fn() }))
vi.mock('./unready', () => ({ unready: vi.fn() }))

describe('unreadyQueue()', () => {
  it('cancels the pending ready-up timeouts', async () => {
    await unreadyQueue('6v6')
    expect(tasks.cancel).toHaveBeenCalledWith('queue:readyUpTimeout', { queue: '6v6' })
    expect(tasks.cancel).toHaveBeenCalledWith('queue:unready', { queue: '6v6' })
    expect(setState).toHaveBeenCalledWith('6v6', QueueState.waiting)
    expect(unready).toHaveBeenCalledWith('6v6', '1')
  })
})
