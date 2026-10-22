import type { MouseEvent } from 'react';

export function inert(e: MouseEvent): void {
  e.preventDefault();
}

const LINKS = ['Product', 'Reports', 'Customers', 'Pricing', 'Docs', 'Help Center'];

export function SiteNav({ active }: { active?: string }) {
  return (
    <nav className="landing-nav" aria-label="Site">
      <span className="brand-sm">ABC Analytics</span>
      <div className="landing-links">
        {LINKS.map((label) => (
          <a key={label} href="#" onClick={inert} className={label === active ? 'active' : undefined} aria-current={label === active ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </div>
      <button className="btn btn-outline btn-sm">Sign in</button>
    </nav>
  );
}

export function SiteFooter() {
  return <footer className="landing-footer muted small">© 2026 ABC Company · Privacy · Terms</footer>;
}
