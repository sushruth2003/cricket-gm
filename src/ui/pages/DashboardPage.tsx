import { useApp } from '@/ui/useApp'
import { formatCr } from '@/ui/format/currency'

export const DashboardPage = () => {
  const { state, leagues, activeLeagueId, actions, views } = useApp()

  if (!state) {
    return (
      <section className="panel">
        <div className="panelBody">
          <h2>Welcome</h2>
          <p className="muted">Create a new fictional league to begin.</p>
          <div className="actions">
            <button className="btnSuccess" onClick={() => actions.createOrLoadLeague()}>
              Create League
            </button>
            <button className="btnSecondary" onClick={() => actions.createLeague()}>
              Create Additional League
            </button>
          </div>
        </div>
      </section>
    )
  }

  const played = state.fixtures.filter((match) => match.played).length
  const pending = state.fixtures.length - played
  const userTeam = state.teams.find((team) => team.id === state.userTeamId)
  const canSimulate = state.phase === 'regular-season' || state.phase === 'playoffs'

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Dashboard</h1>
        <p className="pageMeta">League operations, season controls, and franchise pulse.</p>
      </header>

      <section className="grid">
        <article className="panel">
          <div className="panelHeader">League Control</div>
          <div className="panelBody">
            <p>
              Active League: <span className="chip chipInfo">{activeLeagueId ?? 'None'}</span>
            </p>
            <label>
              Select League:{' '}
              <select className="selectControl" value={activeLeagueId ?? ''} onChange={(event) => actions.selectLeague(event.target.value)}>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name} ({league.activeSeasonId})
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button className="btnSecondary" onClick={() => actions.createLeague()}>
                Create New League
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">Season Status</div>
          <div className="panelBody">
            <div className="metricGrid">
              <div className="metricTile">
                <span>Phase</span>
                <strong>{state.phase}</strong>
              </div>
              <div className="metricTile">
                <span>Season Start</span>
                <strong>{new Date(state.metadata.createdAt).toISOString().slice(0, 10)}</strong>
              </div>
              <div className="metricTile">
                <span>Played</span>
                <strong>{played}</strong>
              </div>
              <div className="metricTile">
                <span>Remaining</span>
                <strong>{pending}</strong>
              </div>
            </div>
            <div className="actions">
              <button className="btnSuccess" onClick={() => actions.simulateMatch()} disabled={!canSimulate}>
                Sim Next Match
              </button>
              <button className="btnPrimary" onClick={() => actions.simulateSeason()} disabled={!canSimulate}>
                Sim Full Season
              </button>
              <button className="btnSecondary" onClick={() => actions.advanceSeason()} disabled={state.phase !== 'complete'}>
                Advance To Next Season
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">My Franchise</div>
          <div className="panelBody">
            {userTeam ? (
              <div className="metricGrid">
                <div className="metricTile">
                  <span>Team</span>
                  <strong>{userTeam.name}</strong>
                </div>
                <div className="metricTile">
                  <span>Points</span>
                  <strong>{userTeam.points}</strong>
                </div>
                <div className="metricTile">
                  <span>Budget Remaining</span>
                  <strong>{formatCr(userTeam.budgetRemaining)}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Not available.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">Top Teams</div>
          <div className="panelBody">
            <ol className="listPlain">
              {views.teams.slice(0, 5).map((team) => (
                <li key={team.id}>
                  <strong>{team.name}</strong> <span className="muted">({team.points} pts)</span>
                </li>
              ))}
            </ol>
          </div>
        </article>
      </section>
    </>
  )
}
