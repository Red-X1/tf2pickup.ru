export const queueIds = ['6v6', '9v9', 'ultiduo'] as const

export type QueueId = (typeof queueIds)[number]

export const isQueueId = (value: string): value is QueueId =>
  (queueIds as readonly string[]).includes(value)
