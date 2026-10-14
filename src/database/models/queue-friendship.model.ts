import type { QueueId } from '../../queue/types/queue-id'
import type { SteamId64 } from '../../shared/types/steam-id-64'

export interface QueueFriendshipModel {
  queue: QueueId
  source: SteamId64
  target: SteamId64
}
