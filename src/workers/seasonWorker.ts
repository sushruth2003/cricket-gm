import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import type { GameState } from '@/domain/types'

type StartMessage = {
  type: 'start'
  payload: { state: GameState }
}

type CancelMessage = {
  type: 'cancel'
}

type WorkerMessage = StartMessage | CancelMessage

let cancelled = false

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === 'cancel') {
    cancelled = true
    return
  }

  if (event.data.type !== 'start') {
    return
  }

  cancelled = false
  let state = event.data.payload.state
  const totalMatches = state.fixtures.length
  let completedMatches = state.fixtures.filter((match) => match.played).length

  while (!cancelled) {
    const { nextState, playedMatch } = simulateNextFixture(state)
    state = nextState

    if (!playedMatch) {
      break
    }

    completedMatches += 1
    self.postMessage({
      type: 'progress',
      payload: {
        completedMatches,
        totalMatches,
        latestMatchId: playedMatch.id,
        state,
      },
    })
  }

  self.postMessage({
    type: cancelled ? 'cancelled' : 'complete',
    payload: {
      state,
      completedMatches,
      totalMatches,
    },
  })
}

export {}
