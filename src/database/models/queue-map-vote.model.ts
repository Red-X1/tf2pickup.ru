import type { QueueId } from '../../queue/types/queue-id'
import type { SteamId64 } from '../../shared/types/steam-id-64'

export interface QueueMapVoteModel {
  queue: QueueId
  player: SteamId64
  map: string
}
