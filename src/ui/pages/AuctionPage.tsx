import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { formatCr } from '@/ui/format/currency'
import { useApp } from '@/ui/useApp'

export const AuctionPage = () => {
  const { state, actions, views, saving } = useApp()
  const [jumpSearch, setJumpSearch] = useState('')
  const [jumpPlayerId, setJumpPlayerId] = useState<string>('')

  const currentEntry = state?.auction.currentPlayerId
    ? (views.auctionEntries.find((entry) => entry.playerId === state.auction.currentPlayerId) ?? null)
    : null
  const nominationIndexByPlayerId = useMemo(
    () => new Map((state?.auction.entries ?? []).map((entry, index) => [entry.playerId, index])),
    [state?.auction.entries],
  )
  const pendingEntries = useMemo(() => {
    if (!state) {
      return []
    }
    return views.auctionEntries
      .filter((entry) => entry.status === 'pending')
      .sort((left, right) => {
        if (left.playerId === state.auction.currentPlayerId) {
          return -1
        }
        if (right.playerId === state.auction.currentPlayerId) {
          return 1
        }
        return (nominationIndexByPlayerId.get(left.playerId) ?? Number.MAX_SAFE_INTEGER) - (nominationIndexByPlayerId.get(right.playerId) ?? Number.MAX_SAFE_INTEGER)
      })
  }, [nominationIndexByPlayerId, state, views.auctionEntries])
  const jumpOptions = useMemo(() => {
    const normalized = jumpSearch.trim().toLowerCase()
    if (!normalized) {
      return pendingEntries
    }
    return pendingEntries.filter((entry) => entry.playerName.toLowerCase().includes(normalized))
  }, [jumpSearch, pendingEntries])

  useEffect(() => {
    if (jumpPlayerId && pendingEntries.some((entry) => entry.playerId === jumpPlayerId)) {
      return
    }
    setJumpPlayerId(pendingEntries[0]?.playerId ?? '')
  }, [jumpPlayerId, pendingEntries])

  if (!state) {
    return <p className="card">Create a league first.</p>
  }
  if (state.phase === 'preseason' && state.auction.complete) {
    return <Navigate to="/roster" replace />
  }

  const soldCount = views.auctionEntries.filter((entry) => entry.status === 'sold').length
  const unsoldCount = views.auctionEntries.filter((entry) => entry.status === 'unsold').length
  const pendingCount = pendingEntries.length

  return (
    <section className="card">
      <h2>Auction</h2>
      <p>Policy-aware auction rules are active for this season (mini/mega cycle, purse and RTM/retention controls).</p>
      <p>
        Phase: <strong>{state.auction.phase}</strong> | Upcoming: <strong>{pendingCount}</strong> | Sold: <strong>{soldCount}</strong> | Unsold:{' '}
        <strong>{unsoldCount}</strong>
      </p>
      <p>{state.auction.message}</p>

      <div className="card" style={{ margin: '0.75rem 0' }}>
        <h3 style={{ marginTop: 0 }}>Jump To A Player</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={jumpSearch}
            onChange={(event) => setJumpSearch(event.target.value)}
            placeholder="Search pending players"
            style={{ minWidth: '16rem' }}
            disabled={state.auction.complete || saving || pendingEntries.length === 0}
          />
          <select
            value={jumpPlayerId}
            onChange={(event) => setJumpPlayerId(event.target.value)}
            disabled={state.auction.complete || saving || jumpOptions.length === 0}
            style={{ minWidth: '18rem' }}
          >
            {jumpOptions.map((entry) => (
              <option key={entry.playerId} value={entry.playerId}>
                {entry.playerName} ({formatCr(entry.basePrice)})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => actions.auctionSkipToPlayer(jumpPlayerId)}
            disabled={
              state.auction.complete ||
              saving ||
              !jumpPlayerId ||
              jumpPlayerId === state.auction.currentPlayerId ||
              !pendingEntries.some((entry) => entry.playerId === jumpPlayerId)
            }
          >
            Skip To Player
          </button>
        </div>
      </div>

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
          <p>
            Ratings: Bat {currentEntry.battingRating} | Bowl {currentEntry.bowlingRating} | Field {currentEntry.fieldingRating} | OVR{' '}
            {currentEntry.overallRating}
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
              <th>Bat</th>
              <th>Bowl</th>
              <th>Field</th>
              <th>OVR</th>
              <th>Sold To</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {pendingEntries.slice(0, 120).map((entry) => (
              <tr key={entry.playerId}>
                <td>{entry.playerName}</td>
                <td>{entry.phase}</td>
                <td>{entry.status}</td>
                <td>{formatCr(entry.basePrice)}</td>
                <td>
                  {entry.lastSeasonRuns}R/{entry.lastSeasonWickets}W ({entry.lastSeasonMatches}M)
                </td>
                <td>{entry.battingRating}</td>
                <td>{entry.bowlingRating}</td>
                <td>{entry.fieldingRating}</td>
                <td>{entry.overallRating}</td>
                <td>{entry.soldToTeam ?? '--'}</td>
                <td>{formatCr(entry.finalPrice)}</td>
              </tr>
            ))}
            {pendingEntries.length === 0 ? (
              <tr>
                <td colSpan={11}>No pending players left in the queue.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
