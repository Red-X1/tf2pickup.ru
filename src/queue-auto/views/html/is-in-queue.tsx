import { collections } from '../../../database/collections'
import type { QueueId } from '../../../queue/types/queue-id'
import type { SteamId64 } from '../../../shared/types/steam-id-64'

export async function IsInQueue(props: { queue: QueueId; actor?: SteamId64 | undefined }) {
  const isInQueue = !!(
    props.actor &&
    (await collections.queueSlots.countDocuments({
      queue: props.queue,
      'player.steamId': props.actor,
    })) > 0
  )
  return <input type="hidden" id="isInQueue" value={isInQueue.toString()} />
}
