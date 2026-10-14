import { z } from 'zod'
import { queueIds } from '../../queue/types/queue-id'

export const mapPoolEntrySchema = z.object({
  queue: z.enum(queueIds),
  name: z.string().trim(),
  execConfig: z.string().optional(),
  cooldown: z.number().optional(),
})

export const mapPoolSchema = z
  .array(mapPoolEntrySchema)
  .refine(maps => maps.length >= 3, 'map pool must contain at least 3 maps')

export type MapPoolEntry = z.infer<typeof mapPoolEntrySchema>
