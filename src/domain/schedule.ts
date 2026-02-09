import type { MatchResult, Team } from '@/domain/types'

const DAY_MS = 24 * 60 * 60 * 1000

const toUtcDateStart = (isoLike: string): number => {
  const parsed = new Date(isoLike)
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  return Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate())
}

const addDaysToDateKey = (dateKey: string, days: number): string => {
  const start = toUtcDateStart(dateKey)
  return new Date(start + days * DAY_MS).toISOString().slice(0, 10)
}

export const getRoundDateKey = (seasonStartIso: string, round: number): string => {
  const startDateKey = new Date(toUtcDateStart(seasonStartIso)).toISOString().slice(0, 10)
  return addDaysToDateKey(startDateKey, (round - 1) * 3)
}

export const getFixtureDateKey = (fixture: MatchResult, seasonStartIso: string): string => {
  return fixture.scheduledAt ?? getRoundDateKey(seasonStartIso, fixture.round)
}

export const generateRoundRobinFixtures = (teams: Team[], seasonStartIso = new Date().toISOString()): MatchResult[] => {
  if (teams.length < 2) {
    return []
  }

  const participants: Array<Team | null> = [...teams]
  const teamById = new Map(teams.map((team) => [team.id, team]))
  if (participants.length % 2 !== 0) {
    participants.push(null)
  }

  const fixtures: MatchResult[] = []
  const rounds = participants.length - 1
  const matchesPerRound = participants.length / 2
  let matchNumber = 1

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < matchesPerRound; pairIndex += 1) {
      const left = participants[pairIndex]
      const right = participants[participants.length - 1 - pairIndex]
      if (!left || !right) {
        continue
      }

      // Alternate home/away to avoid one side always hosting in early rounds.
      const shouldSwap = (roundIndex + pairIndex) % 2 === 1
      const homeTeam = shouldSwap ? right : left
      const awayTeam = shouldSwap ? left : right

      fixtures.push({
        id: `match-${matchNumber}`,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        venue: `${homeTeam.city} Oval`,
        round: roundIndex + 1,
        scheduledAt: getRoundDateKey(seasonStartIso, roundIndex + 1),
        played: false,
        winnerTeamId: null,
        margin: '',
        innings: null,
      })
      matchNumber += 1
    }

    const fixed = participants[0]
    const rotating = participants.slice(1)
    const last = rotating.pop()
    if (last !== undefined) {
      rotating.unshift(last)
    }
    participants.splice(0, participants.length, fixed, ...rotating)
  }

  const firstLegFixtures = [...fixtures]
  for (const firstLeg of firstLegFixtures) {
    const secondLegRound = firstLeg.round + rounds
    const secondLegHomeTeam = teamById.get(firstLeg.awayTeamId)
    fixtures.push({
      id: `match-${matchNumber}`,
      homeTeamId: firstLeg.awayTeamId,
      awayTeamId: firstLeg.homeTeamId,
      venue: `${secondLegHomeTeam?.city ?? 'Unknown'} Oval`,
      round: secondLegRound,
      scheduledAt: getRoundDateKey(seasonStartIso, secondLegRound),
      played: false,
      winnerTeamId: null,
      margin: '',
      innings: null,
    })
    matchNumber += 1
  }

  return fixtures
}
