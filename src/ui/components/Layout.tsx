import { NavLink, Outlet } from 'react-router-dom'
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
  const { saving, progressText, leagues, activeLeagueId, switchingLeague } = useApp()
  const activeLeague = leagues.find((league) => league.id === activeLeagueId)

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Cricket GM</h1>
        <p className="caption">Fictional Franchise Sim</p>
        <p className="caption">
          League: {switchingLeague ? 'Switching...' : activeLeague?.name ?? (activeLeagueId ? activeLeagueId : 'None')}
        </p>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        {(saving || progressText) && (
          <div className="banner">{progressText || 'Saving...'}</div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
