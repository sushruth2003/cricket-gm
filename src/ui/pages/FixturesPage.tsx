import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import type { MatchResult } from '@/domain/types'
import { useApp } from '@/ui/useApp'

const PLAYOFF_QUALIFIER_1_ID = 'playoff-qualifier-1'
const PLAYOFF_ELIMINATOR_ID = 'playoff-eliminator'
const PLAYOFF_QUALIFIER_2_ID = 'playoff-qualifier-2'
const PLAYOFF_FINAL_ID = 'playoff-final'

const getFixtureStatus = (match: MatchResult | undefined): string => {
  if (!match) {
    return 'Awaiting qualification'
  }
  if (!match.played) {
    return `Scheduled: ${match.scheduledAt ?? 'TBD'}`
  }
  return match.margin || 'Completed'
}

const getFixtureTeams = (
  match: MatchResult | undefined,
  teamNameById: Map<string, string>,
  fallbackHome: string,
  fallbackAway: string,
): [string, string] => {
  if (!match) {
    return [fallbackHome, fallbackAway]
  }
  return [teamNameById.get(match.homeTeamId) ?? 'TBD', teamNameById.get(match.awayTeamId) ?? 'TBD']
}

export const FixturesPage = () => {
  const { state, actions, views } = useApp()
  const [viewMode, setViewMode] = useState<'list' | 'bracket'>('list')

  const teamNameById = useMemo(() => {
    if (!state) {
      return new Map<string, string>()
    }
    return new Map(state.teams.map((team) => [team.id, team.shortName]))
  }, [state])

  const fixtureById = useMemo(() => {
    if (!state) {
      return new Map<string, MatchResult>()
    }
    return new Map(state.fixtures.map((fixture) => [fixture.id, fixture]))
  }, [state])

  const qualifier1 = fixtureById.get(PLAYOFF_QUALIFIER_1_ID)
  const eliminator = fixtureById.get(PLAYOFF_ELIMINATOR_ID)
  const qualifier2 = fixtureById.get(PLAYOFF_QUALIFIER_2_ID)
  const final = fixtureById.get(PLAYOFF_FINAL_ID)
  const hasPlayoffFixtures = Boolean(qualifier1 || eliminator || qualifier2 || final)

  const [qualifier1Home, qualifier1Away] = getFixtureTeams(qualifier1, teamNameById, 'Seed #1', 'Seed #2')
  const [eliminatorHome, eliminatorAway] = getFixtureTeams(eliminator, teamNameById, 'Seed #3', 'Seed #4')
  const [qualifier2Home, qualifier2Away] = getFixtureTeams(qualifier2, teamNameById, 'Loser Q1', 'Winner Eliminator')
  const [finalHome, finalAway] = getFixtureTeams(final, teamNameById, 'Winner Q1', 'Winner Q2')
  const champion = final?.played && final.winnerTeamId ? (teamNameById.get(final.winnerTeamId) ?? 'TBD') : null

  if (!state) {
    return <p className="card">Create a league first.</p>
  }
  const canSimulate = state.phase === 'regular-season' || state.phase === 'playoffs'

  return (
    <section className="card">
      <div className="fixturesHeader">
        <h2>Fixtures</h2>
        <div className="viewToggle" role="tablist" aria-label="Fixture display">
          <button type="button" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>
            List View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bracket')}
            className={viewMode === 'bracket' ? 'active' : ''}
            disabled={!hasPlayoffFixtures}
            title={hasPlayoffFixtures ? 'Show playoff bracket' : 'Bracket appears once playoffs are scheduled'}
          >
            Playoff Bracket
          </button>
        </div>
      </div>
      <div className="actions">
        <button onClick={() => actions.simulateMatch()} disabled={!canSimulate}>
          Sim Next Date
        </button>
        <button onClick={() => actions.simulateSeason()} disabled={!canSimulate}>
          Sim Remaining
        </button>
      </div>
      {viewMode === 'bracket' && hasPlayoffFixtures ? (
        <div className="playoffBracketWrap">
          <div className="playoffBracket">
            <section className="bracketColumn">
              <h3>Qualifier Stage</h3>
              <article className="playoffMatchCard">
                <p className="playoffMatchLabel">Qualifier 1</p>
                <p>{qualifier1Home}</p>
                <p>{qualifier1Away}</p>
                <p className="playoffStatus">{getFixtureStatus(qualifier1)}</p>
                {qualifier1 ? (
                  <Link className="fixtureLink" to={`/fixtures/${qualifier1.id}`}>
                    {qualifier1.played ? 'Scorecard' : 'Preview'}
                  </Link>
                ) : null}
              </article>
              <article className="playoffMatchCard">
                <p className="playoffMatchLabel">Eliminator</p>
                <p>{eliminatorHome}</p>
                <p>{eliminatorAway}</p>
                <p className="playoffStatus">{getFixtureStatus(eliminator)}</p>
                {eliminator ? (
                  <Link className="fixtureLink" to={`/fixtures/${eliminator.id}`}>
                    {eliminator.played ? 'Scorecard' : 'Preview'}
                  </Link>
                ) : null}
              </article>
            </section>
            <section className="bracketColumn">
              <h3>Qualifier 2</h3>
              <article className="playoffMatchCard">
                <p className="playoffMatchLabel">Challenger</p>
                <p>{qualifier2Home}</p>
                <p>{qualifier2Away}</p>
                <p className="playoffStatus">{getFixtureStatus(qualifier2)}</p>
                {qualifier2 ? (
                  <Link className="fixtureLink" to={`/fixtures/${qualifier2.id}`}>
                    {qualifier2.played ? 'Scorecard' : 'Preview'}
                  </Link>
                ) : null}
              </article>
            </section>
            <section className="bracketColumn">
              <h3>Final</h3>
              <article className="playoffMatchCard">
                <p className="playoffMatchLabel">Championship</p>
                <p>{finalHome}</p>
                <p>{finalAway}</p>
                <p className="playoffStatus">{getFixtureStatus(final)}</p>
                {final ? (
                  <Link className="fixtureLink" to={`/fixtures/${final.id}`}>
                    {final.played ? 'Scorecard' : 'Preview'}
                  </Link>
                ) : null}
              </article>
              <article className="playoffChampionCard">
                <p className="playoffMatchLabel">Champion</p>
                <strong>{champion ?? 'To be decided'}</strong>
              </article>
            </section>
          </div>
        </div>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Date</th>
                <th>Home</th>
                <th>Away</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {views.matches.map((match) => (
                <tr key={match.id}>
                  <td>{match.round}</td>
                  <td>{match.scheduledAt ?? 'TBD'}</td>
                  <td>{state.teams.find((team) => team.id === match.homeTeamId)?.shortName}</td>
                  <td>{state.teams.find((team) => team.id === match.awayTeamId)?.shortName}</td>
                  <td>{match.played ? match.margin : 'Pending'}</td>
                  <td>
                    <Link className="fixtureLink" to={`/fixtures/${match.id}`}>
                      {match.played ? 'Scorecard' : 'Preview'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
