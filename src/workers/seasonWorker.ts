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
  let completedMatches = state.fixtures.filter((match) => match.played).length

  while (!cancelled) {
    const { nextState, playedMatches, simulatedDate } = simulateNextFixture(state)
    state = nextState

    if (playedMatches.length === 0) {
      break
    }

    completedMatches += playedMatches.length
    self.postMessage({
      type: 'progress',
      payload: {
        completedMatches,
        totalMatches: state.fixtures.length,
        simulatedDate,
        state,
      },
    })
  }

  self.postMessage({
    type: cancelled ? 'cancelled' : 'complete',
    payload: {
      state,
      completedMatches,
      totalMatches: state.fixtures.length,
    },
  })
}

export {}
