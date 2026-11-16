import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export function SiteChrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const showChrome = isHome || pathname === "/privacy";

  return (
    <div className={isHome ? "app-shell home-wide home-flush" : "app-shell"}>
      {showChrome ? (
        <nav className="site-nav site-nav-bar" aria-label="Primary">
          <Link to="/" className="site-nav-brand">
            Riding Lion
          </Link>
          <div className="site-nav-links">
            <a href="/#examples">Examples</a>
            <a href="/#how-it-works">How it works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
            <Link to="/privacy">Privacy</Link>
          </div>
          <a className="nav-cta" href="/#create">
            Create a video
          </a>
        </nav>
      ) : null}
      {children}
      {showChrome ? (
        <footer className="site-footer">
          <strong>Riding Lion</strong>
          <p>
            Photo to AI short video with template-guided face replacement. Authorized likeness only. Not
            affiliated with third-party trends or platforms named in examples.
          </p>
          <p>
            Support:{" "}
            <a href="mailto:support@ridinglion.com">support@ridinglion.com</a>
          </p>
          <div className="site-nav-links">
            <Link to="/">Home</Link>
            <a href="/#examples">Examples</a>
            <a href="/#how-it-works">How it works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
            <Link to="/privacy">Privacy</Link>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
