import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ASSET_KEY, EMAIL_KEY, SUPPORT_EMAIL, api, formatUsd, TOKEN_KEY } from "../api";
import { SITE, usePageSeo } from "../seo";

export function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = params.get("paymentId") || "";
  const canceled = params.get("canceled") === "1";
  const [notice, setNotice] = useState("Simulated payment — you will not be charged.");
  const [status, setStatus] = useState("pending");
  const [packLabel, setPackLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [credits, setCredits] = useState(0);
  const [accessToken, setAccessToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  usePageSeo({
    title: `Checkout — ${SITE.name}`,
    description: "Simulated credit checkout for Riding Lion AI short videos.",
    path: "/checkout",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (!paymentId) return;
    api
      .getPayment(paymentId)
      .then((p) => {
        setStatus(p.status);
        setAmount(p.amountCents);
        setCredits(p.creditsGranted);
        setPackLabel(p.pack?.label || "");
        if (p.notice) setNotice(p.notice);
        if (p.accessToken) {
          setAccessToken(p.accessToken);
          localStorage.setItem(TOKEN_KEY, p.accessToken);
        }
      })
      .catch((err) => setError(err.message));
  }, [paymentId]);

  async function confirm() {
    if (!paymentId || !emailOk) {
      setError("Enter a valid email so we can notify you when the clip is ready.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trimmed = email.trim().toLowerCase();
      localStorage.setItem(EMAIL_KEY, trimmed);
      const paid = await api.confirmMock(paymentId);
      setStatus(paid.status);
      if (paid.accessToken) {
        setAccessToken(paid.accessToken);
        localStorage.setItem(TOKEN_KEY, paid.accessToken);
      }
      const assetId = localStorage.getItem(ASSET_KEY);
      const token = paid.accessToken || accessToken;
      if (token) {
        await api.saveEmail(token, trimmed);
      }
      if (token && assetId) {
        const job = await api.createGeneration(token, assetId, trimmed);
        navigate(job.resultPath);
        return;
      }
      navigate(token ? `/r/${token}` : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!paymentId) return;
    setBusy(true);
    try {
      await api.cancelMock(paymentId);
      setStatus("canceled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <p className="eyebrow">Checkout</p>
      <h1 className="brand-mark" style={{ fontSize: "3rem" }}>
        Riding Lion
      </h1>
      <div className="notice" role="status">
        {notice}
      </div>
      {canceled || status === "canceled" ? (
        <div className="notice danger">Payment canceled. No credits were added.</div>
      ) : null}
      <div className="panel">
        <p className="muted" style={{ margin: 0 }}>
          Pack
        </p>
        <h2 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
          {packLabel || "Credit pack"}
        </h2>
        <p style={{ margin: "10px 0 0" }}>
          {formatUsd(amount)} · {credits} credit{credits === 1 ? "" : "s"}
        </p>
        <p className="muted" style={{ marginTop: 10, fontSize: "0.85rem" }}>
          Status: {status}
        </p>
        <label className="field-label" htmlFor="checkout-email" style={{ marginTop: 16, display: "block" }}>
          Email for result link
        </label>
        <input
          id="checkout-email"
          className="text-input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            localStorage.setItem(EMAIL_KEY, e.target.value.trim().toLowerCase());
          }}
        />
        <p className="muted" style={{ marginTop: 8, fontSize: "0.82rem" }}>
          From {SUPPORT_EMAIL} when generation finishes. You can close the making page and wait for email.
        </p>
      </div>
      {status === "pending" ? (
        <div className="row">
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={busy || !paymentId || !emailOk}
            onClick={confirm}
          >
            {busy ? "Confirming…" : "Simulate pay"}
          </button>
          <button className="btn btn-secondary" disabled={busy || !paymentId} onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <Link className="btn btn-secondary" to="/" style={{ textAlign: "center", textDecoration: "none" }}>
          Back home
        </Link>
      )}
      {error ? <div className="notice danger">{error}</div> : null}
    </div>
  );
}
