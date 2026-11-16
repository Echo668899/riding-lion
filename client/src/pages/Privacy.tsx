import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "../api";
import { SITE, usePageSeo } from "../seo";

export function PrivacyPage() {
  usePageSeo({
    title: `Privacy & likeness — ${SITE.name}`,
    description:
      "How Riding Lion handles uploaded photos, AI short video outputs, retention (7 days), deletion, email notices, and authorized likeness use.",
    path: "/privacy",
  });

  return (
    <article className="center-page" style={{ alignContent: "start", paddingTop: 40 }}>
      <p className="eyebrow">Policy</p>
      <h1 className="brand-mark" style={{ fontSize: "2.8rem" }}>
        Privacy & likeness
      </h1>
      <div className="panel" style={{ display: "grid", gap: 14 }}>
        <p>
          Riding Lion is an AI photo-to-video service operated at ridinglion.com. Upload only portraits of
          yourself or people who authorized this use. Unauthorized deepfakes, impersonation, and deceptive
          use of someone’s likeness are not allowed.
        </p>

        <p>
          <strong>What we collect.</strong> The photo you upload, generation job metadata, credit/wallet
          session tokens stored in your browser, and the email address you use for login and result
          delivery. Sign-in is passwordless (one-time email codes). We do not store account passwords.
        </p>

        <p>
          <strong>How media is stored.</strong> Uploaded photos and finished clips live in private object
          storage. They are not listed publicly and are reachable only through unguessable signed or
          tokenized result links. Default retention is <strong>7 days</strong>; you can delete media
          earlier from your result page. After retention expires, objects are eligible for permanent
          removal.
        </p>

        <p>
          <strong>Email.</strong> We use your email only to send the private result link when generation
          finishes and to respond to support messages. Mail is sent from and received at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We do not sell your email or use it for
          unrelated marketing lists.
        </p>

        <p>
          <strong>Payments & credits.</strong> Credits are purchased through our checkout flow. Card or
          wallet details are handled by the payment provider when live checkout is enabled; Riding Lion
          stores payment status, pack, and credit balance needed to fulfill your order—not full card
          numbers. Failed or undelivered paid generations may be eligible for a credit restoration; contact
          support with your result or payment reference.
        </p>

        <p>
          <strong>Generation providers.</strong> To create your clip we send the template video and your
          portrait to our AI generation vendor (fal / Seedance) over encrypted connections. Do not upload
          photos you are not allowed to process with third-party AI services.
        </p>

        <p>
          <strong>Your responsibilities.</strong> You confirm you are 18+, have rights to every uploaded
          likeness, and will not use outputs to impersonate or deceive. We may refuse or remove content
          that violates this policy.
        </p>

        <p className="muted" style={{ margin: 0 }}>
          Questions, deletion requests, or refunds for undelivered paid jobs:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
      <Link to="/" className="muted" style={{ marginTop: 18 }}>
        ← Back to Riding Lion
      </Link>
    </article>
  );
}
