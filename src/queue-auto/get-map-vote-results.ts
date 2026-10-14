import { collections } from '../database/collections'
import type { QueueId } from '../queue/types/queue-id'

export async function getMapVoteResults(queue: QueueId): Promise<Record<string, number>> {
  const results = await collections.queueMapOptions
    .aggregate([
      {
        $match: { queue },
      },
      {
        $lookup: {
          from: collections.queueMapVotes.collectionName,
          let: { map: '$name', queue: '$queue' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$map', '$$map'] }, { $eq: ['$queue', '$$queue'] }],
                },
              },
            },
          ],
          as: 'votes',
        },
      },
      {
        $project: {
          _id: 0,
          mapName: '$name',
          count: { $size: '$votes' },
        },
      },
      {
        $group: {
          _id: null,
          results: {
            $push: {
              k: '$mapName',
              v: '$count',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          results: { $arrayToObject: '$results' },
        },
      },
      {
        $replaceRoot: { newRoot: '$results' },
      },
    ])
    .toArray()

  return results[0] ?? {}
}
