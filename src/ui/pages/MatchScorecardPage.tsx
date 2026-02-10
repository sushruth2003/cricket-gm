import { Link, useParams } from 'react-router-dom'
import type { InningsSummary, PlayerBattingLine, PlayerBowlingLine } from '@/domain/types'
import { useApp } from '@/ui/useApp'

const toName = (firstName?: string, lastName?: string) => `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown'

const toOvers = (overs: number) => (Number.isInteger(overs) ? `${overs}.0` : overs.toFixed(1))

const toStrikeRate = (line: PlayerBattingLine) => {
  if (line.balls === 0) {
    return '0.00'
  }
  return ((line.runs / line.balls) * 100).toFixed(2)
}

const toEconomy = (line: PlayerBowlingLine) => {
  if (line.overs === 0) {
    return '0.00'
  }
  return (line.runsConceded / line.overs).toFixed(2)
}

export const MatchScorecardPage = () => {
  const { matchId } = useParams<{ matchId: string }>()
  const { state } = useApp()

  if (!state) {
    return <p className="card">Create a league first.</p>
  }

  const match = state.fixtures.find((item) => item.id === matchId)

  if (!match) {
    return (
      <section className="card">
        <h2>Match not found</h2>
        <Link className="fixtureBackLink" to="/fixtures">
          Back to fixtures
        </Link>
      </section>
    )
  }

  const teamsById = new Map(state.teams.map((team) => [team.id, team]))
  const playersById = new Map(state.players.map((player) => [player.id, player]))
  const homeTeam = teamsById.get(match.homeTeamId)
  const awayTeam = teamsById.get(match.awayTeamId)

  const renderInnings = (innings: InningsSummary, index: number) => {
    const battingTeam = teamsById.get(innings.battingTeamId)
    const bowlingTeam = teamsById.get(innings.bowlingTeamId)
    const wicketkeeper = innings.wicketkeeperPlayerId ? playersById.get(innings.wicketkeeperPlayerId) : null
    const battingRuns = innings.batting.reduce((total, batter) => total + batter.runs, 0)
    const extras = Math.max(0, innings.runs - battingRuns)
    const didNotBatIds = (battingTeam?.playingXi ?? []).filter((playerId) => !innings.batting.some((line) => line.playerId === playerId))

    return (
      <article className="inningsCard" key={`${innings.battingTeamId}-${index}`}>
        <header className="inningsHeader">
          <h3>{battingTeam?.name ?? 'Unknown Team'} Innings</h3>
          <p>
            {innings.runs}/{innings.wickets} ({toOvers(innings.overs)} ov)
          </p>
        </header>
        <div className="scoreTableWrap">
          <table className="scoreTable">
            <thead>
              <tr>
                <th>Batting</th>
                <th>Dismissal</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {innings.batting.map((line) => {
                const player = playersById.get(line.playerId)
                return (
                  <tr key={line.playerId}>
                    <td>{toName(player?.firstName, player?.lastName)}</td>
                    <td>{line.out ? 'out' : 'not out'}</td>
                    <td>{line.runs}</td>
                    <td>{line.balls}</td>
                    <td>{line.fours}</td>
                    <td>{line.sixes}</td>
                    <td>{toStrikeRate(line)}</td>
                  </tr>
                )
              })}
              <tr className="totalsRow">
                <td>Total</td>
                <td>
                  {innings.wickets} wickets ({toOvers(innings.overs)} ov)
                </td>
                <td>{innings.runs}</td>
                <td colSpan={4} />
              </tr>
              <tr>
                <td>Extras</td>
                <td>{extras}</td>
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
        </div>
        {didNotBatIds.length > 0 && (
          <p className="didNotBat">
            <strong>Did not bat:</strong>{' '}
            {didNotBatIds
              .map((playerId) => playersById.get(playerId))
              .filter(Boolean)
              .map((player) => toName(player?.firstName, player?.lastName))
              .join(', ')}
          </p>
        )}
        <div className="scoreTableWrap">
          <table className="scoreTable">
            <thead>
              <tr>
                <th>
                  Bowling ({bowlingTeam?.shortName ?? 'N/A'})
                  {wicketkeeper ? ` - WK: ${toName(wicketkeeper.firstName, wicketkeeper.lastName)}` : ''}
                </th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              {innings.bowling.map((line) => {
                const player = playersById.get(line.playerId)
                return (
                  <tr key={line.playerId}>
                    <td>{toName(player?.firstName, player?.lastName)}</td>
                    <td>{toOvers(line.overs)}</td>
                    <td>{line.runsConceded}</td>
                    <td>{line.wickets}</td>
                    <td>{toEconomy(line)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>
    )
  }

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Match Scorecard</h1>
        <p className="pageMeta">Innings-by-innings batting and bowling breakdown.</p>
      </header>

      <section className="scorecardPage">
        <header className="scorecardHeader">
          <div>
            <p className="scorecardRound">Round {match.round}</p>
            <h2>
              {homeTeam?.name ?? 'Home'} vs {awayTeam?.name ?? 'Away'}
            </h2>
            <p className="scorecardResult">{match.played ? match.margin : 'Match not played yet'}</p>
          </div>
          <Link className="fixtureBackLink" to="/fixtures">
            Back to fixtures
          </Link>
        </header>

        {!match.played || !match.innings ? (
          <section className="card">
            <h3>Scorecard unavailable</h3>
            <p>Simulate this fixture to generate innings-level stats.</p>
          </section>
        ) : (
          <div className="inningsStack">{match.innings.map(renderInnings)}</div>
        )}
      </section>
    </>
  )
}
