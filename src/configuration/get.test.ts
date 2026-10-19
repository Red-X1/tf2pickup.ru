import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from './get'
import { collections } from '../database/collections'

vi.mock('../database/collections', () => ({
  collections: {
    configuration: {
      findOne: vi.fn(),
    },
  },
}))

vi.mock('../database/models/configuration-entry.model', async () => ({
  configurationSchema: (await import('../database/models/configuration-entry.model'))
    .configurationSchema,
}))

describe('when the configuration entry is found', () => {
  beforeEach(() => {
    vi.mocked(collections.configuration.findOne).mockResolvedValue({
      key: 'queue.ready_up_timeout',
      value: { '6v6': 45000, '9v9': 45000, ultiduo: 45000 },
    })
  })

  it('should return the value', async () => {
    const result = await get('queue.ready_up_timeout')
    expect(result).toEqual({ '6v6': 45000, '9v9': 45000, ultiduo: 45000 })
  })
})

describe('when the configuration entry is not found', () => {
  beforeEach(() => {
    vi.mocked(collections.configuration.findOne).mockResolvedValue(null)
  })

  it('should return the default value', async () => {
    const result = await get('queue.ready_up_timeout')
    expect(result).toEqual({
      '6v6': 40000,
      '9v9': 40000,
      ultiduo: 40000,
      '4v4': 40000,
      '3v3': 40000,
    })
  })
})
