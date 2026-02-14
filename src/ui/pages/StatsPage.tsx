import { useApp } from '@/ui/useApp'

export const StatsPage = () => {
  const { views } = useApp()

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Season Leaders</h1>
        <p className="pageMeta">Top batting and bowling output this season.</p>
      </header>

      <section className="panel">
        <div className="panelBody">
          <div className="topControls">
            <span className="chip chipInfo">Top 40</span>
            <span className="chip chipWarning">All Teams</span>
          </div>
          <div className="tableShell tableShellSpaced">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="numCell">Runs</th>
                  <th className="numCell">Wickets</th>
                  <th className="numCell">SR</th>
                </tr>
              </thead>
              <tbody>
                {views.stats.slice(0, 40).map((stat) => (
                  <tr key={stat.playerId}>
                    <td>{stat.playerName}</td>
                    <td className="numCell">{stat.runs}</td>
                    <td className="numCell">{stat.wickets}</td>
                    <td className="numCell">{stat.strikeRate}</td>
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
