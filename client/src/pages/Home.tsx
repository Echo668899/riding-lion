import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  ASSET_KEY,
  EMAIL_KEY,
  SUPPORT_EMAIL,
  api,
  formatUsd,
  PACK_KEY,
  TOKEN_KEY,
  type Catalog,
  type CreditPack,
} from "../api";
import { FAQ_ITEMS, HOW_STEPS, SITE, homeJsonLd, usePageSeo } from "../seo";

export function HomePage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [assetId, setAssetId] = useState(() => localStorage.getItem(ASSET_KEY) || "");
  const [credits, setCredits] = useState(0);
  const [selectedPack, setSelectedPack] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [consented, setConsented] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  const jsonLd = useMemo(
    () =>
      homeJsonLd(
        typeof window !== "undefined" ? window.location.origin : "",
        (catalog?.creditPacks || []).map((p) => ({ name: p.label, price: p.priceCents })),
        { mockPayments: catalog?.mockPayments !== false },
      ),
    [catalog?.creditPacks, catalog?.mockPayments],
  );

  usePageSeo({
    title: SITE.title,
    description: SITE.description,
    path: "/",
    jsonLd,
  });

  useEffect(() => {
    api
      .catalog()
      .then((data) => {
        setCatalog(data);
        const recommended =
          data.creditPacks.find((p) => p.recommended) || data.creditPacks[1] || data.creditPacks[0];
        setSelectedPack(localStorage.getItem(PACK_KEY) || recommended?.id || "");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    api
      .session(accessToken)
      .then((s) => {
        setCredits(s.creditsBalance);
        if (s.email) {
          setAccountEmail(s.email);
          setEmail(s.email);
          localStorage.setItem(EMAIL_KEY, s.email);
        } else {
          setAccountEmail(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAccessToken("");
        setAccountEmail(null);
      });
    api
      .getEmail(accessToken)
      .then((r) => {
        if (r.email) {
          setEmail(r.email);
          setAccountEmail(r.email);
          localStorage.setItem(EMAIL_KEY, r.email);
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const packs: CreditPack[] = catalog?.creditPacks || [];
  const media = catalog?.template?.media;
  const templateTitle = catalog?.template?.title || "Night Road Lion Ride";
  const hasVerifiedSample = media?.sampleKind === "sample_output" && Boolean(media.sampleOutputUrl);
  const heroSrc =
    media?.publicTemplateVideoUrl || media?.sourceVideoUrl || undefined;
  const resultVideoSrc = hasVerifiedSample
    ? media?.sampleOutputUrl || undefined
    : heroSrc;
  const coverUrl = media?.publicCoverUrl || media?.coverUrl || undefined;
  const priceCredits = catalog?.template?.priceCredits || 1;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasCredits = Boolean(assetId && accessToken && credits >= priceCredits);
  const canGenerate = Boolean(hasCredits && emailOk);
  const durationSec = catalog?.template?.durationSec
    ? Math.round(catalog.template.durationSec)
    : 9;
  const fromPrice = packs.length
    ? Math.min(...packs.map((p) => p.priceCents))
    : 999;
  const mockPayments = catalog?.mockPayments !== false;

  const ctaLabel = useMemo(() => {
    if (!assetId) return "Upload My Photo";
    if (!emailOk) return "Add your email to continue";
    if (!consented) return "Confirm permission to continue";
    if (canGenerate) return `Make my Riding Lion video · ${priceCredits} credit`;
    return "Buy credits & make my video";
  }, [assetId, canGenerate, consented, emailOk, priceCredits]);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
      const res = await api.upload(file, accessToken || undefined);
      setAccessToken(res.accessToken);
      setAssetId(res.assetId);
      setCredits(res.creditsBalance);
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      localStorage.setItem(ASSET_KEY, res.assetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function useExamplePhoto() {
    const url = media?.samplePhotoUrl;
    if (!url) {
      setError("Example photo is not available yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load example photo");
      const blob = await res.blob();
      const file = new File([blob], "default-person.jpg", { type: blob.type || "image/jpeg" });
      await onFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use example photo");
      setBusy(false);
    }
  }

  async function onPrimary() {
    if (!assetId || !accessToken || !consented || !emailOk) return;
    setError(null);
    setBusy(true);
    try {
      const trimmed = email.trim().toLowerCase();
      localStorage.setItem(EMAIL_KEY, trimmed);
      await api.saveEmail(accessToken, trimmed);
      if (canGenerate) {
        const job = await api.createGeneration(accessToken, assetId, trimmed);
        navigate(job.resultPath);
        return;
      }
      if (!selectedPack) throw new Error("Select a credit pack");
      localStorage.setItem(PACK_KEY, selectedPack);
      const checkout = await api.checkout(selectedPack, accessToken, `checkout_${accessToken}_${selectedPack}`);
      localStorage.setItem(TOKEN_KEY, checkout.accessToken);
      navigate(`/checkout?paymentId=${checkout.paymentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const packLine = packs.map((p) => `${formatUsd(p.priceCents)} / ${p.credits}`).join(" · ");
  const recommendedPrice = packs.find((p) => p.recommended)
    ? formatUsd(packs.find((p) => p.recommended)!.priceCents)
    : "$19.99";

  return (
    <main>
      <a className="skip-link" href="#create">
        Skip to create
      </a>

      {/* First viewport: brand + one lede + CTA + full-bleed film */}
      <header className="hero-bleed">
        <div className="hero-bleed-media" aria-hidden={!resultVideoSrc && !coverUrl}>
          {resultVideoSrc ? (
            <video
              className="hero-bleed-video"
              src={resultVideoSrc}
              poster={coverUrl}
              autoPlay
              muted
              loop
              playsInline
              title="Riding Lion AI short video preview"
            />
          ) : coverUrl ? (
            <img className="hero-bleed-video" src={coverUrl} alt="" />
          ) : (
            <div className="hero-bleed-fallback" />
          )}
          <div className="hero-bleed-shade" />
        </div>
        <div className="hero-bleed-copy">
          <h1 className="brand-mark">
            Make a Riding Lion AI Video
            <span className="brand-mark-sub"> From Your Photo</span>
          </h1>
          <p className="lede">{SITE.lede}</p>
          <div className="hero-cta-row">
            <a className="btn btn-primary hero-cta" href="#create">
              Upload My Photo
            </a>
            <a className="hero-secondary-link" href="#examples">
              See the original template
            </a>
          </div>
        </div>
      </header>

      <div className="value-ribbon" role="presentation">
        <span>Your photo</span>
        <i aria-hidden="true">+</i>
        <span>Night-road lion ride</span>
        <i aria-hidden="true">+</i>
        <span>~{durationSec}s · 9:16</span>
        <i aria-hidden="true">+</i>
        <span>From {formatUsd(fromPrice)}</span>
      </div>

      {mockPayments ? (
        <p className="notice" style={{ marginTop: 12 }} role="status">
          Checkout is currently <strong>simulated</strong> — you will not be charged a real card. Pack
          prices still show what you will pay when live billing opens.
        </p>
      ) : null}

      <section className="section create-section" id="create" aria-labelledby="create-heading">
        <h2 id="create-heading">Upload My Photo</h2>
        <p>
          Template: <strong>{templateTitle}</strong> · ~{durationSec}s · 9:16 · preview muted ·{" "}
          {priceCredits} credit. Your portrait replaces the featured rider on the night-road lion ride.
        </p>

        <div className="create-panel" id="examples-create">
          <label className={`photo-slot${previewUrl ? " has-file" : ""}`}>
            {previewUrl ? (
              <img src={previewUrl} alt="Your upload preview" />
            ) : media?.samplePhotoUrl ? (
              <img src={media.samplePhotoUrl} alt="Default example person" className="photo-slot-default" />
            ) : coverUrl ? (
              <img src={coverUrl} alt="" className="photo-slot-default" />
            ) : (
              <span className="photo-slot-empty">
                <strong>+ Add photo</strong>
                <em>Lead / featured person · required</em>
              </span>
            )}
            {!previewUrl && (media?.samplePhotoUrl || coverUrl) ? (
              <span className="photo-slot-overlay">
                <strong>+ Add photo</strong>
                <em>or use the example below</em>
              </span>
            ) : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
          </label>
          {media?.samplePhotoUrl ? (
            <button
              type="button"
              className="btn btn-secondary example-photo-btn"
              disabled={busy}
              onClick={useExamplePhoto}
            >
              Use example person photo
            </button>
          ) : null}
          <p className="hint tight">
            Clear, centered, front-facing solo portrait. JPG, PNG or WebP. Kept {catalog?.retentionDays ?? 7}{" "}
            days — delete anytime on your result page.
          </p>
          {fileName ? <p className="muted tight">{fileName}</p> : null}
            {accessToken ? (
              <p className="muted tight">
                Credits{accountEmail ? " on account" : " on this device"}:{" "}
                <strong style={{ color: "var(--ink)" }}>{credits}</strong>
                {" · "}
                {accountEmail ? (
                  <Link to="/account">My library</Link>
                ) : (
                  <Link to="/login?next=%2Faccount">Sign in to sync</Link>
                )}
              </p>
            ) : (
              <p className="muted tight">
                <Link to="/login?next=%2Faccount">Sign in with email</Link> to keep credits &amp; clips
                across devices.
              </p>
            )}

          <label className="field-label" htmlFor="notify-email">
            Email for result link
          </label>
          <input
            id="notify-email"
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
          <p className="hint tight">
            We email you from {SUPPORT_EMAIL} when the short is ready. Replies go to the same inbox.
          </p>

          {!hasCredits ? (
            <div className="packs compact" role="listbox" aria-label="Credit packs">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={`pack ${selectedPack === pack.id ? "selected" : ""} ${pack.recommended ? "recommended" : ""}`}
                  onClick={() => {
                    setSelectedPack(pack.id);
                    localStorage.setItem(PACK_KEY, pack.id);
                  }}
                >
                  <span>
                    {pack.label}
                    {pack.recommended ? <span className="tag">Recommended</span> : null}
                  </span>
                  <span className="price">{formatUsd(pack.priceCents)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="create-credit-note">
              <p style={{ margin: 0 }}>
                <strong>1 credit = 1 finished Riding Lion short.</strong> You have {credits} ready.
              </p>
            </div>
          )}

          <label className="consent">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
            />
            <span>
              I’m 18+ and have permission to animate every uploaded subject. I will not use the result to
              impersonate or deceive anyone.
            </span>
          </label>

          <button
            className="btn btn-primary"
            disabled={!assetId || !consented || !emailOk || busy}
            onClick={onPrimary}
          >
            {busy ? "Working…" : ctaLabel}
          </button>
          {packLine ? (
            <p className="muted tight center-text">
              Credits: {packLine}. From {formatUsd(fromPrice)}. No subscription.
            </p>
          ) : null}
          {error ? <div className="notice danger">{error}</div> : null}
        </div>
      </section>

      <section className="section" id="examples" aria-labelledby="examples-heading">
        <h2 id="examples-heading">See the Original Lion Ride and the Generated Result</h2>
        {hasVerifiedSample ? (
          <p>
            Left: ordinary input portrait. Right: generated Riding Lion result after face replacement on
            the night-road template. Preview players are muted; downloaded files may include the template
            soundtrack.
          </p>
        ) : (
          <p>
            Showing the <strong>original Riding Lion template</strong> (night-road lion ride). A verified
            before/after with an ordinary portrait will appear here once a distinct sample output is
            published. Preview plays muted; the public MP4 includes an AAC soundtrack.
          </p>
        )}
        <div className="compare">
          <figure>
            <div className="phone-frame">
              {hasVerifiedSample && media?.samplePhotoUrl ? (
                <img src={media.samplePhotoUrl} alt="Ordinary input portrait for Riding Lion AI video" />
              ) : coverUrl ? (
                <img src={coverUrl} alt="Night-road lion ride template cover" />
              ) : (
                <div className="empty-frame">Loading…</div>
              )}
            </div>
            <figcaption>{hasVerifiedSample ? "Input portrait" : "Template cover"}</figcaption>
          </figure>
          <figure>
            <div className="phone-frame">
              {resultVideoSrc ? (
                <video
                  src={resultVideoSrc}
                  poster={coverUrl}
                  muted
                  loop
                  playsInline
                  controls
                  title={hasVerifiedSample ? "Generated Riding Lion result" : "Original Riding Lion Template"}
                />
              ) : coverUrl ? (
                <img src={coverUrl} alt="Template preview cover" />
              ) : (
                <div className="empty-frame">Loading preview…</div>
              )}
            </div>
            <figcaption>
              {hasVerifiedSample ? "Generated result" : "Original Riding Lion Template"}
            </figcaption>
          </figure>
        </div>
        {media?.publicTemplateVideoUrl ? (
          <p className="muted tight" style={{ marginTop: 12 }}>
            <a href={media.publicTemplateVideoUrl}>Open crawlable template MP4</a>
            {" · "}
            Preview muted by default · soundtrack present in the file
          </p>
        ) : null}
      </section>

      <section className="section" id="how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading">How to make a Riding Lion AI video</h2>
        <p>One portrait, one fixed night-road template — no prompt engineering.</p>
        <ol className="how-list">
          {HOW_STEPS.map((step, i) => (
            <li key={step.name}>
              <strong>
                {String(i + 1).padStart(2, "0")} {step.name}
              </strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" id="pricing" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">How much does a Riding Lion AI video cost?</h2>
        <p>
          <strong>1 credit = 1 finished video.</strong> From {formatUsd(fromPrice)}. Recommended pack: 3
          credits for {recommendedPrice}.{" "}
          {mockPayments ? "Checkout is simulated today — no real card charge." : null}
        </p>
        <div className="packs">
          {packs.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className={`pack ${selectedPack === pack.id ? "selected" : ""} ${pack.recommended ? "recommended" : ""}`}
              onClick={() => {
                setSelectedPack(pack.id);
                localStorage.setItem(PACK_KEY, pack.id);
                document.getElementById("create")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span>
                {pack.label}
                {pack.recommended ? <span className="tag">Recommended</span> : null}
                <div className="muted" style={{ fontSize: "0.82rem", marginTop: 4 }}>
                  {pack.credits} Riding Lion short{pack.credits > 1 ? "s" : ""}
                </div>
              </span>
              <span className="price">{formatUsd(pack.priceCents)}</span>
            </button>
          ))}
        </div>
        <a
          className="btn btn-primary"
          href="#create"
          style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 14 }}
        >
          Upload My Photo
        </a>
      </section>

      <section className="section" id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Riding Lion FAQ</h2>
        <p>Sound, pricing, which rider your photo replaces, and what happens if generation fails.</p>
        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
