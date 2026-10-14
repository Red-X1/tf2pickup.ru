import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetSlots = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockGetMapWinner = vi.hoisted(() => vi.fn().mockResolvedValue('cp_badlands'))
const mockGetFriends = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockUnreadyQueue = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../queue-auto/get-slots', () => ({ getSlots: mockGetSlots }))
vi.mock('../queue-auto/get-map-winner', () => ({ getMapWinner: mockGetMapWinner }))
vi.mock('../queue-auto/get-friends', () => ({ getFriends: mockGetFriends }))
vi.mock('../queue-auto/unready-queue', () => ({ unreadyQueue: mockUnreadyQueue }))

vi.mock('./create', () => ({
  create: vi.fn(),
}))

vi.mock('./assign-game-server', () => ({
  assignGameServer: vi.fn(),
}))

vi.mock('./rcon/configure', () => ({
  configure: vi.fn(),
}))

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), trace: vi.fn(), error: vi.fn() },
}))

import { launchGame } from './launch-game'
import { create } from './create'
import { assignGameServer } from './assign-game-server'

describe('launchGame()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assigns a game server to the created game', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(create).mockResolvedValue({ number: 42 } as any)

    await launchGame('6v6')

    expect(assignGameServer).toHaveBeenCalledWith(42, { retries: 3 })
    expect(mockUnreadyQueue).not.toHaveBeenCalled()
  })

  it('reverts the queue when game creation fails', async () => {
    vi.mocked(create).mockRejectedValue(new Error('queue slot medic-1 is empty'))

    await launchGame('6v6')

    expect(mockUnreadyQueue).toHaveBeenCalledWith('6v6')
    expect(assignGameServer).not.toHaveBeenCalled()
  })
})
