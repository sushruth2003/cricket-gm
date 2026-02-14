import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { formatCr } from '@/ui/format/currency'
import { useApp } from '@/ui/useApp'

const statusChipClass = (status: string) => {
  if (status === 'sold') {
    return 'chip chipSuccess'
  }
  if (status === 'unsold') {
    return 'chip chipDanger'
  }
  return 'chip chipWarning'
}

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

  const effectiveJumpPlayerId =
    jumpPlayerId && pendingEntries.some((entry) => entry.playerId === jumpPlayerId) ? jumpPlayerId : (pendingEntries[0]?.playerId ?? '')

  if (!state) {
    return <p className="panel panelBody">Create a league first.</p>
  }
  if (state.phase === 'preseason' && state.auction.complete) {
    return <Navigate to="/roster" replace />
  }

  const soldCount = views.auctionEntries.filter((entry) => entry.status === 'sold').length
  const unsoldCount = views.auctionEntries.filter((entry) => entry.status === 'unsold').length
  const pendingCount = pendingEntries.length

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Auction</h1>
        <p className="pageMeta">Policy-aware auction control with nomination queue and lot actions.</p>
        <div className="pageSubnav">
          <span className="chip chipInfo">Phase: {state.auction.phase}</span>
          <span className="chip chipWarning">Pending: {pendingCount}</span>
          <span className="chip chipSuccess">Sold: {soldCount}</span>
          <span className="chip chipDanger">Unsold: {unsoldCount}</span>
        </div>
      </header>

      <section className="panel">
        <div className="panelBody">
          <p className="muted">{state.auction.message}</p>

          <div className="inlinePanel">
            <h3>Jump To A Player</h3>
            <div className="controlRow">
              <input
                className="searchInput"
                type="text"
                value={jumpSearch}
                onChange={(event) => setJumpSearch(event.target.value)}
                placeholder="Search pending players"
                disabled={state.auction.complete || saving || pendingEntries.length === 0}
              />
              <select
                className="selectControl"
                value={effectiveJumpPlayerId}
                onChange={(event) => setJumpPlayerId(event.target.value)}
                disabled={state.auction.complete || saving || jumpOptions.length === 0}
              >
                {jumpOptions.map((entry) => (
                  <option key={entry.playerId} value={entry.playerId}>
                    {entry.playerName} ({formatCr(entry.basePrice)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btnSecondary"
                onClick={() => actions.auctionSkipToPlayer(effectiveJumpPlayerId)}
                disabled={
                  state.auction.complete ||
                  saving ||
                  !effectiveJumpPlayerId ||
                  effectiveJumpPlayerId === state.auction.currentPlayerId ||
                  !pendingEntries.some((entry) => entry.playerId === effectiveJumpPlayerId)
                }
              >
                Skip To Player
              </button>
            </div>
          </div>

          {currentEntry ? (
            <div className="inlinePanel">
              <h3>{currentEntry.playerName}</h3>
              <p>
                Base: {formatCr(currentEntry.basePrice)} | Current: {formatCr(state.auction.currentBid)} | Next:{' '}
                {formatCr(state.auction.currentBid + state.auction.currentBidIncrement)}
              </p>
              <p className="muted">
                Last season: {currentEntry.lastSeasonMatches}M, {currentEntry.lastSeasonRuns}R, {currentEntry.lastSeasonWickets}W, SR{' '}
                {currentEntry.lastSeasonStrikeRate.toFixed(1)}, Econ {currentEntry.lastSeasonEconomy.toFixed(1)}
              </p>
              <p className="muted">
                Ratings: Bat {currentEntry.battingRating} | Bowl {currentEntry.bowlingRating} | Field {currentEntry.fieldingRating} | OVR{' '}
                {currentEntry.overallRating}
              </p>
              <div className="actions">
                <button className="btnSuccess" onClick={() => actions.auctionBid()} disabled={state.auction.complete || saving}>
                  Bid Next
                </button>
                <button className="btnSecondary" onClick={() => actions.auctionPass()} disabled={state.auction.complete || saving}>
                  Pass Lot
                </button>
                <button className="btnPrimary" onClick={() => actions.auctionAuto()} disabled={state.auction.complete || saving}>
                  Auto This Turn
                </button>
                <button className="btnGhost" onClick={() => actions.runAuction()} disabled={state.auction.complete || saving}>
                  Auto Complete Auction
                </button>
              </div>
            </div>
          ) : (
            <button className="btnGhost" onClick={() => actions.runAuction()} disabled={state.auction.complete || saving}>
              {state.auction.complete ? 'Auction Complete' : 'Auto Complete Auction'}
            </button>
          )}

          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Set</th>
                  <th>Status</th>
                  <th className="numCell">Base</th>
                  <th>Prev Season</th>
                  <th className="numCell">Bat</th>
                  <th className="numCell">Bowl</th>
                  <th className="numCell">Field</th>
                  <th className="numCell">OVR</th>
                  <th>Sold To</th>
                  <th className="numCell">Price</th>
                </tr>
              </thead>
              <tbody>
                {pendingEntries.slice(0, 120).map((entry) => (
                  <tr key={entry.playerId}>
                    <td>{entry.playerName}</td>
                    <td>{entry.phase}</td>
                    <td>
                      <span className={statusChipClass(entry.status)}>{entry.status}</span>
                    </td>
                    <td className="numCell">{formatCr(entry.basePrice)}</td>
                    <td>
                      {entry.lastSeasonRuns}R/{entry.lastSeasonWickets}W ({entry.lastSeasonMatches}M)
                    </td>
                    <td className="numCell">{entry.battingRating}</td>
                    <td className="numCell">{entry.bowlingRating}</td>
                    <td className="numCell">{entry.fieldingRating}</td>
                    <td className="numCell">{entry.overallRating}</td>
                    <td>{entry.soldToTeam ?? '--'}</td>
                    <td className="numCell">{formatCr(entry.finalPrice)}</td>
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
        </div>
      </section>
    </>
  )
}
