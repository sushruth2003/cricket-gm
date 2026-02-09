import type { Player } from '@/domain/types'

export type SortKey = 'name' | 'role' | 'bat' | 'bowl' | 'fielding' | 'fitness' | 'temperament'

export const STARTING_XI_SIZE = 11

const compareValues = (aValue: number | string, bValue: number | string, direction: 'asc' | 'desc') => {
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
  }
  return direction === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
}

const sortValueForPlayer = (player: Player, sortBy: SortKey): number | string => {
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

export const buildInitialDraftOrder = (rosterPlayers: Player[], playingXi: string[]): string[] => {
  const rosterIds = rosterPlayers.map((player) => player.id)
  const rosterIdSet = new Set(rosterIds)
  const xi = playingXi.filter((playerId, index) => rosterIdSet.has(playerId) && playingXi.indexOf(playerId) === index)
  const bench = rosterIds.filter((playerId) => !xi.includes(playerId))
  return [...xi, ...bench]
}

export const sanitizeDraftOrder = (draftOrder: string[], rosterPlayers: Player[], playingXi: string[]): string[] => {
  const baseline = buildInitialDraftOrder(rosterPlayers, playingXi)
  const validIds = new Set(baseline)
  const seen = new Set<string>()
  const cleaned = draftOrder.filter((playerId) => {
    if (!validIds.has(playerId) || seen.has(playerId)) {
      return false
    }
    seen.add(playerId)
    return true
  })
  const missing = baseline.filter((playerId) => !seen.has(playerId))
  return [...cleaned, ...missing]
}

export const movePlayerInOrder = (draftOrder: string[], playerId: string, targetIndex: number): string[] => {
  const sourceIndex = draftOrder.indexOf(playerId)
  if (sourceIndex === -1 || draftOrder.length === 0) {
    return draftOrder
  }
  const boundedTarget = Math.max(0, Math.min(targetIndex, draftOrder.length - 1))
  if (sourceIndex === boundedTarget) {
    return draftOrder
  }
  const next = [...draftOrder]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(boundedTarget, 0, moved)
  return next
}

export const autosortDraftOrder = (
  rosterPlayers: Player[],
  sortBy: SortKey,
  sortDirection: 'asc' | 'desc',
): string[] => {
  return [...rosterPlayers]
    .sort((a, b) => compareValues(sortValueForPlayer(a, sortBy), sortValueForPlayer(b, sortBy), sortDirection))
    .map((player) => player.id)
}

export const resolveActiveWicketkeeper = (
  activeSelection: string[],
  selectedWicketkeeper: string | null,
  persistedWicketkeeper: string | null,
): string | null => {
  if (selectedWicketkeeper && activeSelection.includes(selectedWicketkeeper)) {
    return selectedWicketkeeper
  }
  if (persistedWicketkeeper && activeSelection.includes(persistedWicketkeeper)) {
    return persistedWicketkeeper
  }
  return activeSelection[0] ?? null
}
