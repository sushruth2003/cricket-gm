export const getStateQueryKey = (leagueId: string | null) => ['game-state', leagueId ?? '__none__'] as const

export const LEAGUE_LIST_QUERY_KEY = ['league-list'] as const
