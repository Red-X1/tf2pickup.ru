import { collections } from '../../../database/collections'
import type { QueueId } from '../../../queue/types/queue-id'

export async function CurrentPlayerCount(props: { queue: QueueId }) {
  const current = await collections.queueSlots.countDocuments({
    queue: props.queue,
    player: { $ne: null },
  })
  return <span id="queue-current-player-count">{current}</span>
}
