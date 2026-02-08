import { Link } from 'react-router-dom'
import { useApp } from '@/ui/useApp'

export const FixturesPage = () => {
  const { state, actions, views } = useApp()

  if (!state) {
    return <p className="card">Create a league first.</p>
  }

  return (
    <section className="card">
      <h2>Fixtures</h2>
      <div className="actions">
        <button onClick={() => actions.simulateMatch()} disabled={state.phase === 'auction'}>
          Sim Next
        </button>
        <button onClick={() => actions.simulateSeason()} disabled={state.phase === 'auction' || state.phase === 'complete'}>
          Sim Remaining
        </button>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Round</th>
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
    </section>
  )
}
