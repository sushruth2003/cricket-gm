import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCr } from '@/ui/format/currency'
import { useApp } from '@/ui/useApp'
import {
  buildCompositeAutoLineup,
  buildInitialDraftOrder,
  movePlayerInOrder,
  resolveActiveWicketkeeper,
  sanitizeDraftOrder,
  STARTING_XI_SIZE,
  type SortKey,
} from '@/ui/pages/rosterOrdering'

const toLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export const RosterPage = () => {
  const { state, actions } = useApp()

  const [presetOverrideByTeam, setPresetOverrideByTeam] = useState<
    Record<string, 'balanced' | 'aggressive' | 'defensive' | null>
  >({})
  const [selectedWicketkeeperByTeam, setSelectedWicketkeeperByTeam] = useState<Record<string, string | null>>({})
  const [draftOrderByTeam, setDraftOrderByTeam] = useState<Record<string, string[]>>({})
  const [sortBy, setSortBy] = useState<SortKey>('bat')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null)
  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null)
  const lastAutoSaveKeyRef = useRef<string>('')

  const userTeam = useMemo(() => state?.teams.find((team) => team.id === state.userTeamId), [state])
  const teamId = userTeam?.id ?? null
  const persistedPlayingXi = useMemo(() => userTeam?.playingXi ?? [], [userTeam?.playingXi])
  const persistedWicketkeeper = userTeam?.wicketkeeperPlayerId ?? null
  const persistedBowlingPreset = userTeam?.bowlingPreset ?? 'balanced'
  const rosterPlayers = useMemo(
    () => state?.players.filter((player) => player.teamId === teamId) ?? [],
    [state, teamId],
  )

  const presetOverride = teamId ? presetOverrideByTeam[teamId] ?? null : null
  const selectedWicketkeeper = teamId ? selectedWicketkeeperByTeam[teamId] ?? null : null
  const baseDraftOrder = useMemo(() => {
    if (!teamId) {
      return []
    }
    return draftOrderByTeam[teamId] ?? buildInitialDraftOrder(rosterPlayers, persistedPlayingXi)
  }, [draftOrderByTeam, persistedPlayingXi, rosterPlayers, teamId])

  const normalizedDraftOrder = useMemo(
    () => sanitizeDraftOrder(baseDraftOrder, rosterPlayers, persistedPlayingXi),
    [baseDraftOrder, persistedPlayingXi, rosterPlayers],
  )
  const activeSelection = useMemo(
    () => normalizedDraftOrder.slice(0, Math.min(STARTING_XI_SIZE, normalizedDraftOrder.length)),
    [normalizedDraftOrder],
  )
  const lineupNumberByPlayerId = useMemo(
    () => new Map(activeSelection.map((playerId, index) => [playerId, index + 1])),
    [activeSelection],
  )
  const playersById = useMemo(() => new Map(rosterPlayers.map((player) => [player.id, player])), [rosterPlayers])
  const orderedPlayers = useMemo(
    () => normalizedDraftOrder.map((playerId) => playersById.get(playerId)).filter((player) => Boolean(player)),
    [normalizedDraftOrder, playersById],
  )
  const preset = presetOverride ?? persistedBowlingPreset

  const playerNameById = useMemo(
    () => new Map(rosterPlayers.map((player) => [player.id, `${player.firstName} ${player.lastName}`])),
    [rosterPlayers],
  )

  const activeWicketkeeper = useMemo(
    () => resolveActiveWicketkeeper(activeSelection, selectedWicketkeeper, persistedWicketkeeper),
    [activeSelection, persistedWicketkeeper, selectedWicketkeeper],
  )

  const derived = useMemo(() => {
    if (!userTeam) {
      return {
        starters: 0,
        avgBat: 0,
        avgBowl: 0,
        avgFielding: 0,
        rating: 0,
      }
    }

    const lineup = rosterPlayers.filter((player) => activeSelection.includes(player.id))
    const source = lineup.length ? lineup : rosterPlayers
    const divisor = source.length || 1
    const avgBat = source.reduce((sum, player) => sum + player.ratings.batting.overall, 0) / divisor
    const avgBowl = source.reduce((sum, player) => sum + player.ratings.bowling.overall, 0) / divisor
    const avgFielding = source.reduce((sum, player) => sum + player.ratings.fielding.overall, 0) / divisor

    return {
      starters: activeSelection.length,
      avgBat,
      avgBowl,
      avgFielding,
      rating: (avgBat + avgBowl + avgFielding) / 3,
    }
  }, [activeSelection, rosterPlayers, userTeam])

  useEffect(() => {
    if (!teamId) {
      lastAutoSaveKeyRef.current = ''
      return
    }
    lastAutoSaveKeyRef.current = ''
  }, [teamId])

  useEffect(() => {
    if (!teamId) {
      return
    }
    if (activeSelection.length !== STARTING_XI_SIZE || rosterPlayers.length < STARTING_XI_SIZE || !activeWicketkeeper) {
      return
    }

    const nextKey = `${teamId}|${activeSelection.join(',')}|${activeWicketkeeper}|${preset}`
    const persistedKey = `${teamId}|${persistedPlayingXi.join(',')}|${persistedWicketkeeper ?? ''}|${persistedBowlingPreset}`
    if (nextKey === persistedKey || nextKey === lastAutoSaveKeyRef.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      lastAutoSaveKeyRef.current = nextKey
      void actions
        .updateTeamSetup({
          playingXi: activeSelection,
          wicketkeeperPlayerId: activeWicketkeeper,
          bowlingPreset: preset,
        })
        .catch(() => {
          if (lastAutoSaveKeyRef.current === nextKey) {
            lastAutoSaveKeyRef.current = ''
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    actions,
    activeSelection,
    activeWicketkeeper,
    persistedBowlingPreset,
    persistedPlayingXi,
    persistedWicketkeeper,
    preset,
    rosterPlayers.length,
    teamId,
  ])

  if (!state || !userTeam) {
    return <p className="card">Create a league first.</p>
  }

  const setTeamDraftOrder = (updater: (current: string[]) => string[]) => {
    setDraftOrderByTeam((current) => {
      const source = sanitizeDraftOrder(current[userTeam.id] ?? buildInitialDraftOrder(rosterPlayers, userTeam.playingXi), rosterPlayers, userTeam.playingXi)
      return {
        ...current,
        [userTeam.id]: updater(source),
      }
    })
  }

  const setTeamWicketkeeper = (next: string | null) => {
    setSelectedWicketkeeperByTeam((current) => ({
      ...current,
      [userTeam.id]: next,
    }))
  }

  const toggleStarterStatus = (playerId: string) => {
    setTeamDraftOrder((source) => {
      const index = source.indexOf(playerId)
      if (index === -1) {
        return source
      }

      if (index < STARTING_XI_SIZE) {
        return movePlayerInOrder(source, playerId, source.length - 1)
      }

      const starterBoundary = Math.min(STARTING_XI_SIZE - 1, source.length - 1)
      return movePlayerInOrder(source, playerId, starterBoundary)
    })
  }

  const onSort = (column: SortKey) => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(column)
    setSortDirection(column === 'name' || column === 'role' ? 'asc' : 'desc')
  }

  const sortMarker = (column: SortKey) => (sortBy === column ? (sortDirection === 'asc' ? '▲' : '▼') : '▵')

  const onAutoSort = () => {
    const { draftOrder: nextOrder, wicketkeeperPlayerId } = buildCompositeAutoLineup(rosterPlayers)

    setDraftOrderByTeam((current) => ({
      ...current,
      [userTeam.id]: nextOrder,
    }))
    setTeamWicketkeeper(wicketkeeperPlayerId)
  }

  const onDropOnRow = (targetIndex: number) => {
    if (!draggingPlayerId) {
      return
    }

    setTeamDraftOrder((source) => movePlayerInOrder(source, draggingPlayerId, targetIndex))
    setDraggingPlayerId(null)
    setDragOverPlayerId(null)
  }

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Roster</h1>
        <p className="pageMeta">Manage your XI, bowling preset, and wicketkeeper assignment.</p>
      </header>

      <section className="teamPage">
        <div className="teamPanel">
          <div>
            <h2>{userTeam.name}</h2>
            <p className="teamSub">Roster control and lineup stats</p>
            <div className="teamMetrics">
              <div className="metricTile">
                <span>Record</span>
                <strong>
                  {userTeam.wins}-{userTeam.losses}
                </strong>
              </div>
              <div className="metricTile">
                <span>Team Rating</span>
                <strong>{derived.rating.toFixed(1)}</strong>
              </div>
              <div className="metricTile">
                <span>Available Slots</span>
                <strong>{state.config.maxSquadSize - rosterPlayers.length}</strong>
              </div>
              <div className="metricTile">
                <span>Budget Left</span>
                <strong>{formatCr(userTeam.budgetRemaining)}</strong>
              </div>
            </div>
            <div className="teamLineStats">
              <span>XI: {derived.starters}/11</span>
              <span>Bat: {derived.avgBat.toFixed(1)}</span>
              <span>Bowl: {derived.avgBowl.toFixed(1)}</span>
              <span>Field: {derived.avgFielding.toFixed(1)}</span>
              <span>WK: {activeWicketkeeper ? playerNameById.get(activeWicketkeeper) ?? 'Unknown' : '--'}</span>
            </div>
          </div>

          <div className="teamControls">
            <label>
              Bowling preset
              <select
                value={preset}
                onChange={(event) =>
                  setPresetOverrideByTeam((current) => ({
                    ...current,
                    [userTeam.id]: event.target.value as 'balanced' | 'aggressive' | 'defensive',
                  }))
                }
              >
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
                <option value="defensive">Defensive</option>
              </select>
            </label>

            <button type="button" onClick={onAutoSort} disabled={rosterPlayers.length === 0}>
              Auto Pick XI (Composite)
            </button>
            <p className="teamHint">Drag handles to reorder lineup. Team setup auto-saves when your XI is valid.</p>
          </div>
        </div>

        <div className="tableWrap rosterTableWrap">
          <table className="rosterTable">
          <thead>
            <tr>
              <th>Move</th>
              <th>Lineup</th>
              <th>WK</th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('name')}>
                  Name {sortMarker('name')}
                </button>
              </th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('role')}>
                  Role {sortMarker('role')}
                </button>
              </th>
              <th>Type</th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('bat')}>
                  Bat {sortMarker('bat')}
                </button>
              </th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('bowl')}>
                  Bowl {sortMarker('bowl')}
                </button>
              </th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('fielding')}>
                  Field {sortMarker('fielding')}
                </button>
              </th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('fitness')}>
                  Fit {sortMarker('fitness')}
                </button>
              </th>
              <th>
                <button type="button" className="sortHeader" onClick={() => onSort('temperament')}>
                  Temp {sortMarker('temperament')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedPlayers.map((player, index) => {
              if (!player) {
                return null
              }

              const lineupNumber = lineupNumberByPlayerId.get(player.id)
              const isStarter = typeof lineupNumber === 'number'
              const isBenchStart = index === STARTING_XI_SIZE

              return (
                <tr
                  key={player.id}
                  className={[
                    isStarter ? 'inXi' : 'benchRow',
                    isBenchStart ? 'benchStartRow' : '',
                    draggingPlayerId === player.id ? 'draggingRow' : '',
                    dragOverPlayerId === player.id ? 'dragOverRow' : '',
                  ]
                    .filter((value) => value.length > 0)
                    .join(' ')}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOverPlayerId(player.id)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    onDropOnRow(index)
                  }}
                >
                  <td>
                    <button
                      type="button"
                      className="dragHandle"
                      draggable
                      aria-label={`Drag ${player.firstName} ${player.lastName}`}
                      onDragStart={() => setDraggingPlayerId(player.id)}
                      onDragEnd={() => {
                        setDraggingPlayerId(null)
                        setDragOverPlayerId(null)
                      }}
                      onClick={() => toggleStarterStatus(player.id)}
                    >
                      ≡
                    </button>
                  </td>
                  <td>
                    <span className={isStarter ? 'lineupTag starterTag' : 'lineupTag benchTag'}>
                      {isStarter ? lineupNumber : 'Bench'}
                    </span>
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="designated-wicketkeeper"
                      checked={activeWicketkeeper === player.id}
                      onChange={() => setTeamWicketkeeper(player.id)}
                      disabled={!isStarter}
                    />
                  </td>
                  <td>
                    {player.firstName} {player.lastName}
                  </td>
                  <td>{toLabel(player.role)}</td>
                  <td>
                    <span className={`typeBadge ${player.ratings.bowling.style}`}>
                      {toLabel(player.ratings.bowling.style)}
                    </span>
                  </td>
                  <td>{player.ratings.batting.overall}</td>
                  <td>{player.ratings.bowling.overall}</td>
                  <td>{player.ratings.fielding.overall}</td>
                  <td>{player.ratings.fitness}</td>
                  <td>{player.ratings.temperament}</td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
