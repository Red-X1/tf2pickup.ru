import { collections } from '../../../../database/collections'
import { MapThumbnail } from '../../../../html/components/map-thumbnail'
import { queueIds } from '../../../../queue/types/queue-id'

export async function MapVoteOptions() {
  return (
    <div class="flex flex-col gap-6" id="adminPanelMapVoteOptions">
      {await Promise.all(
        queueIds.map(async queue => {
          const mapOptions = await collections.queueMapOptions.find({ queue }).toArray()
          return (
            <div>
              <h3 class="mb-2 text-lg font-bold" safe>
                {queue}
              </h3>
              <div class="grid grid-cols-3 gap-x-4 gap-y-2">
                {mapOptions.map(({ name }) => (
                  <MapThumbnail map={name} />
                ))}

                {mapOptions.map(({ name }) => (
                  <p class="text-center [overflow-wrap:anywhere] max-lg:text-sm" safe>
                    {name}
                  </p>
                ))}
              </div>
            </div>
          )
        }),
      )}
    </div>
  )
}
