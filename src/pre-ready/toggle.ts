import type { SteamId64 } from '../shared/types/steam-id-64'
import type { QueueId } from '../queue/types/queue-id'
import { cancel } from './cancel'
import { isPreReadied } from './is-pre-readied'
import { start } from './start'

export async function toggle(queue: QueueId, player: SteamId64) {
  if (await isPreReadied(player)) {
    await cancel(player)
  } else {
    await start(queue, player)
  }
}
