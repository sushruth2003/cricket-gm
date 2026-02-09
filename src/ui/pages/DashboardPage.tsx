import { useMemo, useState } from 'react'
import { useApp } from '@/ui/useApp'
import { formatCr } from '@/ui/format/currency'

const parseSeasonIndex = (seasonId: string | undefined): number | null => {
  if (!seasonId) {
    return null
  }
  const match = seasonId.match(/(\d+)$/)
  if (!match) {
    return null
  }
  return Number(match[1])
}

export const DashboardPage = () => {
  const { state, actions, views, leagues, activeLeagueId, switchingLeague, loading, errorMessage } = useApp()
  const [newLeagueName, setNewLeagueName] = useState('')

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) ?? null,
    [activeLeagueId, leagues],
  )

  const seasonIndex = parseSeasonIndex(activeLeague?.activeSeasonId)
  const played = state ? state.fixtures.filter((match) => match.played).length : 0
  const pending = state ? state.fixtures.length - played : 0
  const userTeam = state ? state.teams.find((team) => team.id === state.userTeamId) : null

  const onCreateLeague = async () => {
    await actions.createLeague({
      name: newLeagueName.trim() || undefined,
    })
    setNewLeagueName('')
  }

  return (
    <section className="grid">
      <article className="card">
        <h2>League Management</h2>
        {errorMessage && <p role="alert">{errorMessage}</p>}
        {loading && <p>Loading league data...</p>}
        {!loading && leagues.length === 0 && <p>No leagues yet. Create a league to begin.</p>}
        {leagues.length > 0 && (
          <>
            <p>
              Active League: <strong>{activeLeague?.name ?? activeLeagueId ?? 'Unknown'}</strong>
            </p>
            <div className="actions">
              <label htmlFor="league-select">Switch League</label>
              <select
                id="league-select"
                value={activeLeagueId ?? ''}
                onChange={(event) => void actions.selectLeague(event.target.value)}
                disabled={switchingLeague}
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="actions">
          <input
            aria-label="New league name"
            placeholder="League name"
            value={newLeagueName}
            onChange={(event) => setNewLeagueName(event.target.value)}
          />
          <button onClick={() => void onCreateLeague()}>Create League</button>
          <button onClick={() => void actions.loadLeagues()} disabled={loading}>
            Refresh Leagues
          </button>
        </div>
      </article>

      <article className="card">
        <h2>Season Status</h2>
        {state ? (
          <>
            <p>Season: {seasonIndex ? `Season ${seasonIndex}` : activeLeague?.activeSeasonId ?? 'Unknown'}</p>
            <p>Phase: {state.phase}</p>
            <p>Auction Type: {(activeLeague as { auctionType?: string } | null)?.auctionType ?? 'N/A'}</p>
            <p>Played Matches: {played}</p>
            <p>Remaining Matches: {pending}</p>
            <div className="actions">
              <button onClick={() => void actions.simulateMatch()} disabled={state.phase === 'auction'}>
                Sim Next Match
              </button>
              <button onClick={() => void actions.simulateSeason()} disabled={state.phase === 'auction' || state.phase === 'complete'}>
                Sim Full Season
              </button>
            </div>
          </>
        ) : (
          <p>Select or create a league to view season details.</p>
        )}
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
