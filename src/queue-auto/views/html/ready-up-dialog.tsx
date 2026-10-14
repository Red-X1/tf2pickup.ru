import { nanoid } from 'nanoid'
import type { SteamId64 } from '../../../shared/types/steam-id-64'
import { players } from '../../../players'
import type { QueueId } from '../../../queue/types/queue-id'

const dialogId = 'ready-up-dialog'

export function ReadyUpDialog() {
  return (
    <>
      <dialog
        class="bg-abru-dark-29 w-[616px] rounded-xl px-[59px] py-[42px] shadow-xl"
        id={dialogId}
      >
        <form class="flex flex-col items-center gap-11" data-disable-on-submit>
          <div class="text-abru-light-75 flex flex-col items-center text-[32px] font-bold">
            <span>Game is starting!</span>
            <span>Are you ready to play?</span>
          </div>

          <div class="flex flex-col gap-4" id="ready-up-dialog-queues"></div>
        </form>
      </dialog>
      <div id="ready-up-notification-container" class="hidden"></div>
    </>
  )
}

function ReadyUpButtons(props: { queue: QueueId }) {
  return (
    <div class="flex flex-col gap-2" data-ready-queue={props.queue}>
      <span class="text-abru-light-50 text-center text-lg font-bold" safe>
        {props.queue}
      </span>
      <div class="flex flex-row gap-4">
        <button
          name="ready"
          value={props.queue}
          class="bg-accent-600 w-[242px] rounded-sm py-[12px] text-xl font-bold text-gray-50 uppercase"
          autofocus
          ws-send
          data-umami-event="ready-up"
        >
          I'm ready
        </button>
        <button
          name="leave"
          value={props.queue}
          class="bg-abru-light-5 w-[242px] rounded-sm py-[12px] text-xl font-bold text-gray-50"
          ws-send
          data-umami-event="not-ready"
        >
          No, I can't play now
        </button>
      </div>
    </div>
  )
}

ReadyUpDialog.show = async (actor: SteamId64, queues: QueueId[]) => {
  const player = await players.bySteamId(actor, ['preferences.soundVolume'])
  const id = nanoid()
  return (
    <>
      <div id="ready-up-dialog-queues" hx-swap-oob="innerHTML">
        {queues.map(queue => (
          <ReadyUpButtons queue={queue} />
        ))}
      </div>
      <div id="notify-container" hx-swap-oob="beforeend">
        <div id={id} data-ready-up-dialog-trigger="show"></div>
      </div>
      <div id="ready-up-notification-container">
        <div
          notification-title="Ready up!"
          notification-body="A game is starting"
          notification-icon="/favicon.png"
          data-sound-play="sound-ready-up"
          data-sound-volume={player.preferences.soundVolume ?? 1.0}
        ></div>
      </div>
    </>
  )
}

ReadyUpDialog.close = () => {
  const id = nanoid()
  return (
    <>
      <div id="notify-container" hx-swap-oob="beforeend">
        <div id={id} data-ready-up-dialog-trigger="close"></div>
      </div>
      <div id="ready-up-notification-container"></div>
    </>
  )
}
