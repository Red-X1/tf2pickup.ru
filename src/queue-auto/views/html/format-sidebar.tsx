import { requestContext } from '@fastify/request-context'
import { collections } from '../../../database/collections'
import { getState } from '../../../queue/get-state'
import { queueIds, type QueueId } from '../../../queue/types/queue-id'
import { queueFromUrl, queueUrl } from '../../../queue/types/queue-url'
import {
  IconChartPie,
  IconChevronLeft,
  IconChevronRight,
  IconCrown,
  IconSectionSign,
  IconUserCircle,
} from '../../../html/components/icons'
import { GamesLink } from '../../../html/components/games-link'

async function summarizeQueue(queue: QueueId) {
  const [current, required, state] = await Promise.all([
    collections.queueSlots.countDocuments({ queue, player: { $ne: null } }),
    collections.queueSlots.countDocuments({ queue }),
    getState(queue),
  ])
  return { queue, current, required, state }
}

const shortLabel: Record<QueueId, string> = {
  '6v6': '6v6',
  '9v9': '9v9',
  ultiduo: 'ulti',
  '4v4': '4v4',
  '3v3': '3v3',
}

export async function FormatSidebar() {
  const summaries = await Promise.all(queueIds.map(summarizeQueue))
  const active = queueFromUrl(requestContext.get('url') ?? '')

  return (
    <nav id="format-sidebar" class="format-sidebar" aria-label="Navigation">
      <button
        type="button"
        class="format-sidebar-toggle"
        id="format-sidebar-toggle"
        aria-label="Toggle format sidebar"
        data-umami-event="toggle-format-sidebar"
      >
        <span class="format-sidebar-toggle-icon format-sidebar-toggle-collapse">
          <IconChevronLeft size={16} />
        </span>
        <span class="format-sidebar-toggle-icon format-sidebar-toggle-expand">
          <IconChevronRight size={16} />
        </span>
      </button>

      <div class="format-sidebar-items">
        {summaries.map(({ queue, current, required, state }) => (
          <a
            href={queueUrl(queue)}
            preload="mousedown"
            class={['format-sidebar-item', queue === active && 'active']}
            data-format={queue}
            data-state={state}
          >
            <span class="format-sidebar-name" safe>
              {shortLabel[queue]}
            </span>
            <span class="format-sidebar-full" safe>
              {queue}
            </span>
            <span class="format-sidebar-count" id={`format-count-${queue}`}>
              {current}/{required}
            </span>
            <span
              class="format-sidebar-state"
              id={`format-state-${queue}`}
              data-state={state}
            ></span>
          </a>
        ))}
      </div>

      <div class="format-sidebar-nav">
        <GamesLink variant="sidebar" />
        <NavItem href="/players" label="Players" icon={<IconUserCircle size={18} />} />
        <NavItem href="/rules" label="Rules" icon={<IconSectionSign size={18} />} />
        <NavItem href="/hall-of-fame" label="HOF" icon={<IconCrown size={18} />} />
        <NavItem href="/statistics" label="Stats" icon={<IconChartPie size={18} />} />
      </div>
    </nav>
  )
}

export async function FormatSidebarCounts() {
  const summaries = await Promise.all(queueIds.map(summarizeQueue))

  return (
    <>
      {summaries.map(({ queue, current, required, state }) => (
        <>
          <span id={`format-count-${queue}`} hx-swap-oob="true" class="format-sidebar-count">
            {current}/{required}
          </span>
          <span
            id={`format-state-${queue}`}
            hx-swap-oob="true"
            class="format-sidebar-state"
            data-state={state}
          ></span>
        </>
      ))}
    </>
  )
}

function NavItem(props: { href: string; label: string; icon: JSX.Element }) {
  const url = requestContext.get('url')
  const isActive = url === props.href
  return (
    <a
      href={props.href}
      class={['format-sidebar-item', 'format-sidebar-nav-item', isActive && 'active']}
      aria-current={isActive ? 'page' : undefined}
      preload="mousedown"
    >
      {props.icon}
      <span class="format-sidebar-label" safe>
        {props.label}
      </span>
      <span class="tooltip" data-placement="right">
        {props.label}
      </span>
    </a>
  )
}
