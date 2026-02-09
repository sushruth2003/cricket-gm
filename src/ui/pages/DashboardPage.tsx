import { useApp } from '@/ui/useApp'
import { formatCr } from '@/ui/format/currency'

export const DashboardPage = () => {
  const { state, leagues, activeLeagueId, actions, views } = useApp()

  if (!state) {
    return (
      <section className="card">
        <h2>Welcome</h2>
        <p>Create a new fictional league to begin.</p>
        <div className="actions">
          <button onClick={() => actions.createOrLoadLeague()}>Create League</button>
          <button onClick={() => actions.createLeague()}>Create Additional League</button>
        </div>
      </section>
    )
  }

  const played = state.fixtures.filter((match) => match.played).length
  const pending = state.fixtures.length - played
  const userTeam = state.teams.find((team) => team.id === state.userTeamId)

  return (
    <section className="grid">
      <article className="card">
        <h2>League Control</h2>
        <p>Active League: {activeLeagueId ?? 'None'}</p>
        <label>
          Select League:{' '}
          <select value={activeLeagueId ?? ''} onChange={(event) => actions.selectLeague(event.target.value)}>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} ({league.activeSeasonId})
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button onClick={() => actions.createLeague()}>Create New League</button>
        </div>
      </article>

      <article className="card">
        <h2>Season Status</h2>
        <p>Phase: {state.phase}</p>
        <p>Season Start: {new Date(state.metadata.createdAt).toISOString().slice(0, 10)}</p>
        <p>Played Matches: {played}</p>
        <p>Remaining Matches: {pending}</p>
        <div className="actions">
          <button onClick={() => actions.simulateMatch()} disabled={state.phase === 'auction'}>
            Sim Next Match
          </button>
          <button onClick={() => actions.simulateSeason()} disabled={state.phase === 'auction' || state.phase === 'complete'}>
            Sim Full Season
          </button>
          <button onClick={() => actions.advanceSeason()} disabled={state.phase !== 'complete'}>
            Advance To Next Season
          </button>
        </div>
      </article>

      <article className="card">
        <h2>My Franchise</h2>
        {userTeam ? (
          <>
            <p>{userTeam.name}</p>
            <p>Points: {userTeam.points}</p>
            <p>Budget Remaining: {formatCr(userTeam.budgetRemaining)}</p>
          </>
        ) : (
          <p>Not available.</p>
        )}
      </article>

      <article className="card">
        <h2>Top Teams</h2>
        <ol>
          {views.teams.slice(0, 5).map((team) => (
            <li key={team.id}>
              {team.name} ({team.points} pts)
            </li>
          ))}
        </ol>
      </article>
    </section>
  )
}
