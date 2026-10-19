import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fastify-plugin', () => ({
  default: <T>(fn: T): T => fn,
}))

vi.mock('../../events', () => ({
  events: {
    on: vi.fn(),
    emit: vi.fn(),
  },
}))

vi.mock('../../database/collections', () => ({
  collections: {
    players: {
      updateOne: vi.fn(),
    },
  },
}))

vi.mock('../../tasks', () => ({
  tasks: {
    register: vi.fn(),
    schedule: vi.fn(),
  },
}))

vi.mock('../../configuration', () => ({
  configuration: {
    get: vi.fn(),
  },
}))

import { events } from '../../events'
import { collections } from '../../database/collections'
import { tasks } from '../../tasks'
import plugin from './free-players'
import type { SteamId64 } from '../../shared/types/steam-id-64'
import type { GameNumber } from '../../database/models/game.model'

const player = '76561198000000001' as SteamId64
const gameNumber = 17 as GameNumber

describe('free-players', () => {
  let freePlayerTask: (params: { player: SteamId64; gameNumber: GameNumber }) => Promise<void>

  beforeEach(async () => {
    vi.resetAllMocks()
    vi.mocked(collections.players.updateOne).mockResolvedValue({
      modifiedCount: 1,
      matchedCount: 1,
    } as never)
    await (plugin as unknown as () => Promise<void>)()
    freePlayerTask = vi
      .mocked(tasks.register)
      .mock.calls.find(
        ([name]: [string, ...unknown[]]) => name === 'games.freePlayer',
      )![1] as typeof freePlayerTask
  })

  it('emits player/activeGame:updated with undefined when freePlayer task runs', async () => {
    await freePlayerTask({ player, gameNumber })

    expect(collections.players.updateOne).toHaveBeenCalledWith(
      { steamId: player, activeGame: gameNumber },
      { $unset: { activeGame: 1 } },
    )
    expect(events.emit).toHaveBeenCalledWith('player/activeGame:updated', {
      steamId: player,
      activeGame: undefined,
    })
  })

  it('does nothing when the player already belongs to another game', async () => {
    vi.mocked(collections.players.updateOne).mockResolvedValue({
      modifiedCount: 0,
      matchedCount: 0,
    } as never)

    await freePlayerTask({ player, gameNumber })

    expect(events.emit).not.toHaveBeenCalled()
  })
})
