import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, TOKEN_KEY, type Job } from "../api";
import { SITE, usePageSeo } from "../seo";

function friendlyFailure(job: Job): { title: string; detail: string } {
  const code = (job.errorCode || "").toLowerCase();
  const raw = `${job.errorCode || ""} ${job.errorMessage || ""}`.toLowerCase();
  if (code.includes("content_rejected") || raw.includes("422")) {
    return {
      title: "We couldn’t finish this short",
      detail:
        "The model rejected this photo or likeness combination. You can refund this credit and try a clearer, authorized solo portrait.",
    };
  }
  if (code.includes("storage")) {
    return {
      title: "We couldn’t save your clip",
      detail: "Generation may have finished, but storage failed. Request a refund and try again.",
    };
  }
  return {
    title: "Generation did not complete",
    detail: "Something went wrong while making your short. You can request a refund for this credit.",
  };
}

function refundLabel(status: string) {
  if (status === "refunded") return "Credit restored";
  if (status === "pending") return "Refund pending";
  return "Credit not refunded yet";
}

export function ResultPage() {
  const { accessToken = "" } = useParams();
  const [params] = useSearchParams();
  const jobFromQuery = params.get("job");
  const [credits, setCredits] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  usePageSeo({
    title: `Your clip — ${SITE.name}`,
    description: "Private Riding Lion generation result. Not for public indexing.",
    path: accessToken ? `/r/${accessToken}` : "/r/",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const session = await api.session(accessToken);
        if (cancelled) return;
        setCredits(session.creditsBalance);
        const selected =
          session.jobs.find((j) => j.jobId === jobFromQuery) || session.jobs[0] || null;
        setJob(selected);
        if (selected && ["queued", "submitting", "submitted", "processing"].includes(selected.status)) {
          timer = window.setTimeout(load, 2500);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load result");
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [accessToken, jobFromQuery]);

  async function requestRefund() {
    if (!job) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.refund(job.jobId, accessToken, "undelivered generation");
      setCredits(res.creditsBalance);
      setJob({ ...job, refundStatus: res.refundStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOutput() {
    if (!job?.outputAssetId) return;
    setBusy(true);
    try {
      await api.deleteAsset(job.outputAssetId, accessToken);
      setJob({ ...job, outputPlayUrl: null, outputDownloadUrl: null, outputAssetId: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const pending = job && ["queued", "submitting", "submitted", "processing"].includes(job.status);
  const failed = job && ["failed", "storage_failed"].includes(job.status);
  const ok = job?.status === "succeeded";
  const failureCopy = job && failed ? friendlyFailure(job) : null;

  return (
    <div className={`center-page${pending ? " making-page" : ""}`}>
      {!pending ? (
        <>
          <p className="eyebrow">Your clip</p>
          <h1 className="brand-mark" style={{ fontSize: "3rem" }}>
            Riding Lion
          </h1>
          <p className="muted">Credits left: {credits}</p>
        </>
      ) : null}

      {!job && !error ? <p className="muted">Loading…</p> : null}

      {job && pending ? (
        <section className="making-stage" aria-live="polite" aria-label="Generating your short">
          <p className="eyebrow">Crafting your short</p>
          <h1 className="brand-mark making-title">Riding Lion</h1>
          <div className="making-notice making-notice-top" role="status">
            <strong>No need to wait for the result.</strong>
            <p>
              When generation finishes, we email you from support@ridinglion.com with your private result
              link. You can close this page now, or stay here and wait.
            </p>
          </div>

          <p className="making-sub">
            Blending your photo into the template with Seedance. Live runs can take a few minutes…
          </p>

          <div className="making-frame">
            <div className="making-scan" aria-hidden="true" />
            <div className="making-media">
              <div className="making-video">
                {job.templateVideoUrl ? (
                  <video
                    src={job.templateVideoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    title="Template video"
                  />
                ) : (
                  <div className="making-placeholder">Template</div>
                )}
                <span className="making-label">Template</span>
              </div>
              <div className="making-photo">
                {job.uploadImageUrl ? (
                  <img src={job.uploadImageUrl} alt="Your uploaded photo" />
                ) : (
                  <div className="making-placeholder">Your photo</div>
                )}
                <span className="making-label">Your photo</span>
              </div>
            </div>
          </div>

          <div className="status-pill" role="status">
            <span className="dot" />
            Generating…
          </div>
          <p className="muted making-credits">Credits left: {credits}</p>
        </section>
      ) : null}

      {job && !pending ? (
        <>
          <div className={`status-pill ${ok ? "ok" : failed ? "bad" : ""}`} role="status">
            <span className="dot" />
            {job.status.replaceAll("_", " ")}
          </div>

          {ok && job.outputPlayUrl ? (
            <div className="phone-frame" style={{ marginTop: 18, width: "min(320px, 85vw)" }}>
              <video src={job.outputPlayUrl} controls playsInline />
            </div>
          ) : null}

          {failureCopy ? (
            <div className="notice danger">
              <strong>{failureCopy.title}</strong>
              <div style={{ marginTop: 6 }}>{failureCopy.detail}</div>
              <div style={{ marginTop: 8 }}>{refundLabel(job.refundStatus)}</div>
            </div>
          ) : null}

          <div className="row">
            {job.outputDownloadUrl ? (
              <a
                className="btn btn-primary"
                style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
                href={job.outputDownloadUrl}
              >
                Download
              </a>
            ) : null}
            {ok && job.outputAssetId ? (
              <button className="btn btn-danger" disabled={busy} onClick={deleteOutput}>
                Delete media
              </button>
            ) : null}
            {failed && job.refundStatus === "none" ? (
              <button className="btn btn-secondary" disabled={busy} onClick={requestRefund}>
                Request refund
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? <div className="notice danger">{error}</div> : null}
      <Link to="/" className="muted" style={{ marginTop: 18 }}>
        ← Make another
      </Link>
    </div>
  );
}
