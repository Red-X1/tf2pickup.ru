import type { QueueId } from '../../queue/types/queue-id'

export interface DiscordBotStateModel {
  guildId: string
  promptMessageIds?: Partial<Record<QueueId, string>> | undefined
}
