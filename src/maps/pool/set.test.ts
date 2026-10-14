import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { set } from './set'
import { mapPoolSchema, type MapPoolEntry } from '../../database/models/map-pool-entry.model'

const events = vi.hoisted(() => {
  return {
    emit: vi.fn(),
  }
})

vi.mock('../../database/collections', () => {
  let maps: MapPoolEntry[] = []
  return {
    collections: {
      maps: {
        deleteMany: vi.fn().mockImplementation(() => {
          maps.length = 0
          return Promise.resolve()
        }),
        insertMany: vi.fn().mockImplementation((newMaps: MapPoolEntry[]) => {
          maps = [...newMaps]
          return Promise.resolve()
        }),
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockImplementation(() => Promise.resolve(maps)),
        }),
      },
    },
  }
})
vi.mock('../../database/models/map-pool-entry.model', () => ({
  mapPoolSchema: {
    parse: vi.fn(),
  },
}))
vi.mock('../../events', () => ({ events }))

describe('set()', () => {
  describe('when validation fails', () => {
    beforeEach(() => {
      vi.mocked(mapPoolSchema).parse.mockImplementation(() => {
        throw new Error('validation failed')
      })
    })

    afterEach(() => {
      vi.mocked(mapPoolSchema).parse.mockRestore()
    })

    it('should reject', async () => {
      await expect(set('6v6', [{ queue: '6v6', name: 'cp_process_final' }])).rejects.toThrow()
    })
  })

  it('should emit event', async () => {
    vi.mocked(mapPoolSchema).parse.mockImplementation(maps => maps)
    const maps = [
      { queue: '6v6', name: 'cp_process_final' },
      { queue: '6v6', name: 'cp_badlands' },
      { queue: '6v6', name: 'cp_granary' },
    ]
    await set('6v6', maps)
    expect(events.emit).toHaveBeenCalledWith('queue/mapPool:reset', { queue: '6v6', maps })
  })
})
