import { avatarHue, avatarInitial } from '../data/people.js'

// Two floating objects on phones: a pill for going places, a circle for doing
// the thing. On desktop the same markup lays out flat as the sidebar rail —
// .tabbar-pill becomes display:contents there, so the items flow straight in.
export default function TabBar({ tab, onTab, onPost, onSearch, clock, profile }) {
  const Item = ({ id, label, children }) => (
    <button
      className={`tab-item ${tab === id ? 'tab-on' : ''}`}
      aria-pressed={tab === id}
      onClick={() => onTab(id)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">{children}</svg>
      <span className="tab-label">{label}</span>
    </button>
  )

  return (
    <nav className="tabbar" aria-label="Pages">
      <div className="side-brand">
        <span className="wordmark">out<span className="wordmark-dot">.</span></span>
        <p className="micro">washington, d.c.</p>
      </div>

      <div className="tabbar-pill">
        <Item id="map" label="Map">
          <path d="M7 3.5 3 5v11l4-1.5 6 2 4-1.5V4l-4 1.5-6-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M7 3.5v11M13 5.5v11" stroke="currentColor" strokeWidth="1.2" />
        </Item>
        <Item id="tonight" label="Tonight">
          <path d="M15.5 12.5A6.3 6.3 0 0 1 7.4 4.4a6.3 6.3 0 1 0 8.1 8.1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 4.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="currentColor" />
        </Item>
        <Item id="feed" label="Feed">
          <rect x="3" y="3" width="6" height="8" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="11.4" y="3" width="5.6" height="5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="11.4" y="10.4" width="5.6" height="6.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="13.4" width="6" height="3.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </Item>

        {/* desktop rail only — phones reach search from the top bar */}
        <button className="tab-item side-only" onClick={onSearch}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="tab-label">Search</span>
        </button>

        <button
          className={`tab-item ${tab === 'you' ? 'tab-on' : ''}`}
          aria-pressed={tab === 'you'}
          onClick={() => onTab('you')}
          aria-label={profile ? `Your profile — @${profile.username}` : 'Sign in'}
        >
          {profile ? (
            <span
              className="tab-ava"
              style={{ '--ava-bg': `oklch(0.82 0.06 ${avatarHue(profile.username)})`, '--ava-ink': `oklch(0.42 0.09 ${avatarHue(profile.username)})` }}
            >
              {avatarInitial(profile.username)}
            </span>
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="7" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.8 17c1-3 3.4-4.5 6.2-4.5s5.2 1.5 6.2 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
          <span className="tab-label">You</span>
        </button>
      </div>

      <button className="tab-post" aria-label="Post" onClick={onPost}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span className="tab-post-label">Post</span>
      </button>

      <p className="side-clock micro">{clock}</p>
    </nav>
  )
}
