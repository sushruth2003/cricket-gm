import type { Player } from '@/domain/types'

export type SortKey = 'name' | 'role' | 'bat' | 'bowl' | 'fielding' | 'fitness' | 'temperament'

export const STARTING_XI_SIZE = 11
const MIN_BOWLING_OPTIONS = 5

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

const compositeScore = (player: Player): number =>
  player.ratings.batting.overall * 0.4 +
  player.ratings.bowling.overall * 0.35 +
  player.ratings.fielding.overall * 0.15 +
  player.ratings.fitness * 0.05 +
  player.ratings.temperament * 0.05

const isWicketkeeperCapable = (player: Player): boolean => {
  return player.role === 'wicketkeeper' || player.ratings.fielding.traits.wicketkeeping >= 62
}

const isBowlingCapable = (player: Player): boolean => {
  return player.role === 'bowler' || player.role === 'allrounder' || player.ratings.bowling.overall >= 64
}

const keeperDesignationScore = (player: Player): number => {
  const roleBonus = player.role === 'wicketkeeper' ? 22 : 0
  const keeping = player.ratings.fielding.traits.wicketkeeping * 1.25
  const fielding = player.ratings.fielding.overall * 0.25
  const bowlingOpportunityCost = player.ratings.bowling.overall * 0.9
  return roleBonus + keeping + fielding - bowlingOpportunityCost
}

const compareByComposite = (left: Player, right: Player) => {
  const scoreDelta = compositeScore(right) - compositeScore(left)
  if (scoreDelta !== 0) {
    return scoreDelta
  }
  return left.id.localeCompare(right.id)
}

const chooseDesignatedKeeper = (players: Player[]): Player | null => {
  const candidates = players.filter((player) => isWicketkeeperCapable(player)).sort((a, b) => {
    const scoreDelta = keeperDesignationScore(b) - keeperDesignationScore(a)
    if (scoreDelta !== 0) {
      return scoreDelta
    }
    return a.id.localeCompare(b.id)
  })
  return candidates[0] ?? null
}

const countBowlingOptionsExcludingKeeper = (players: Player[], keeperId: string | null): number => {
  return players.filter((player) => player.id !== keeperId && isBowlingCapable(player)).length
}

export const buildCompositeAutoLineup = (
  rosterPlayers: Player[],
): { draftOrder: string[]; wicketkeeperPlayerId: string | null } => {
  const byComposite = [...rosterPlayers].sort(compareByComposite)
  const startersCount = Math.min(STARTING_XI_SIZE, byComposite.length)
  const selected = byComposite.slice(0, startersCount)

  const replaceInXi = (fromXi: Player | undefined, fromBench: Player | undefined) => {
    if (!fromXi || !fromBench) {
      return
    }
    const xiIndex = selected.findIndex((candidate) => candidate.id === fromXi.id)
    if (xiIndex === -1) {
      return
    }
    selected[xiIndex] = fromBench
  }

  if (selected.length > 0 && !selected.some((player) => isWicketkeeperCapable(player))) {
    const bestKeeperFromBench = byComposite.find((player) => !selected.some((picked) => picked.id === player.id) && isWicketkeeperCapable(player))
    const weakestXi = [...selected].sort(compareByComposite).reverse()[0]
    replaceInXi(weakestXi, bestKeeperFromBench)
  }

  for (let attempts = 0; attempts < 11; attempts += 1) {
    const keeper = chooseDesignatedKeeper(selected)
    const bowlingOptions = countBowlingOptionsExcludingKeeper(selected, keeper?.id ?? null)
    if (bowlingOptions >= MIN_BOWLING_OPTIONS || selected.length < STARTING_XI_SIZE) {
      break
    }

    const replacementBowler = byComposite.find(
      (player) => !selected.some((picked) => picked.id === player.id) && isBowlingCapable(player),
    )
    if (!replacementBowler) {
      break
    }

    const xiToReplace = [...selected]
      .filter((player) => player.id !== keeper?.id && !isBowlingCapable(player))
      .sort((left, right) => compareByComposite(left, right))
      .reverse()[0]

    const fallbackXiToReplace =
      xiToReplace ??
      [...selected]
        .filter((player) => player.id !== keeper?.id)
        .sort((left, right) => compareByComposite(left, right))
        .reverse()[0]

    replaceInXi(fallbackXiToReplace, replacementBowler)
  }

  const initialKeeper = chooseDesignatedKeeper(selected)
  const betterBenchKeeper = initialKeeper
    ? byComposite.find(
        (player) =>
          !selected.some((picked) => picked.id === player.id) &&
          isWicketkeeperCapable(player) &&
          keeperDesignationScore(player) > keeperDesignationScore(initialKeeper) + 5,
      )
    : null
  if (initialKeeper && betterBenchKeeper) {
    const swapOutCandidate = [...selected]
      .filter((player) => player.id !== initialKeeper.id && !isBowlingCapable(player))
      .sort((left, right) => compareByComposite(left, right))
      .reverse()[0]
    const fallbackSwapOut = swapOutCandidate
      ? swapOutCandidate
      : [...selected]
          .filter((player) => player.id !== initialKeeper.id)
          .sort((left, right) => compareByComposite(left, right))
          .reverse()[0]

    if (fallbackSwapOut) {
      const nextXi = selected.map((player) => (player.id === fallbackSwapOut.id ? betterBenchKeeper : player))
      const nextKeeper = chooseDesignatedKeeper(nextXi)
      const nextBowling = countBowlingOptionsExcludingKeeper(nextXi, nextKeeper?.id ?? null)
      if (nextKeeper && (nextBowling >= MIN_BOWLING_OPTIONS || nextXi.length < STARTING_XI_SIZE)) {
        replaceInXi(fallbackSwapOut, betterBenchKeeper)
      }
    }
  }

  const selectedIds = new Set(selected.map((player) => player.id))
  const starters = [...selected].sort(compareByComposite).map((player) => player.id)
  const bench = byComposite.filter((player) => !selectedIds.has(player.id)).map((player) => player.id)
  const designatedKeeper = chooseDesignatedKeeper(selected)

  return {
    draftOrder: [...starters, ...bench],
    wicketkeeperPlayerId: designatedKeeper?.id ?? (starters[0] ?? null),
  }
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
