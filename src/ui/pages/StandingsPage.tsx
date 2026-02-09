import { useApp } from '@/ui/useApp'
import { formatCr } from '@/ui/format/currency'

export const StandingsPage = () => {
  const { views } = useApp()

  return (
    <section className="card">
      <h2>Standings</h2>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Pts</th>
              <th>W</th>
              <th>L</th>
              <th>Budget</th>
            </tr>
          </thead>
          <tbody>
            {views.teams.map((team) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{team.points}</td>
                <td>{team.wins}</td>
                <td>{team.losses}</td>
                <td>{formatCr(team.budgetRemaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
