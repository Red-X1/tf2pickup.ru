import fp from 'fastify-plugin'
import { debounce } from 'es-toolkit'
import { events } from '../../events'
import { OnlinePlayerList } from '../views/html/online-player-list'
import { safe } from '../../utils/safe'
import { QueueSlot } from '../views/html/queue-slot'
import { collections } from '../../database/collections'
import type { SteamId64 } from '../../shared/types/steam-id-64'
import { ReadyUpDialog } from '../views/html/ready-up-dialog'
import { QueueState } from '../../database/models/queue-state.model'
import { MapResult, MapVote } from '../views/html/map-vote'
import { SetTitle } from '../views/html/set-title'
import { SubstitutionRequests } from '../views/html/substitution-requests'
import { RunningGameSnackbar } from '../views/html/running-game-snackbar'
import { StreamList } from '../views/html/stream-list'
import { BanAlerts } from '../views/html/ban-alerts'
import { CurrentPlayerCount } from '../views/html/current-player-count'
import { PreReadyUpButton } from '../../pre-ready/views/html/pre-ready-up-button'
import { OnlinePlayerCount } from '../views/html/online-player-count'
import { ChatMessages } from '../views/html/chat'
import { IsInQueue } from '../views/html/is-in-queue'
import type { PlayerModel } from '../../database/models/player.model'
import type { AppWebSocket } from '../../websocket/types'
import { players } from '../../players'
import { errors } from '../../errors'
import { getState } from '../../queue/get-state'
import { queueIds } from '../../queue/types/queue-id'
import type { QueueId } from '../../queue/types/queue-id'
import { queueUrl, queueUrls } from '../../queue/types/queue-url'
import { FormatSidebarCounts } from '../views/html/format-sidebar'

export default fp(
  // eslint-disable-next-line @typescript-eslint/require-await
  async app => {
    type QueueSlotActor = Pick<
      PlayerModel,
      'steamId' | 'bans' | 'activeGame' | 'skill' | 'verified' | 'roles'
    >

    async function syncAllSlots(
      queue: QueueId,
      actorMap: Map<SteamId64, QueueSlotActor>,
      ...clients: SteamId64[]
    ) {
      const slots = await collections.queueSlots.find({ queue }).toArray()
      for (const client of clients) {
        const actor = actorMap.get(client)
        if (!actor) {
          throw errors.notFound(`Player with steamId ${client} does not exist`)
        }

        app.gateway
          .to({ players: [actor.steamId] })
          .to({ url: queueUrl(queue) })
          .send(() =>
            Promise.all(slots.map(slot => QueueSlot({ slot, actor }))).then(arr => arr.join()),
          )
      }
    }

    async function syncAllSlotsForPlayer(steamId: SteamId64) {
      const actorMap = await fetchActorMap([steamId])
      await Promise.all(queueIds.map(queue => syncAllSlots(queue, actorMap, steamId)))
    }

    async function findReadyQueuesForPlayer(steamId: SteamId64): Promise<QueueId[]> {
      const slots = await collections.queueSlots
        .find({ 'player.steamId': steamId, ready: false })
        .toArray()
      const readyQueues: QueueId[] = []
      for (const slot of slots) {
        if ((await getState(slot.queue)) === QueueState.ready) {
          readyQueues.push(slot.queue)
        }
      }
      return readyQueues
    }

    async function syncQueuePage(socket: AppWebSocket, queue: QueueId) {
      const slots = await collections.queueSlots.find({ queue }).toArray()
      const actor = socket.player
        ? await players.bySteamId(socket.player.steamId, [
            'steamId',
            'bans',
            'activeGame',
            'skill',
            'verified',
            'roles',
          ])
        : undefined
      slots.forEach(async slot => {
        socket.send(await QueueSlot({ slot, actor }))
      })
      socket.send(await IsInQueue({ queue, actor: socket.player?.steamId }))
      socket.send(await SubstitutionRequests())
      socket.send(await CurrentPlayerCount({ queue }))
      socket.send(await SetTitle({ queue }))
      socket.send(await OnlinePlayerCount())
      socket.send(await OnlinePlayerList())
      socket.send(await StreamList())
      socket.send(await FormatSidebarCounts())

      if (socket.player) {
        const player = await collections.players.findOne<Pick<PlayerModel, 'activeGame'>>(
          { steamId: socket.player.steamId },
          { projection: { activeGame: 1 } },
        )
        socket.send(await ChatMessages())
        socket.send(await RunningGameSnackbar({ gameNumber: player?.activeGame }))
        socket.send(await PreReadyUpButton({ actor: socket.player.steamId }))
        socket.send(await BanAlerts({ actor: socket.player.steamId }))

        const readyQueues = await findReadyQueuesForPlayer(socket.player.steamId)
        if (readyQueues.length > 0) {
          socket.send(await ReadyUpDialog.show(socket.player.steamId, readyQueues))
        }
      }
    }

    app.gateway.on('ready', async socket => {
      const queue = socket.currentUrl ? queueUrlFromSocket(socket) : undefined
      if (!queue) {
        return
      }

      await syncQueuePage(socket, queue)
    })

    app.gateway.on('navigated', async (socket, url) => {
      const path = url.split('?')[0] ?? url
      const queue = queueUrls.includes(path) ? (path.slice(1) as QueueId) : undefined
      if (!queue) {
        return
      }

      await syncQueuePage(socket, queue)
    })

    function queueUrlFromSocket(socket: AppWebSocket): QueueId | undefined {
      if (!socket.currentUrl) {
        return undefined
      }
      const path = socket.currentUrl.split('?')[0] ?? socket.currentUrl
      return queueUrls.includes(path) ? (path.slice(1) as QueueId) : undefined
    }

    const updateOnlinePlayers = debounce(
      safe(async () => {
        const [opl, opc] = await Promise.all([OnlinePlayerList(), OnlinePlayerCount()])
        app.gateway.to({ urls: queueUrls }).send(() => [opl, opc])
      }),
      300,
    )

    events.on('player:connected', updateOnlinePlayers)
    events.on('player:disconnected', updateOnlinePlayers)

    events.on(
      'player/activeGame:updated',
      safe(async ({ steamId, activeGame }) => {
        const cmp = await RunningGameSnackbar({ gameNumber: activeGame })
        app.gateway
          .to({ player: steamId })
          .to({ urls: queueUrls })
          .send(() => cmp)
        // sync across all queues: at game end the player has no queue slot left,
        // yet their join buttons must be re-enabled
        await syncAllSlotsForPlayer(steamId)
      }),
    )

    events.on('player/preReady:updated', ({ steamId, preReadyUntil }) => {
      app.gateway
        .to({ player: steamId })
        .to({ urls: queueUrls })
        .send(() => PreReadyUpButton({ actor: steamId, preReadyUntil }))
    })

    events.on('queue:playerKicked', async ({ player }) => {
      const close = await ReadyUpDialog.close()
      app.gateway.to({ player }).send(() => close)
    })

    events.on(
      'queue/slots:updated',
      safe(async ({ queue, slots }) => {
        const connectedPlayers = [...(app.websocketServer.clients as Set<AppWebSocket>)]
          .map(c => c.player?.steamId)
          .filter((id): id is SteamId64 => id !== undefined)

        const [playerCount, actorMap, formatCounts] = await Promise.all([
          CurrentPlayerCount({ queue }),
          fetchActorMap(connectedPlayers),
          FormatSidebarCounts(),
        ])

        // scoped to the queue page: slot ids repeat across queue modes, so a
        // global broadcast would id-swap foreign slots into other modes' pages
        const url = queueUrl(queue)
        app.gateway.to({ url }).send(player => {
          const actor = player ? actorMap.get(player) : undefined
          return Promise.all(slots.map(slot => QueueSlot({ slot, actor }))).then(items => [
            ...items,
            playerCount,
          ])
        })

        app.gateway.broadcast(() => formatCounts)
        app.gateway.to({ url }).send(() => SetTitle({ queue }))
      }),
    )

    events.on(
      'queue/state:updated',
      safe(async ({ queue, state }) => {
        const formatCounts = await FormatSidebarCounts()
        app.gateway.broadcast(() => formatCounts)

        if (state === QueueState.ready) {
          const playersInQueue = (
            await collections.queueSlots
              .find({ queue, player: { $ne: null }, ready: { $eq: false } })
              .toArray()
          ).map(s => s.player!.steamId)

          for (const player of playersInQueue) {
            const readyQueues = await findReadyQueuesForPlayer(player)
            if (readyQueues.length > 0) {
              app.gateway.to({ player }).send(() => ReadyUpDialog.show(player, readyQueues))
            }
          }
        }
      }),
    )

    events.on('queue/mapOptions:reset', ({ queue }) => {
      app.gateway.to({ url: queueUrl(queue) }).send(actor => MapVote({ queue, actor }))
    })

    events.on(
      'queue/mapVoteResults:updated',
      safe(async ({ queue, results }) => {
        const mapOptions = await collections.queueMapOptions.find({ queue }).toArray()
        for (const map of mapOptions.map(option => option.name)) {
          app.gateway.to({ url: queueUrl(queue) }).send(() => MapResult({ results, map }))
        }
      }),
    )

    async function fetchActorMap(recipientIds: SteamId64[]) {
      const actors = await collections.players
        .find<
          Pick<PlayerModel, 'steamId' | 'bans' | 'activeGame' | 'skill' | 'verified' | 'roles'>
        >(
          { steamId: { $in: recipientIds } },
          {
            projection: {
              steamId: 1,
              bans: 1,
              activeGame: 1,
              skill: 1,
              verified: 1,
              roles: 1,
            },
          },
        )
        .toArray()
      return new Map(actors.map(actor => [actor.steamId, actor] as const))
    }

    events.on(
      'queue/friendship:created',
      safe(async ({ queue, target }) => {
        const slot = await collections.queueSlots.findOne({
          queue,
          'player.steamId': target,
        })
        if (!slot) {
          return
        }
        const recipientIds = (
          await collections.queueSlots
            .find({ queue, 'canMakeFriendsWith.0': { $exists: true }, player: { $ne: null } })
            .toArray()
        ).map(({ player }) => player!.steamId)
        const actorMap = await fetchActorMap(recipientIds)
        app.gateway
          .to({ players: recipientIds })
          .to({ url: queueUrl(queue) })
          .send(actor => QueueSlot({ slot, actor: actorMap.get(actor!) }))
      }),
    )

    events.on(
      'queue/friendship:updated',
      safe(async ({ queue, target }) => {
        const [slots, friendshipSlots] = await Promise.all([
          collections.queueSlots
            .find({ queue, 'player.steamId': { $in: [target.before, target.after] } })
            .toArray(),
          collections.queueSlots
            .find({ queue, 'canMakeFriendsWith.0': { $exists: true }, player: { $ne: null } })
            .toArray(),
        ])
        const recipients = friendshipSlots.map(({ player }) => player!.steamId)
        const actorMap = await fetchActorMap(recipients)
        for (const slot of slots) {
          app.gateway
            .to({ players: recipients })
            .to({ url: queueUrl(queue) })
            .send(actor => QueueSlot({ slot, actor: actorMap.get(actor!) }))
        }
      }),
    )

    events.on(
      'queue/friendship:removed',
      safe(async ({ queue, target }) => {
        const slot = await collections.queueSlots.findOne({
          queue,
          'player.steamId': target,
        })
        if (!slot) {
          return
        }
        const recipientIds = (
          await collections.queueSlots
            .find({ queue, 'canMakeFriendsWith.0': { $exists: true }, player: { $ne: null } })
            .toArray()
        ).map(({ player }) => player!.steamId)
        const actorMap = await fetchActorMap(recipientIds)
        app.gateway
          .to({ players: recipientIds })
          .to({ url: queueUrl(queue) })
          .send(actor => QueueSlot({ slot, actor: actorMap.get(actor!) }))
      }),
    )

    const refreshSubstitutionRequests = async () => {
      const cmp = await SubstitutionRequests()
      app.gateway.to({ urls: queueUrls }).send(() => cmp)
    }
    events.on('game:substituteRequested', async ({ game, replacee }) => {
      await refreshSubstitutionRequests()
      app.gateway.broadcast(actor => SubstitutionRequests.notify({ game, replacee, actor }))
    })
    events.on('game:playerReplaced', refreshSubstitutionRequests)
    events.on('game:ended', refreshSubstitutionRequests)
    events.on(
      'twitch.tv/streams:updated',
      safe(async () => {
        const cmp = await StreamList()
        app.gateway.to({ urls: queueUrls }).send(() => cmp)
      }),
    )

    const refreshBanAlerts = async (player: SteamId64) => {
      const cmp = await BanAlerts({ actor: player })
      app.gateway.to({ players: [player] }).send(() => cmp)

      setImmediate(async () => {
        await syncAllSlotsForPlayer(player)
      })
    }
    events.on(
      'player/ban:added',
      safe(async ({ player }) => {
        await refreshBanAlerts(player)
      }),
    )
    events.on(
      'player/ban:revoked',
      safe(async ({ player }) => {
        await refreshBanAlerts(player)
      }),
    )

    events.on('chat:messageSent', ({ message, previousMessage }) => {
      app.gateway
        .to({ authenticated: true })
        .to({ urls: queueUrls })
        .send(() =>
          ChatMessages.append({
            message,
            previousMessageAt: previousMessage?.at,
          }),
        )
    })

    events.on('chat:messageDeleted', ({ messageId }) => {
      app.gateway
        .to({ authenticated: true })
        .to({ urls: queueUrls })
        .send(() => ChatMessages.remove(messageId))
    })
  },
  { name: 'update clients' },
)
