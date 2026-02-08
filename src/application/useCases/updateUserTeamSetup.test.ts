import { createLeague } from '@/application/useCases/createLeague'
import { runAuction } from '@/application/useCases/runAuction'
import { updateUserTeamSetup } from '@/application/useCases/updateUserTeamSetup'
import { MemoryRepository } from '@/test/memoryRepository'

describe('updateUserTeamSetup', () => {
  it('saves designated wicketkeeper when part of XI', async () => {
    const repo = new MemoryRepository()
    let state = await createLeague(repo, 111)
    state = await runAuction(repo)

    const team = state.teams.find((candidate) => candidate.id === state.userTeamId)
    expect(team).toBeDefined()
    if (!team) {
      return
    }

    const playingXi = [...team.playingXi]
    const wicketkeeperPlayerId = playingXi[0]
    const next = await updateUserTeamSetup(repo, {
      playingXi,
      wicketkeeperPlayerId,
      bowlingPreset: 'balanced',
    })
    const updatedTeam = next.teams.find((candidate) => candidate.id === next.userTeamId)

    expect(updatedTeam?.wicketkeeperPlayerId).toBe(wicketkeeperPlayerId)
  })

  it('rejects wicketkeeper outside selected XI', async () => {
    const repo = new MemoryRepository()
    let state = await createLeague(repo, 222)
    state = await runAuction(repo)

    const team = state.teams.find((candidate) => candidate.id === state.userTeamId)
    expect(team).toBeDefined()
    if (!team) {
      return
    }

    const benchPlayerId = team.rosterPlayerIds.find((playerId) => !team.playingXi.includes(playerId))
    expect(benchPlayerId).toBeDefined()
    if (!benchPlayerId) {
      return
    }

    await expect(
      updateUserTeamSetup(repo, {
        playingXi: [...team.playingXi],
        wicketkeeperPlayerId: benchPlayerId,
        bowlingPreset: 'balanced',
      }),
    ).rejects.toThrow('Wicketkeeper must be part of the playing XI')
  })
})
