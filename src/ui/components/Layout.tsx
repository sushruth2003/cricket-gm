import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '@/ui/useApp'

type NavItem = {
  to: string
  label: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'League',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/fixtures', label: 'Fixtures' },
      { to: '/standings', label: 'Standings' },
      { to: '/stats', label: 'Stats' },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/roster', label: 'Roster' },
      { to: '/auction', label: 'Auction' },
    ],
  },
  {
    title: 'Tools',
    items: [{ to: '/settings', label: 'Settings' }],
  },
]

export const Layout = () => {
  const { saving, progressText, state, actions } = useApp()
  const navigate = useNavigate()
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const onMediaChange = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      if (!mobile) {
        setIsMobileSidebarOpen(false)
      }
    }

    onMediaChange()
    media.addEventListener('change', onMediaChange)

    return () => {
      media.removeEventListener('change', onMediaChange)
    }
  }, [])

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

  const layoutClassName = [
    'layout',
    !isMobile && isDesktopCollapsed ? 'sidebarCollapsed' : '',
    isMobile && isMobileSidebarOpen ? 'mobileSidebarOpen' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const onNavClick = () => {
    if (isMobile) {
      setIsMobileSidebarOpen(false)
    }
  }

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileSidebarOpen((current) => !current)
      return
    }
    setIsDesktopCollapsed((current) => !current)
  }

  return (
    <div className={layoutClassName}>
      <header className="topbar">
        <div className="topbarLeft">
          <button type="button" className="iconButton" onClick={toggleSidebar} aria-label="Toggle navigation">
            ☰
          </button>
          <div className="brand">
            <span className="brandBall" aria-hidden="true" />
            <span>Cricket GM</span>
          </div>
        </div>
        <div className="topbarCenter">
          <button className="playControl" type="button" onClick={() => navigate('/fixtures')}>
            Play ▾
          </button>
          <div className="phaseInfo">
            <strong>{state ? `${state.phase} · ${userTeam?.shortName ?? 'No team'}` : 'No active league'}</strong>
            <p className="phaseSub">{resultText}</p>
          </div>
        </div>
        <div className="topbarRight">
          <NavLink to="/standings">League</NavLink>
          <NavLink to="/roster">Team</NavLink>
          <NavLink to="/stats">Players</NavLink>
          <NavLink to="/settings">Tools</NavLink>
        </div>
      </header>

      <div className="shell">
        <div className="sidebarBackdrop" onClick={() => setIsMobileSidebarOpen(false)} aria-hidden="true" />
        <aside className="sidebar">
          <p className="sidebarCaption">Fictional Franchise Sim</p>
          {navGroups.map((group) => (
            <section className="sidebarSection" key={group.title}>
              <h2 className="sidebarSectionTitle">{group.title}</h2>
              <nav className="sidebarLinkList" aria-label={group.title}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `sidebarLink${isActive ? ' active' : ''}`}
                    end={item.to === '/'}
                    onClick={onNavClick}
                  >
                    <span className="sidebarDot" aria-hidden="true" />
                    <span className="sidebarLinkLabel">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </section>
          ))}
        </aside>

        <main className="main">
          {state?.phase === 'preseason' ? (
            <div className="panel preseasonActions">
              <div className="panelBody controlRow">
                <button className="btnSuccess" onClick={() => actions.startSeason()}>
                  Start Season
                </button>
                <button className="btnSecondary" onClick={() => navigate('/roster')}>
                  Manage Roster
                </button>
              </div>
            </div>
          ) : null}
          {(saving || progressText) && <div className="banner">{progressText || 'Saving...'}</div>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
