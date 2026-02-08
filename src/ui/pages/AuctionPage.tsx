import { useApp } from '@/ui/useApp'

export const AuctionPage = () => {
  const { state, actions, views } = useApp()

  if (!state) {
    return <p className="card">Create a league first.</p>
  }

  return (
    <section className="card">
      <h2>Auction</h2>
      <p>Simplified budget auction with squad limits and fictional players.</p>
      <button onClick={() => actions.runAuction()} disabled={state.auction.complete}>
        {state.auction.complete ? 'Auction Complete' : 'Run Auto Auction'}
      </button>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Sold To</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {views.auctionEntries.slice(0, 40).map((entry) => (
              <tr key={entry.playerId}>
                <td>{entry.playerName}</td>
                <td>{entry.soldToTeam ?? 'Unsold'}</td>
                <td>{entry.finalPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
