import { queueIds, isQueueId, type QueueId } from './queue-id'

export function queueUrl(queue: QueueId): string {
  return `/${queue}`
}

export const queueUrls: string[] = queueIds.map(queueUrl)

export function queueFromUrl(url: string): QueueId | undefined {
  const segment = url.split('?')[0]?.split('/')[1]
  return segment && isQueueId(segment) ? segment : undefined
}
