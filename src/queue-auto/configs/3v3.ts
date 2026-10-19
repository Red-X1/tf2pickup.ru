import { Tf2ClassName } from '../../shared/types/tf2-class-name'
import type { QueueConfig } from '../../queue/types/queue-config'

export const _3v3: QueueConfig = {
  teamCount: 2,
  classes: [
    {
      name: Tf2ClassName.scout,
      count: 1,
    },
    {
      name: Tf2ClassName.soldier,
      count: 1,
    },
    {
      name: Tf2ClassName.medic,
      count: 1,
      canMakeFriendsWith: [Tf2ClassName.scout, Tf2ClassName.soldier],
    },
  ],
}
