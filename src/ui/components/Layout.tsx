import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '@/ui/useApp'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/auction', label: 'Auction' },
  { to: '/roster', label: 'Roster' },
  { to: '/fixtures', label: 'Fixtures' },
  { to: '/standings', label: 'Standings' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Settings' },
]

export const Layout = () => {
  const { saving, progressText, state, actions } = useApp()
  const navigate = useNavigate()
  const userTeam = state?.teams.find((team) => team.id === state.userTeamId) ?? null
  const latestResult = state
    ? [...state.fixtures]
        .filter((match) => match.played && (match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId))
        .sort((a, b) => {
          const dateA = a.scheduledAt ?? ''
          const dateB = b.scheduledAt ?? ''
          return dateA === dateB ? b.round - a.round : dateB.localeCompare(dateA)
        })[0] ?? null
    : null

  const resultText = (() => {
    if (!state || !userTeam) {
      return 'Create a league to begin your franchise journey.'
    }
    if (state.phase === 'preseason') {
      return `${userTeam.name}: preseason camp in progress. Finalize your XI, then start the season.`
    }
    if (!latestResult) {
      return `${userTeam.name}: no results recorded yet.`
    }
    if (!latestResult.winnerTeamId) {
      return `${userTeam.shortName} tied last outing${latestResult.margin ? ` | ${latestResult.margin}` : ''}`
    }
    const won = latestResult.winnerTeamId === state.userTeamId
    const opponentId = latestResult.homeTeamId === state.userTeamId ? latestResult.awayTeamId : latestResult.homeTeamId
    const opponent = state.teams.find((team) => team.id === opponentId)?.shortName ?? 'TBD'
    return `${userTeam.shortName} ${won ? 'defeated' : 'fell to'} ${opponent}${latestResult.margin ? ` | ${latestResult.margin}` : ''}`
  })()

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Cricket GM</h1>
        <p className="caption">Fictional Franchise Sim</p>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="phaseToolbar card">
          <div>
            <strong>League Phase: {state?.phase ?? 'not-started'}</strong>
            <p className="phaseSub">{resultText}</p>
          </div>
          <div className="actions">
            {state?.phase === 'preseason' ? (
              <>
                <button onClick={() => actions.startSeason()}>Start Season</button>
                <button
                  onClick={() => {
                    navigate('/roster')
                  }}
                >
                  Manage Roster
                </button>
              </>
            ) : null}
          </div>
        </div>
        {(saving || progressText) && (
          <div className="banner">{progressText || 'Saving...'}</div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
