import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const jsonLd = useMemo(
    () =>
      homeJsonLd(
        typeof window !== "undefined" ? window.location.origin : "",
        (catalog?.creditPacks || []).map((p) => ({ name: p.label, price: p.priceCents })),
      ),
    [catalog?.creditPacks],
  );

  usePageSeo({
    title: `${SITE.name} – Photo to AI Short Video | Face Swap Clip`,
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
      .then((s) => setCredits(s.creditsBalance))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAccessToken("");
      });
    api
      .getEmail(accessToken)
      .then((r) => {
        if (r.email) {
          setEmail(r.email);
          localStorage.setItem(EMAIL_KEY, r.email);
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const packs: CreditPack[] = catalog?.creditPacks || [];
  const media = catalog?.template?.media;
  const heroSrc = media?.sourceVideoUrl || undefined;
  const resultVideoSrc = media?.sampleOutputUrl || heroSrc;
  const priceCredits = catalog?.template?.priceCredits || 1;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasCredits = Boolean(assetId && accessToken && credits >= priceCredits);
  const canGenerate = Boolean(hasCredits && emailOk);
  const durationSec = catalog?.template?.durationSec
    ? Math.round(catalog.template.durationSec)
    : 9;

  const ctaLabel = useMemo(() => {
    if (!assetId) return "Add a photo to continue";
    if (!emailOk) return "Add your email to continue";
    if (!consented) return "Confirm permission to continue";
    if (canGenerate) return `Make my short · ${priceCredits} credit`;
    return "Buy credits & make my short";
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

  return (
    <main>
      <a className="skip-link" href="#create">
        Skip to content
      </a>

      {/* Hero: create form + vertical preview (Tiny Desk pattern) */}
      <header className="hero-split" id="create">
        <div className="hero-copy-col">
          <p className="eyebrow">AI photo to video</p>
          <h1 className="brand-mark">
            Riding Lion.
            <span className="brand-mark-sub"> You’re the star.</span>
          </h1>
          <p className="lede">
            Turn one authorized portrait into an 8–10s silent 9:16 AI short. Same camera and motion as the
            template — cinematic face replacement, no prompts, no settings.
          </p>

          <div className="create-card" id="examples-create">
            <div className="create-card-head">
              <strong>Turn &amp; Smile</strong>
              <span>
                {durationSec}s · 9:16 · silent · {priceCredits} credit
              </span>
            </div>

            <label className={`photo-slot${previewUrl ? " has-file" : ""}`}>
              {previewUrl ? (
                <img src={previewUrl} alt="Your upload preview" />
              ) : media?.samplePhotoUrl ? (
                <img src={media.samplePhotoUrl} alt="Default example person" className="photo-slot-default" />
              ) : (
                <span className="photo-slot-empty">
                  <strong>+ Add photo</strong>
                  <em>Lead / featured person · required</em>
                </span>
              )}
              {!previewUrl && media?.samplePhotoUrl ? (
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
                Credits on this device: <strong style={{ color: "var(--ink)" }}>{credits}</strong>
              </p>
            ) : null}

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
              <div className="packs compact" id="pricing" role="listbox" aria-label="Credit packs">
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
              <div id="pricing" className="panel tight-panel">
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
                Credits: {packLine}. No subscription.
              </p>
            ) : null}
            {error ? <div className="notice danger">{error}</div> : null}
            {catalog?.mockGeneration ? (
              <p className="muted tight">
                Mock generation is on — add FAL_KEY (and keep MOCK_GENERATION=false) for live Seedance
                editing.
              </p>
            ) : (
              <p className="muted tight">Live fal Seedance editing is enabled for this session.</p>
            )}
          </div>
        </div>

        <aside className="hero-media-col" aria-label="What you get">
          <div className="hero-video-wrap">
            <div className="hero-phone">
              {resultVideoSrc ? (
                <video
                  src={resultVideoSrc}
                  poster={media?.coverUrl || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  title="Riding Lion AI short video preview"
                />
              ) : (
                <div className="hero-phone-fallback">Preview pending</div>
              )}
            </div>
            {media?.samplePhotoUrl ? (
              <div className="polaroid">
                <img src={media.samplePhotoUrl} alt="Example input photo for Riding Lion" />
                <span>Input</span>
              </div>
            ) : null}
          </div>
          <p className="hero-media-caption">
            <strong>What you get:</strong> an 8–10s vertical AI face-swap short from your photo.{" "}
            {media?.sampleKind === "sample_output"
              ? "Sample finished clip shown."
              : "Template preview (original) shown until a sample output is uploaded."}
          </p>
        </aside>
      </header>

      {/* Keyword / value ribbon */}
      <div className="value-ribbon" role="presentation">
        <span>Your photo</span>
        <i aria-hidden="true">+</i>
        <span>AI face replacement</span>
        <i aria-hidden="true">+</i>
        <span>8–10s short</span>
        <i aria-hidden="true">+</i>
        <span>One-time credits</span>
      </div>

      <section className="section" id="examples" aria-labelledby="examples-heading">
        <h2 id="examples-heading">Riding Lion. A fixed short, a new face.</h2>
        <p>
          The turn, the look to camera, the smile stay. You replace the featured performer with one clear
          portrait — built for TikTok, Reels, and YouTube Shorts.
        </p>
        <div className="compare">
          <figure>
            {media?.samplePhotoUrl ? (
              <div className="phone-frame">
                <img src={media.samplePhotoUrl} alt="Example portrait for AI photo to video" />
              </div>
            ) : (
              <div className="phone-frame empty-frame">Sample photo pending</div>
            )}
            <figcaption>Your photo moment</figcaption>
          </figure>
          <figure>
            <div className="phone-frame">
              {resultVideoSrc ? (
                <video src={resultVideoSrc} muted loop playsInline controls title="Result preview" />
              ) : (
                <div className="empty-frame">Preview pending</div>
              )}
            </div>
            <figcaption>Your Riding Lion short</figcaption>
          </figure>
        </div>
      </section>

      <section className="section" id="how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading">Your Riding Lion short, step by step.</h2>
        <p>Photo to AI short video in four moves — no prompt engineering.</p>
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

      <section className="section" id="pricing-detail" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">Riding Lion credits. Pay once, keep making shorts.</h2>
        <p>
          Each finished clip uses <strong>1 credit</strong>. No subscription. Recommended pack: 3 credits for{" "}
          {packs.find((p) => p.recommended) ? formatUsd(packs.find((p) => p.recommended)!.priceCents) : "$19.99"}.
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
        <a className="btn btn-primary" href="#create" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 14 }}>
          Create a video
        </a>
      </section>

      <section className="section" id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Riding Lion: your questions answered.</h2>
        <p>Straight answers about photo-to-video shorts, credits, and face replacement.</p>
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
