import { formatCr } from '@/ui/format/currency'
import { useApp } from '@/ui/useApp'

export const AuctionPage = () => {
  const { state, actions, views, saving } = useApp()

  const currentEntry = state?.auction.currentPlayerId
    ? (views.auctionEntries.find((entry) => entry.playerId === state.auction.currentPlayerId) ?? null)
    : null

  if (!state) {
    return <p className="card">Create a league first.</p>
  }

  const soldCount = views.auctionEntries.filter((entry) => entry.status === 'sold').length
  const unsoldCount = views.auctionEntries.filter((entry) => entry.status === 'unsold').length

  return (
    <section className="card">
      <h2>Auction</h2>
      <p>Season 1 rules: open auction only, no RTM/retentions. Purse is ₹120 Cr per team with 18-25 squad size and max 8 overseas players.</p>
      <p>
        Phase: <strong>{state.auction.phase}</strong> | Sold: <strong>{soldCount}</strong> | Unsold: <strong>{unsoldCount}</strong>
      </p>
      <p>{state.auction.message}</p>

      {currentEntry ? (
        <div className="card" style={{ margin: '0.75rem 0' }}>
          <h3 style={{ marginTop: 0 }}>{currentEntry.playerName}</h3>
          <p>
            Base: {formatCr(currentEntry.basePrice)} | Current: {formatCr(state.auction.currentBid)} | Next: {formatCr(state.auction.currentBid + state.auction.currentBidIncrement)}
          </p>
          <p>
            Last season: {currentEntry.lastSeasonMatches}M, {currentEntry.lastSeasonRuns}R, {currentEntry.lastSeasonWickets}W, SR{' '}
            {currentEntry.lastSeasonStrikeRate.toFixed(1)}, Econ {currentEntry.lastSeasonEconomy.toFixed(1)}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => actions.auctionBid()} disabled={state.auction.complete || saving}>
              Bid Next
            </button>
            <button onClick={() => actions.auctionPass()} disabled={state.auction.complete || saving}>
              Pass Lot
            </button>
            <button onClick={() => actions.auctionAuto()} disabled={state.auction.complete || saving}>
              Auto This Turn
            </button>
            <button onClick={() => actions.runAuction()} disabled={state.auction.complete || saving}>
              Auto Complete Auction
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => actions.runAuction()} disabled={state.auction.complete || saving}>
          {state.auction.complete ? 'Auction Complete' : 'Auto Complete Auction'}
        </button>
      )}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Set</th>
              <th>Status</th>
              <th>Base</th>
              <th>Prev Season</th>
              <th>Sold To</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {views.auctionEntries.slice(0, 80).map((entry) => (
              <tr key={entry.playerId}>
                <td>{entry.playerName}</td>
                <td>{entry.phase}</td>
                <td>{entry.status}</td>
                <td>{formatCr(entry.basePrice)}</td>
                <td>
                  {entry.lastSeasonRuns}R/{entry.lastSeasonWickets}W ({entry.lastSeasonMatches}M)
                </td>
                <td>{entry.soldToTeam ?? 'Unsold'}</td>
                <td>{formatCr(entry.finalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
