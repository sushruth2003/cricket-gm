import { useApp } from '@/ui/useApp'

export const DashboardPage = () => {
  const { state, actions, views } = useApp()

  if (!state) {
    return (
      <section className="card">
        <h2>Welcome</h2>
        <p>Create a new fictional league to begin.</p>
        <button onClick={() => actions.createOrLoadLeague()}>Create League</button>
      </section>
    )
  }

  const played = state.fixtures.filter((match) => match.played).length
  const pending = state.fixtures.length - played
  const userTeam = state.teams.find((team) => team.id === state.userTeamId)

  return (
    <section className="grid">
      <article className="card">
        <h2>Season Status</h2>
        <p>Phase: {state.phase}</p>
        <p>Played Matches: {played}</p>
        <p>Remaining Matches: {pending}</p>
        <div className="actions">
          <button onClick={() => actions.simulateMatch()} disabled={state.phase === 'auction'}>
            Sim Next Match
          </button>
          <button onClick={() => actions.simulateSeason()} disabled={state.phase === 'auction' || state.phase === 'complete'}>
            Sim Full Season
          </button>
        </div>
      </article>

      <article className="card">
        <h2>My Franchise</h2>
        {userTeam ? (
          <>
            <p>{userTeam.name}</p>
            <p>Points: {userTeam.points}</p>
            <p>Budget Remaining: {userTeam.budgetRemaining}</p>
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
