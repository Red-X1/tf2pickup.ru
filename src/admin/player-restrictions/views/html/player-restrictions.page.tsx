import { configuration } from '../../../../configuration'
import { Switch } from '../../../../html/components/switch'
import { queueIds } from '../../../../queue/types/queue-id'
import { allGameClasses } from '../../../../queue-auto/all-classes'
import { Admin } from '../../../views/html/admin'
import { SaveButton } from '../../../views/html/save-button'
import { GameClassSkillInput } from '../../../../html/components/game-class-skill-input'

export async function PlayerRestrictionsPage() {
  return (
    <Admin activePage="player-restrictions">
      <form action="" method="post" id="playerRestrictionsForm">
        <div class="admin-panel-set flex flex-col gap-4">
          <RequireEtf2lAccount />
          <MinimumTf2InGameHours />
          <RequirePlayerVerification />
          <PlayerSkillThreshold />
          <SkillStep />
          <SkillSuggestions />
          <DefaultPlayerSkill />

          <p>
            <SaveButton />
          </p>
        </div>
      </form>
    </Admin>
  )
}

async function RequireEtf2lAccount() {
  const etf2lAccountRequired = await configuration.get('players.etf2l_account_required')
  return (
    <div class="group flex flex-row items-center justify-between">
      <dl>
        <dt>
          <label class="text-abru-light-75" for="etf2lAccountRequired">
            Require ETF2L account
          </label>
        </dt>
        <dd class="text-abru-light-75">
          <span class="hidden group-has-checked:inline-block">
            Players that do not have an ETF2L profile will not be able to register
          </span>
          <span class="group-has-checked:hidden">All players will be able to register</span>
        </dd>
      </dl>

      <Switch
        id="etf2lAccountRequired"
        checked={etf2lAccountRequired}
        name="etf2lAccountRequired"
      />
    </div>
  )
}

async function MinimumTf2InGameHours() {
  const minimumInGameHours = await configuration.get('players.minimum_in_game_hours')
  return (
    <dl>
      <dt>
        <label for="minimumInGameHours">Minimum TF2 in-game hours</label>
      </dt>
      <dd>
        <input
          type="text"
          value={minimumInGameHours.toString()}
          id="minimumInGameHours"
          name="minimumInGameHours"
        />
      </dd>
    </dl>
  )
}

async function RequirePlayerVerification() {
  const requirePlayerVerification = await configuration.get('queue.require_player_verification')
  return (
    <div class="flex flex-col gap-2">
      <dl>
        <dt>
          <span class="text-abru-light-75 font-bold">Require player verification</span>
        </dt>
        <dd class="text-abru-light-75 text-sm">
          Players must be manually verified by an admin before they can join the queue
        </dd>
      </dl>
      <div class="flex flex-row flex-wrap gap-4">
        {queueIds.map(queue => (
          <div class="group flex flex-row items-center justify-between gap-4">
            <label class="text-abru-light-75 capitalize" for={`requirePlayerVerification.${queue}`}>
              {queue}
            </label>
            <Switch
              id={`requirePlayerVerification.${queue}`}
              checked={requirePlayerVerification[queue]}
              name={`requirePlayerVerification.${queue}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

async function PlayerSkillThreshold() {
  const playerSkillThreshold = await configuration.get('queue.player_skill_threshold')

  return (
    <div class="flex flex-col gap-2">
      <dl>
        <dt>
          <span class="text-abru-light-75 font-bold">Player skill threshold</span>
        </dt>
        <dd class="text-abru-light-75 text-sm">
          Players will be able to join queue only on classes that meet the given criteria.
        </dd>
      </dl>
      <div class="flex flex-row flex-wrap gap-6">
        {queueIds.map(queue => {
          const enabled = playerSkillThreshold[queue] !== null
          return (
            <dl>
              <dt class="group flex flex-row gap-2">
                <label class="capitalize" for={`playerSkillThresholdEnabled.${queue}`}>
                  {queue}
                </label>
                <input
                  type="checkbox"
                  id={`playerSkillThresholdEnabled.${queue}`}
                  name={`playerSkillThresholdEnabled.${queue}`}
                  value="enabled"
                  checked={enabled}
                />
                <span class="hidden group-has-checked:inline-block">enabled</span>
                <span class="group-has-checked:hidden">disabled</span>
              </dt>
              <dd>
                <label for={`playerSkillThreshold.${queue}`} class="sr-only">
                  Player skill threshold value ({queue})
                </label>
                <input
                  type="number"
                  id={`playerSkillThreshold.${queue}`}
                  name={`playerSkillThreshold.${queue}`}
                  value={playerSkillThreshold[queue]?.toString()}
                />
              </dd>
            </dl>
          )
        })}
      </div>
    </div>
  )
}

async function SkillStep() {
  const skillStep = await configuration.get('games.skill_step')
  return (
    <dl>
      <dt>
        <label for="skillStep">Skill step</label>
      </dt>
      <dd class="flex flex-col">
        <div>
          <input
            type="number"
            id="skillStep"
            name="skillStep"
            value={skillStep.toString()}
            step="0.1"
            min="0.1"
          />
        </div>
        <p class="text-abru-light-75 text-sm">
          Increment/decrement step when adjusting player skill in the admin panel.
        </p>
      </dd>
    </dl>
  )
}

async function SkillSuggestions() {
  const skillSuggestions = await configuration.get('games.skill_suggestions')
  return (
    <div class="group flex flex-row items-center justify-between">
      <dl>
        <dt>
          <label class="text-abru-light-75" for="skillSuggestions">
            Skill suggestions{' '}
            <span class="text-abru-light-35 text-xs font-normal">experimental</span>
          </label>
        </dt>
        <dd class="text-abru-light-75">
          <span class="hidden group-has-checked:inline-block">
            Skill adjustment suggestions are shown in the admin toolbox
          </span>
          <span class="group-has-checked:hidden">No skill suggestions are shown</span>
        </dd>
      </dl>
      <Switch id="skillSuggestions" checked={skillSuggestions} name="skillSuggestions" />
    </div>
  )
}

async function DefaultPlayerSkill() {
  const defaultPlayerSkill = await configuration.get('games.default_player_skill')
  const skillStep = await configuration.get('games.skill_step')
  const classes = allGameClasses()

  return (
    <dl>
      <dt>
        <span class="text-abru-light-75 font-bold">Default player skill</span>
      </dt>
      <dd class="flex flex-col">
        <div class="flex flex-row flex-wrap gap-2">
          {classes.map(gameClass => (
            <GameClassSkillInput
              gameClass={gameClass}
              name={`defaultPlayerSkill.${gameClass}`}
              value={defaultPlayerSkill[gameClass] ?? 1}
              step={skillStep}
            />
          ))}
        </div>
        <p class="text-abru-light-75 text-sm">
          If a player starts a game without skill assigned for them, the game balance system will
          use this fallback value.
        </p>
      </dd>
    </dl>
  )
}
