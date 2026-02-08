import { createPrng } from '@/domain/prng'
import type { GameState } from '@/domain/types'

export const runAutoAuction = (state: GameState): GameState => {
  const nextState: GameState = structuredClone(state)
  const prng = createPrng(state.metadata.seed + 303)

  const teams = nextState.teams
  const teamById = new Map(teams.map((team) => [team.id, team]))

  for (const entry of nextState.auction.entries) {
    const player = nextState.players.find((candidate) => candidate.id === entry.playerId)
    if (!player || player.teamId) {
      continue
    }

    const candidateTeams = teams
      .filter((team) => team.rosterPlayerIds.length < nextState.config.maxSquadSize)
      .filter((team) => team.budgetRemaining >= player.basePrice)
      .sort((a, b) => b.budgetRemaining - a.budgetRemaining)

    if (candidateTeams.length === 0) {
      continue
    }

    const winnerPool = candidateTeams.slice(0, Math.min(4, candidateTeams.length))
    const winner = prng.pick(winnerPool)
    const randomBump = prng.nextInt(0, Math.round(player.basePrice * 0.7))
    const price = Math.min(winner.budgetRemaining, player.basePrice + randomBump)

    winner.budgetRemaining -= price
    winner.rosterPlayerIds.push(player.id)
    player.teamId = winner.id

    entry.soldToTeamId = winner.id
    entry.finalPrice = price

    const teamRecord = teamById.get(winner.id)
    if (teamRecord && teamRecord.playingXi.length < 11) {
      teamRecord.playingXi.push(player.id)
      if (!teamRecord.wicketkeeperPlayerId && player.role === 'wicketkeeper') {
        teamRecord.wicketkeeperPlayerId = player.id
      }
    }
  }

  for (const team of teams) {
    if (team.wicketkeeperPlayerId) {
      continue
    }
    const xi = nextState.players.filter((player) => team.playingXi.includes(player.id))
    const fallback = xi.find((player) => player.role === 'wicketkeeper') ?? xi[0]
    team.wicketkeeperPlayerId = fallback?.id ?? null
  }

  nextState.auction.complete = true
  nextState.phase = 'regular-season'

  return nextState
}
