import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import type { MatchResult } from '@/domain/types'
import { useApp } from '@/ui/useApp'

const toOpponent = (match: MatchResult, userTeamId: string) => (match.homeTeamId === userTeamId ? match.awayTeamId : match.homeTeamId)

export const SchedulePage = () => {
  const { state } = useApp()

  const userTeam = state?.teams.find((team) => team.id === state.userTeamId) ?? null
  const teamNameById = useMemo(() => {
    if (!state) {
      return new Map<string, string>()
    }
    return new Map(state.teams.map((team) => [team.id, team.shortName]))
  }, [state])

  if (!state || !userTeam) {
    return <p className="panel panelBody">Create a league first.</p>
  }

  const schedule = state.fixtures
    .filter((match) => match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId)
    .sort((a, b) => {
      const dateA = a.scheduledAt ?? ''
      const dateB = b.scheduledAt ?? ''
      if (dateA === dateB) {
        return a.round - b.round
      }
      return dateA.localeCompare(dateB)
    })

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">My Schedule</h1>
        <p className="pageMeta">All fixtures for {userTeam.name}.</p>
      </header>

      <section className="panel">
        <div className="panelBody">
          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th className="numCell">Round</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Opponent</th>
                  <th>Venue</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schedule.map((match) => {
                  const isHome = match.homeTeamId === state.userTeamId
                  const opponentTeamId = toOpponent(match, state.userTeamId)
                  return (
                    <tr key={match.id} className={match.played ? '' : 'rowMuted'}>
                      <td className="numCell">{match.round}</td>
                      <td>{match.scheduledAt ?? 'TBD'}</td>
                      <td>{isHome ? 'Home' : 'Away'}</td>
                      <td>{teamNameById.get(opponentTeamId) ?? 'TBD'}</td>
                      <td>{match.venue}</td>
                      <td>{match.played ? match.margin : 'Pending'}</td>
                      <td>
                        <Link className="fixtureLink" to={`/fixtures/${match.id}`}>
                          {match.played ? 'Scorecard' : 'Preview'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}
