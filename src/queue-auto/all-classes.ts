import { queueIds } from '../queue/types/queue-id'
import { Tf2ClassName } from '../shared/types/tf2-class-name'
import { getQueueConfig } from './config'

export function allGameClasses(): Tf2ClassName[] {
  const names = new Set<Tf2ClassName>()
  for (const queue of queueIds) {
    for (const { name } of getQueueConfig(queue).classes) {
      names.add(name)
    }
  }
  return [...names]
}
