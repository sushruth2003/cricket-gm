import { useApp } from '@/ui/useApp'

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
                <td>{team.budgetRemaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
