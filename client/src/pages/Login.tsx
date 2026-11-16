import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EMAIL_KEY, SUPPORT_EMAIL, TOKEN_KEY, api } from "../api";
import { SITE, usePageSeo } from "../seo";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  usePageSeo({
    title: `Sign in — ${SITE.name}`,
    description: "Sign in with email to sync Riding Lion credits and your private clips.",
    path: "/login",
    robots: "noindex,nofollow",
  });

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.requestLoginCode(email.trim());
      localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
      setSent(true);
      setDevCode(res.devCode || null);
      setNotice(
        res.devCode
          ? "Code sent (dev mode — Resend not configured)."
          : `Check ${email.trim()} for a 6-digit code from ${SUPPORT_EMAIL}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const guest = localStorage.getItem(TOKEN_KEY) || undefined;
      const res = await api.verifyLogin(email.trim(), code.trim(), guest);
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      if (res.email) localStorage.setItem(EMAIL_KEY, res.email);
      navigate(next.startsWith("/") ? next : "/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <p className="eyebrow">Account</p>
      <h1 className="brand-mark" style={{ fontSize: "2.8rem" }}>
        Sign in
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Email login binds your credits and finished shorts (kept {7} days) to one account. No password.
      </p>

      {!sent ? (
        <form className="panel" onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="text-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button className="btn btn-primary" disabled={busy || !email.trim()} type="submit">
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form className="panel" onSubmit={verify} style={{ display: "grid", gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            Code sent to <strong style={{ color: "var(--ink)" }}>{email}</strong>
          </p>
          <label className="field-label" htmlFor="login-code">
            6-digit code
          </label>
          <input
            id="login-code"
            className="text-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={devCode || "123456"}
          />
          {devCode ? (
            <p className="muted tight">Dev code: <strong>{devCode}</strong></p>
          ) : null}
          <button className="btn btn-primary" disabled={busy || code.trim().length !== 6} type="submit">
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
              setDevCode(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      <Link to="/" className="muted" style={{ marginTop: 12 }}>
        ← Back home
      </Link>
    </div>
  );
}
