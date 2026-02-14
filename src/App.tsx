import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/ui/components/Layout'
import { AuctionPage } from '@/ui/pages/AuctionPage'
import { DashboardPage } from '@/ui/pages/DashboardPage'
import { FixturesPage } from '@/ui/pages/FixturesPage'
import { MatchScorecardPage } from '@/ui/pages/MatchScorecardPage'
import { RosterPage } from '@/ui/pages/RosterPage'
import { SchedulePage } from '@/ui/pages/SchedulePage'
import { SettingsPage } from '@/ui/pages/SettingsPage'
import { StandingsPage } from '@/ui/pages/StandingsPage'
import { StatsPage } from '@/ui/pages/StatsPage'

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/fixtures" element={<FixturesPage />} />
        <Route path="/fixtures/:matchId" element={<MatchScorecardPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
