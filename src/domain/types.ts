export type Phase = 'auction' | 'regular-season' | 'playoffs' | 'complete'
export type AuctionPhase = 'marquee' | 'capped' | 'uncapped' | 'accelerated-1' | 'accelerated-2' | 'complete'
export type AuctionEntryStatus = 'pending' | 'sold' | 'unsold'
export type AuctionType = 'mega' | 'mini'
export type AuctionPolicySet = 'legacy-default' | 'ipl-2025-cycle'

export type BowlingStyle = 'pace' | 'spin'
export type PlayerRole = 'batter' | 'bowler' | 'wicketkeeper' | 'allrounder'

export type BattingTrait = 'timing' | 'power' | 'placement' | 'runningBetweenWickets' | 'composure'
export type BowlingTrait = 'accuracy' | 'movement' | 'variations' | 'control' | 'deathExecution'
export type FieldingTrait = 'catching' | 'groundFielding' | 'throwing' | 'wicketkeeping'

export interface SkillRating<TTrait extends string = string> {
  overall: number
  traits: Record<TTrait, number>
}

export interface SaveMetadata {
  schemaVersion: number
  engineVersion: string
  seed: number
  createdAt: string
  updatedAt: string
}

export interface LeagueConfig {
  teamCount: number
  format: 'T20'
  auctionBudget: number
  minSquadSize: number
  maxSquadSize: number
  seasonSeed: number
}

export interface SimulationConfig {
  deterministicCore: boolean
  liveViewNarrationMode: 'non_authoritative'
}

export interface Team {
  id: string
  city: string
  name: string
  shortName: string
  color: string
  budgetRemaining: number
  rosterPlayerIds: string[]
  playingXi: string[]
  wicketkeeperPlayerId: string | null
  bowlingPreset: 'balanced' | 'aggressive' | 'defensive'
  points: number
  wins: number
  losses: number
  ties: number
  netRunRate: number
}

export interface PlayerRatings {
  batting: SkillRating<BattingTrait>
  bowling: SkillRating<BowlingTrait> & { style: BowlingStyle }
  fielding: SkillRating<FieldingTrait>
  temperament: number
  fitness: number
}

export interface PlayerLastSeasonStats {
  matches: number
  runs: number
  wickets: number
  strikeRate: number
  economy: number
}

export interface PlayerDevelopment {
  isProspect: boolean
  potential: {
    battingOverall: number
    bowlingOverall: number
    fieldingOverall: number
    temperament: number
    fitness: number
  }
  firstClassProjection: {
    runs: number
    wickets: number
    strikeRate: number
    economy: number
  }
}

export interface Player {
  id: string
  firstName: string
  lastName: string
  countryTag: string
  capped: boolean
  role: PlayerRole
  age?: number
  basePrice: number
  lastSeasonStats: PlayerLastSeasonStats
  ratings: PlayerRatings
  development?: PlayerDevelopment
  teamId: string | null
}

export interface AuctionEntry {
  playerId: string
  phase: AuctionPhase
  status: AuctionEntryStatus
  soldToTeamId: string | null
  finalPrice: number
}

export interface AuctionBidIncrementBand {
  minBid: number
  increment: number
}

export interface AuctionPolicy {
  key: string
  auctionType: AuctionType
  purse: number
  squadMin: number
  squadMax: number
  overseasCap: number
  minimumSpend: number
  minimumPlayerBase: number
  retentionLimit: number
  retentionEnabled: boolean
  rtmEnabled: boolean
  rtmReboundEnabled: boolean
  forceFillToMinimumSquad: boolean
  bidIncrementBands: AuctionBidIncrementBand[]
  phaseIncrementFloor: Record<Exclude<AuctionPhase, 'complete'>, number>
}

export interface AuctionPolicyContext {
  policySet?: AuctionPolicySet
  seasonYear?: number
  seasonIndex?: number
  cycleMarker?: number
}

export interface ResolvedAuctionPolicy {
  seasonYear: number
  auctionType: AuctionType
  policy: AuctionPolicy
}

export interface AuctionRetentionState {
  enabled: boolean
  maxRetentions: number
  phase: 'not-applicable' | 'pending' | 'complete'
}

export interface AuctionRtmDecision {
  enabled: boolean
  allowRebound: boolean
  phase: 'disabled' | 'available' | 'completed'
  incumbentTeamId: string | null
  winningTeamId: string
  finalBid: number
}

export interface AuctionState {
  currentNominationIndex: number
  phase: AuctionPhase
  currentPlayerId: string | null
  currentBidTeamId: string | null
  currentBid: number
  currentBidIncrement: number
  passedTeamIds: string[]
  awaitingUserAction: boolean
  message: string
  allowRtm: boolean
  entries: AuctionEntry[]
  complete: boolean
}

export interface PlayerBattingLine {
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
}

export interface PlayerBowlingLine {
  playerId: string
  overs: number
  runsConceded: number
  wickets: number
}

export interface InningsSummary {
  battingTeamId: string
  bowlingTeamId: string
  wicketkeeperPlayerId: string | null
  runs: number
  wickets: number
  overs: number
  batting: PlayerBattingLine[]
  bowling: PlayerBowlingLine[]
}

export interface MatchResult {
  id: string
  homeTeamId: string
  awayTeamId: string
  venue: string
  round: number
  scheduledAt?: string
  played: boolean
  winnerTeamId: string | null
  margin: string
  innings: [InningsSummary, InningsSummary] | null
}

export interface StatLine {
  playerId: string
  matches: number
  runs: number
  balls: number
  wickets: number
  overs: number
  runsConceded: number
}

export interface GameState {
  metadata: SaveMetadata
  config: LeagueConfig
  simulation: SimulationConfig
  phase: Phase
  userTeamId: string
  teams: Team[]
  players: Player[]
  auction: AuctionState
  fixtures: MatchResult[]
  stats: Record<string, StatLine>
}

export interface SimulateSeasonProgress {
  completedMatches: number
  totalMatches: number
}
