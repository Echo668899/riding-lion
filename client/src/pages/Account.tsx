import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EMAIL_KEY, TOKEN_KEY, api } from "../api";
import { SITE, usePageSeo } from "../seo";

type Clip = Awaited<ReturnType<typeof api.account>>["clips"][number];

export function AccountPage() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [email, setEmail] = useState<string | null>(localStorage.getItem(EMAIL_KEY));
  const [credits, setCredits] = useState(0);
  const [retentionDays, setRetentionDays] = useState(7);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  usePageSeo({
    title: `My account — ${SITE.name}`,
    description: "Credits balance and private Riding Lion shorts (7-day retention).",
    path: "/account",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (!token) {
      navigate(`/login?next=${encodeURIComponent("/account")}`);
      return;
    }
    setLoading(true);
    api
      .account(token)
      .then((data) => {
        setEmail(data.email);
        localStorage.setItem(EMAIL_KEY, data.email);
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        setCredits(data.creditsBalance);
        setRetentionDays(data.retentionDays);
        setClips(data.clips);
        setError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load account";
        if (err?.code === "email_required" || err?.status === 403 || err?.status === 401) {
          navigate(`/login?next=${encodeURIComponent("/account")}`);
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    navigate("/login");
  }

  return (
    <div className="center-page" style={{ alignContent: "start", paddingTop: 36, maxWidth: 720 }}>
      <p className="eyebrow">Account</p>
      <h1 className="brand-mark" style={{ fontSize: "2.8rem" }}>
        My library
      </h1>
      <p className="muted">
        Signed in as <strong style={{ color: "var(--ink)" }}>{email || "…"}</strong>. Finished clips stay
        available for {retentionDays} days, then are removed.
      </p>

      <div className="panel" style={{ display: "grid", gap: 8 }}>
        <p className="muted" style={{ margin: 0 }}>
          Credits balance
        </p>
        <p style={{ margin: 0, fontSize: "2rem", fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
          {loading ? "…" : credits}
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <Link className="btn btn-primary" to="/#pricing" style={{ textDecoration: "none", textAlign: "center" }}>
            Buy credits
          </Link>
          <button type="button" className="btn btn-secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 28, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
        Your shorts
      </h2>
      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      {!loading && !clips.length ? (
        <p className="muted">No generations yet. <Link to="/">Create a short</Link>.</p>
      ) : null}

      <div style={{ display: "grid", gap: 16, width: "100%" }}>
        {clips.map((clip) => (
          <article key={clip.jobId} className="panel" style={{ display: "grid", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <strong>{new Date(clip.createdAt * 1000).toLocaleString()}</strong>
              <span className="muted">
                {clip.status}
                {clip.available && clip.daysLeft != null ? ` · ${clip.daysLeft}d left` : null}
                {clip.expired ? " · expired" : null}
                {clip.deleted ? " · deleted" : null}
              </span>
            </div>
            {clip.available && clip.playUrl ? (
              <video src={clip.playUrl} controls playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {clip.errorMessage ||
                  (clip.expired
                    ? "This clip passed the 7-day retention window."
                    : clip.status === "succeeded"
                      ? "Clip unavailable."
                      : "Not ready yet.")}
              </p>
            )}
            <div className="row">
              <Link className="btn btn-secondary" to={clip.resultPath} style={{ textDecoration: "none", textAlign: "center" }}>
                Open result
              </Link>
              {clip.downloadUrl ? (
                <a className="btn btn-primary" href={clip.downloadUrl} style={{ textAlign: "center" }}>
                  Download
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <Link to="/" className="muted" style={{ marginTop: 18 }}>
        ← Back home
      </Link>
    </div>
  );
}
