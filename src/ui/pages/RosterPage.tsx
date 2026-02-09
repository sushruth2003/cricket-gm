import { useMemo, useState } from 'react'
import { formatCr } from '@/ui/format/currency'
import { useApp } from '@/ui/useApp'

type SortKey = 'name' | 'role' | 'bat' | 'bowl' | 'fielding' | 'fitness' | 'temperament'

export const RosterPage = () => {
  const { state, actions } = useApp()

  const [presetOverride, setPresetOverride] = useState<'balanced' | 'aggressive' | 'defensive' | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [selectedWicketkeeper, setSelectedWicketkeeper] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('bat')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const userTeam = useMemo(() => state?.teams.find((team) => team.id === state.userTeamId), [state])
  const rosterPlayers = useMemo(
    () => state?.players.filter((player) => player.teamId === userTeam?.id) ?? [],
    [state, userTeam?.id],
  )
  const activeSelection = useMemo(
    () => (selected.length > 0 ? selected : userTeam?.playingXi ?? []),
    [selected, userTeam?.playingXi],
  )
  const preset = presetOverride ?? userTeam?.bowlingPreset ?? 'balanced'
  const playerNameById = useMemo(
    () => new Map(rosterPlayers.map((player) => [player.id, `${player.firstName} ${player.lastName}`])),
    [rosterPlayers],
  )
  const activeWicketkeeper = useMemo(() => {
    const candidate = selectedWicketkeeper ?? userTeam?.wicketkeeperPlayerId ?? null
    if (candidate && activeSelection.includes(candidate)) {
      return candidate
    }
    return activeSelection[0] ?? null
  }, [activeSelection, selectedWicketkeeper, userTeam?.wicketkeeperPlayerId])

  const sortedPlayers = useMemo(() => {
    const sorted = [...rosterPlayers]
    sorted.sort((a, b) => {
      const getValue = (player: (typeof rosterPlayers)[number]) => {
        switch (sortBy) {
          case 'name':
            return `${player.firstName} ${player.lastName}`.toLowerCase()
          case 'role':
            return player.role
          case 'bat':
            return player.ratings.batting.overall
          case 'bowl':
            return player.ratings.bowling.overall
          case 'fielding':
            return player.ratings.fielding.overall
          case 'fitness':
            return player.ratings.fitness
          case 'temperament':
            return player.ratings.temperament
          default:
            return player.ratings.batting.overall
        }
      }
      const aValue = getValue(a)
      const bValue = getValue(b)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }
      return sortDirection === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue)
    })
    return sorted
  }, [rosterPlayers, sortBy, sortDirection])

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

  if (!state || !userTeam) {
    return <p className="card">Create a league and complete auction first.</p>
  }

  const togglePlayer = (playerId: string) => {
    setSelected((current) => {
      const base = current.length > 0 ? current : userTeam.playingXi
      if (base.includes(playerId)) {
        return base.filter((id) => id !== playerId)
      }
      if (base.length >= 11) {
        return base
      }
      return [...base, playerId]
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

  return (
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
              onChange={(event) => setPresetOverride(event.target.value as 'balanced' | 'aggressive' | 'defensive')}
            >
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
              <option value="defensive">Defensive</option>
            </select>
          </label>
          <button
            onClick={() =>
              activeWicketkeeper
                ? actions.updateTeamSetup({
                    playingXi: activeSelection,
                    wicketkeeperPlayerId: activeWicketkeeper,
                    bowlingPreset: preset,
                  })
                : null
            }
            disabled={activeSelection.length !== 11 || rosterPlayers.length < 11 || !activeWicketkeeper}
          >
            Save Team Setup
          </button>
          <p className="teamHint">Pick exactly 11 players, then choose a wicketkeeper from that XI.</p>
        </div>
      </div>

      <div className="tableWrap rosterTableWrap">
        <table className="rosterTable">
          <thead>
            <tr>
              <th>XI</th>
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
            {sortedPlayers.map((player) => (
              <tr key={player.id} className={activeSelection.includes(player.id) ? 'inXi' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={activeSelection.includes(player.id)}
                    onChange={() => togglePlayer(player.id)}
                  />
                </td>
                <td>
                  <input
                    type="radio"
                    name="designated-wicketkeeper"
                    checked={activeWicketkeeper === player.id}
                    onChange={() => setSelectedWicketkeeper(player.id)}
                    disabled={!activeSelection.includes(player.id)}
                  />
                </td>
                <td>
                  {player.firstName} {player.lastName}
                </td>
                <td>{player.role}</td>
                <td>{player.ratings.batting.overall}</td>
                <td>{player.ratings.bowling.overall}</td>
                <td>{player.ratings.fielding.overall}</td>
                <td>{player.ratings.fitness}</td>
                <td>{player.ratings.temperament}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
