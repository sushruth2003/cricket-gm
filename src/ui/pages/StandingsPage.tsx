import { useApp } from '@/ui/useApp'
import { formatCr } from '@/ui/format/currency'

export const StandingsPage = () => {
  const { state, views } = useApp()

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Standings</h1>
        <p className="pageMeta">Season leaderboard with team points, results, and remaining purse.</p>
      </header>

      <section className="panel">
        <div className="panelBody">
          <div className="topControls">
            <span className="chip chipInfo">Conference View</span>
            <span className="chip chipWarning">Season Table</span>
          </div>
          <div className="tableShell tableShellSpaced">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="numCell">Pts</th>
                  <th className="numCell">W</th>
                  <th className="numCell">L</th>
                  <th className="numCell">Budget</th>
                </tr>
              </thead>
              <tbody>
                {views.teams.map((team) => (
                  <tr key={team.id} className={team.id === state?.userTeamId ? 'rowActive' : ''}>
                    <td>{team.name}</td>
                    <td className="numCell">{team.points}</td>
                    <td className="numCell">{team.wins}</td>
                    <td className="numCell">{team.losses}</td>
                    <td className="numCell">{formatCr(team.budgetRemaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}
