import { useBoolVariation } from '@launchdarkly/react-sdk';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { FLAG_KEYS } from '../../ld/flags';
import { trackHeroCtaClick } from '../../ld/metrics';
import { applyPersonaContext, usePersona } from './personaStore';
import type { Persona } from './personas';

/**
 * Part 2 end-user view: ABC Company's marketing landing page. Only the hero is
 * behind the flag; everything else is shared by both variations.
 */
export function Part2View() {
  // Re-apply the chosen persona whenever this scenario is shown.
  useEffect(() => {
    void applyPersonaContext();
  }, []);

  return (
    <div className="landing">
      {/* Decorative navigation: the hash is reserved for the part picker, so these go nowhere. */}
      <nav className="landing-nav" aria-label="Site">
        <span className="brand-sm">ABC Analytics</span>
        <div className="landing-links">
          <a href="#" onClick={inert}>Product</a>
          <a href="#" onClick={inert}>Customers</a>
          <a href="#" onClick={inert}>Pricing</a>
          <a href="#" onClick={inert}>Docs</a>
        </div>
        <button className="btn btn-outline btn-sm">Sign in</button>
      </nav>

      <HeroGate />

      <section className="logos" aria-label="Trusted by">
        <span className="muted small">Trusted by product teams at</span>
        <div className="logo-row">
          {['Northwind', 'Maple Health', 'Keller', 'Orbital', 'Lumen Labs', 'Harbor'].map((n) => (
            <span key={n} className="logo-chip">
              {n}
            </span>
          ))}
        </div>
      </section>

      <section className="features" id="features">
        <article>
          <h3>Usage insights</h3>
          <p className="muted">See which teams and features drive your API traffic, daily.</p>
        </article>
        <article>
          <h3>Alerts that matter</h3>
          <p className="muted">Get paged on anomalies, not noise. Thresholds learn from your baseline.</p>
        </article>
        <article>
          <h3>Ship safely</h3>
          <p className="muted">Roll out reports to a few customers first. Roll back in one click.</p>
        </article>
      </section>

      <footer className="landing-footer muted small">© 2026 ABC Company · Privacy · Terms</footer>
    </div>
  );
}

/**
 * The feature flag in action: `landing-hero-v-2` decides which hero this visitor
 * sees. Unlike Part 1, the flag is not simply on or off - LaunchDarkly
 * evaluates it against the visitor's context (user + organization attributes),
 * so Alice can get the new hero while an anonymous visitor still gets the
 * classic one.
 */
function HeroGate() {
  const persona = usePersona();
  const v2 = useBoolVariation(FLAG_KEYS.LANDING_HERO_V2, false);
  return v2 ? <HeroPersonalized persona={persona} /> : <HeroClassic />;
}

/**
 * The primary call to action is the experiment's conversion. Clicking it sends
 * the `hero-cta-click` metric event (plus time-to-click) for the current
 * context; LaunchDarkly attributes it to the variation this visitor saw.
 * The button acknowledges the click briefly so the page still feels real.
 */
function useHeroCta(hero: 'v2' | 'classic', label: string) {
  const shownAt = useRef(performance.now());
  const [done, setDone] = useState(false);
  useEffect(() => {
    shownAt.current = performance.now();
    setDone(false);
  }, [hero, label]);
  const onClick = () => {
    if (done) return;
    trackHeroCtaClick(hero, label, Math.round(performance.now() - shownAt.current));
    setDone(true);
    window.setTimeout(() => setDone(false), 2500);
  };
  return { done, onClick };
}

function HeroClassic() {
  const cta = useHeroCta('classic', 'Start free trial');
  return (
    <section className="hero">
      <div className="hero-text">
        <p className="eyebrow">Analytics for growing teams</p>
        <h1>Know what your customers actually use.</h1>
        <p className="lede muted">
          ABC Analytics turns raw API traffic into usage reports your whole company can read. Set up in minutes, no
          data team required.
        </p>
        <div className="hero-cta">
          <button className={`btn btn-primary ${cta.done ? 'done' : ''}`} onClick={cta.onClick} aria-live="polite">
            {cta.done ? '✓ Trial requested' : 'Start free trial'}
          </button>
          <button className="btn btn-outline">Watch a 2-min demo</button>
        </div>
      </div>
      <HeroArt label="Usage report" />
    </section>
  );
}

function HeroPersonalized({ persona }: { persona: Persona }) {
  const org = persona.organization;
  const plan = org?.plan ?? 'free';
  const first = persona.user.name?.split(' ')[0];

  const copy = {
    enterprise: {
      eyebrow: `Welcome back${first ? `, ${first}` : ''}`,
      title: `${org?.name ?? 'Your team'} is on Enterprise. Let's go further.`,
      lede: 'Dedicated success manager, SSO and SCIM, SOC 2 Type II reports, and 99.95% uptime SLA included in your plan.',
      cta: 'Talk to your account team',
      secondary: 'Open Insights',
    },
    pro: {
      eyebrow: `Welcome back${first ? `, ${first}` : ''}`,
      title: `${org?.name ?? 'Your team'} is growing fast. Your reports should too.`,
      lede: `You're on Pro with ${org?.employees.toLocaleString() ?? 'many'} people. Enterprise adds SSO, audit logs and unlimited history.`,
      cta: 'Upgrade to Enterprise',
      secondary: 'Open Insights',
    },
    free: {
      eyebrow: `Hi${first ? ` ${first}` : ''}, welcome back`,
      title: 'Your first 30 days of usage are in. See what happened.',
      lede: 'Unlock daily trends, team breakdowns and alerts with a 14-day Pro trial. No credit card required.',
      cta: 'Start 14-day Pro trial',
      secondary: 'Open Insights',
    },
  }[plan];

  const cta = useHeroCta('v2', copy.cta);

  const locale =
    persona.user.country === 'DE'
      ? 'Data residency in the EU (Frankfurt) available.'
      : persona.user.country === 'CA'
        ? 'Canadian data residency available.'
        : null;

  return (
    <section className="hero v2">
      <div className="hero-text">
        <p className="eyebrow">
          {copy.eyebrow}
          {persona.user.betaTester && <span className="beta">Beta program</span>}
        </p>
        <h1>{copy.title}</h1>
        <p className="lede muted">
          {copy.lede}
          {locale ? ` ${locale}` : ''}
        </p>
        <div className="hero-cta">
          <button className={`btn btn-primary ${cta.done ? 'done' : ''}`} onClick={cta.onClick} aria-live="polite">
            {cta.done ? '✓ Request sent' : copy.cta}
          </button>
          <button className="btn btn-outline">{copy.secondary}</button>
        </div>
      </div>
      <HeroArt label={org ? `${org.name} · ${plan}` : 'Your workspace'} highlight />
    </section>
  );
}

function HeroArt({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <div className={`hero-art ${highlight ? 'highlight' : ''}`} aria-hidden="true">
      <div className="hero-art-head">{label}</div>
      <div className="hero-art-bars">
        {[38, 52, 46, 70, 64, 88, 80].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Keep the demo's decorative links from touching the URL hash (which selects the exercise part). */
export function inert(e: MouseEvent): void {
  e.preventDefault();
}
