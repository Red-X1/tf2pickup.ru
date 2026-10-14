import { requestContext } from '@fastify/request-context'
import { collections } from '../../database/collections'
import { GameState } from '../../database/models/game.model'
import { GameLiveIndicator } from './game-live-indicator'
import { IconDeviceGamepad } from './icons'

export async function GamesLink(props?: { variant?: 'sidebar' }) {
  const gamesLiveCount = await collections.games.countDocuments({
    state: {
      $in: [GameState.created, GameState.configuring, GameState.launching, GameState.started],
    },
  })
  const url = requestContext.get('url')
  const isActive = url === '/games'

  if (props?.variant === 'sidebar') {
    return (
      <a
        href="/games"
        class={['format-sidebar-item', 'format-sidebar-nav-item', isActive && 'active']}
        id="leftbar-games-link"
        data-accent={gamesLiveCount > 0 ? 'true' : undefined}
        aria-current={isActive ? 'page' : undefined}
        preload="mousedown"
      >
        <IconDeviceGamepad size={18} />
        <span class="format-sidebar-label" safe>
          Games
        </span>
        <span class="tooltip" data-placement="right">
          Games
        </span>
        {gamesLiveCount > 0 && (
          <span class="format-sidebar-indicator">
            <GameLiveIndicator />
          </span>
        )}
      </a>
    )
  }

  return (
    <a
      href="/games"
      class="nav-menu-item"
      data-accent={gamesLiveCount > 0 ? 'true' : undefined}
      id="navbar-games-link"
      aria-current={isActive ? 'page' : undefined}
    >
      {gamesLiveCount > 0 ? <GameLiveIndicator /> : <></>}
      Games
    </a>
  )
}
