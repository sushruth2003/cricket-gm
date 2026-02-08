import { useApp } from '@/ui/useApp'

export const StatsPage = () => {
  const { views } = useApp()

  return (
    <section className="card">
      <h2>Season Leaders</h2>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Runs</th>
              <th>Wickets</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {views.stats.slice(0, 40).map((stat) => (
              <tr key={stat.playerId}>
                <td>{stat.playerName}</td>
                <td>{stat.runs}</td>
                <td>{stat.wickets}</td>
                <td>{stat.strikeRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
