import type { MapPoolEntry } from '../../database/models/map-pool-entry.model'
import type { QueueId } from '../../queue/types/queue-id'
import { set } from './set'

type DefaultMapPoolEntry = Omit<MapPoolEntry, 'queue'>

export const defaultMapPools: Record<QueueId, DefaultMapPoolEntry[]> = {
  '6v6': [
    {
      name: 'cp_process_final',
      execConfig: 'etf2l_6v6_5cp',
    },
    {
      name: 'cp_snakewater_final1',
      execConfig: 'etf2l_6v6_5cp',
    },
    {
      name: 'cp_sunshine',
      execConfig: 'etf2l_6v6_5cp',
    },
    {
      name: 'cp_granary_pro_rc8',
      execConfig: 'etf2l_6v6_5cp',
    },
    {
      name: 'cp_gullywash_final1',
      execConfig: 'etf2l_6v6_5cp',
    },
    {
      name: 'cp_metalworks',
      execConfig: 'etf2l_6v6_5cp',
    },
  ],
  '9v9': [
    {
      name: 'cp_process_final',
      execConfig: 'etf2l_9v9_5cp',
    },
    {
      name: 'cp_snakewater_final1',
      execConfig: 'etf2l_9v9_5cp',
    },
    {
      name: 'cp_sunshine',
      execConfig: 'etf2l_9v9_5cp',
    },
    {
      name: 'cp_granary_pro_rc8',
      execConfig: 'etf2l_9v9_5cp',
    },
    {
      name: 'cp_gullywash_final1',
      execConfig: 'etf2l_9v9_5cp',
    },
    {
      name: 'cp_metalworks',
      execConfig: 'etf2l_9v9_5cp',
    },
    {
      name: 'koth_product_final',
      execConfig: 'etf2l_9v9_koth',
    },
    {
      name: 'koth_bagel_rc6',
      execConfig: 'etf2l_9v9_koth',
    },
    {
      name: 'koth_king_rc6',
      execConfig: 'etf2l_9v9_koth',
    },
    {
      name: 'koth_viaduct_rc4',
      execConfig: 'etf2l_9v9_koth',
    },
  ],
  ultiduo: [
    {
      name: 'koth_product_final',
      execConfig: 'etf2l_ultiduo',
    },
    {
      name: 'koth_bagel_rc6',
      execConfig: 'etf2l_ultiduo',
    },
    {
      name: 'koth_ultiduo_rc2b',
      execConfig: 'etf2l_ultiduo',
    },
  ],
}

export async function reset(queue: QueueId): Promise<MapPoolEntry[]> {
  return set(
    queue,
    defaultMapPools[queue].map(map => ({ queue, ...map })),
  )
}
