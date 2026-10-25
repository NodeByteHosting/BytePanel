import "server-only";
import { createTransport } from "nodemailer";

import { env } from "./env";
import { readPanelSettings } from "./settings";

const getTransporter = () => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    return null;
  }
  return createTransport({
    auth: { pass: env.SMTP_PASS, user: env.SMTP_USER },
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
  });
};

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Templates use {{panelName}}, {{logo}}, {{supportUrl}}, {{websiteUrl}} and
// {{websiteHost}}; they are filled from /admin/settings at send time.
const brandTokens = async () => {
  const settings = await readPanelSettings();
  const panelUrl = env.BETTER_AUTH_URL;
  const websiteUrl = settings.websiteUrl ?? panelUrl;
  const name = escapeHtml(settings.panelName);
  return {
    html: {
      logo: settings.logoUrl
        ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${name}" style="height:28px;max-width:200px" />`
        : name,
      panelName: name,
      supportUrl: escapeHtml(settings.supportUrl ?? panelUrl),
      websiteHost: escapeHtml(new URL(websiteUrl).host),
      websiteUrl: escapeHtml(websiteUrl),
    },
    text: {
      logo: settings.panelName,
      panelName: settings.panelName,
      supportUrl: settings.supportUrl ?? panelUrl,
      websiteHost: new URL(websiteUrl).host,
      websiteUrl,
    },
  };
};

const fillTokens = (template: string, values: Record<string, string>) =>
  template.replaceAll(
    /\{\{(?<key>\w+)\}\}/gu,
    (match, key: string) =>
      Object.hasOwn(values, key) ? (values[key] as string) : match
  );

/**
 * Sends an email. Returns `true` on success, `false` if SMTP is unconfigured
 * or the send fails. Never throws — email failures should never crash a request.
 */
export const sendMail = async (options: MailOptions): Promise<boolean> => {
  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }
  try {
    const tokens = await brandTokens();
    await transporter.sendMail({
      from: env.SMTP_FROM,
      html: fillTokens(options.html, tokens.html),
      subject: fillTokens(options.subject, tokens.text),
      text: fillTokens(options.text, tokens.text),
      to: options.to,
    });
    return true;
  } catch (error) {
    console.error("[mail] Failed to send email:", error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Shared base template
// ---------------------------------------------------------------------------

const baseTemplate = (contentHtml: string) =>
  `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e5e5e5; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #111111; border: 1px solid #222; border-radius: 12px; overflow: hidden; }
    .header { background: #161616; padding: 28px 36px 22px; border-bottom: 1px solid #222; }
    .logo { font-size: 17px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
    .logo span { color: #7c3aed; }
    .body { padding: 32px 36px; }
    h1 { font-size: 21px; font-weight: 600; color: #fff; margin: 0 0 10px; }
    p { font-size: 14px; line-height: 1.65; color: #a3a3a3; margin: 0 0 14px; }
    .hl { color: #e5e5e5; font-weight: 500; }
    .badge { display: inline-block; background: #1e1e2e; border: 1px solid #333; border-radius: 6px; padding: 2px 9px; font-size: 12px; color: #a78bfa; font-weight: 500; margin: 0 2px; }
    .btn { display: inline-block; background: #7c3aed; color: #fff !important; text-decoration: none; padding: 11px 26px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 8px 0 20px; }
    .info-box { background: #161616; border: 1px solid #222; border-radius: 8px; padding: 14px 18px; margin: 14px 0 20px; font-size: 13px; }
    .info-box dt { color: #525252; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .info-box dd { color: #d4d4d4; font-weight: 500; margin: 0 0 10px; }
    .info-box dd:last-child { margin-bottom: 0; }
    .meta { font-size: 12px; color: #525252; border-top: 1px solid #1a1a1a; padding-top: 18px; margin-top: 4px; }
    .footer { padding: 18px 36px; background: #0d0d0d; font-size: 11px; color: #404040; text-align: center; }
    .footer a { color: #525252; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">{{logo}}</div>
    </div>
    <div class="body">${contentHtml}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} {{panelName}} &mdash;
      <a href="{{websiteUrl}}">{{websiteHost}}</a> &mdash;
      <a href="{{supportUrl}}">Support</a>
    </div>
  </div>
</body>
</html>`.trim();

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

interface ServerInviteParams {
  /** Recipient's email address */
  toEmail: string;
  /** Name of the server they were invited to */
  serverName: string;
  /** Display name of the person who sent the invite */
  invitedByName: string;
  /** Role they will be granted */
  role: string;
  /** The accept URL (e.g. https://panel.nodebyte.host/invite/TOKEN) */
  acceptUrl: string;
  /** ISO string when the invite expires */
  expiresAt: string;
}

export const sendServerInviteEmail = (
  params: ServerInviteParams
): Promise<boolean> => {
  const { toEmail, serverName, invitedByName, role, acceptUrl, expiresAt } =
    params;

  const expiry = new Date(expiresAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Server Invite — {{panelName}}</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e5e5e5; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #111111; border: 1px solid #222; border-radius: 12px; overflow: hidden; }
    .header { background: #161616; padding: 32px 40px 24px; border-bottom: 1px solid #222; }
    .logo { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
    .logo span { color: #7c3aed; }
    .body { padding: 32px 40px; }
    h1 { font-size: 22px; font-weight: 600; color: #fff; margin: 0 0 8px; }
    p { font-size: 15px; line-height: 1.6; color: #a3a3a3; margin: 0 0 16px; }
    .highlight { color: #e5e5e5; }
    .badge { display: inline-block; background: #1e1e2e; border: 1px solid #333; border-radius: 6px; padding: 3px 10px; font-size: 13px; color: #a78bfa; font-weight: 500; margin: 0 2px; }
    .btn { display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
    .meta { font-size: 13px; color: #525252; border-top: 1px solid #222; padding-top: 20px; margin-top: 8px; }
    .footer { padding: 20px 40px; background: #0d0d0d; font-size: 12px; color: #404040; text-align: center; }
    .footer a { color: #525252; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">{{logo}}</div>
    </div>
    <div class="body">
      <h1>You've been invited</h1>
      <p>
        <span class="highlight">${invitedByName}</span> has invited you to collaborate on the server
        <span class="highlight">${serverName}</span> on {{panelName}}.
      </p>
      <p>
        You have been granted the <span class="badge">${roleLabel}</span> role.
      </p>
      <a class="btn" href="${acceptUrl}">Accept invite</a>
      <p class="meta">
        This invite expires on <strong style="color:#737373">${expiry}</strong>.
        If you don't have a {{panelName}} account you'll need to create one first.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} {{panelName}} &mdash;
      <a href="{{websiteUrl}}">{{websiteHost}}</a> &mdash;
      <a href="{{supportUrl}}">Support</a>
    </div>
  </div>
</body>
</html>
`.trim();

  const text = [
    `You've been invited to ${serverName} on {{panelName}} by ${invitedByName}.`,
    `Role: ${roleLabel}`,
    ``,
    `Accept your invite: ${acceptUrl}`,
    ``,
    `This invite expires on ${expiry}.`,
    `If you don't have a {{panelName}} account you'll need to create one first.`,
  ].join("\n");

  return sendMail({
    html,
    subject: `${invitedByName} invited you to ${serverName} on {{panelName}}`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Welcome email
// ---------------------------------------------------------------------------

export const sendWelcomeEmail = (
  toEmail: string,
  displayName: string | null | undefined = "there"
): Promise<boolean> => {
  const panelUrl = process.env.BETTER_AUTH_URL ?? "https://panel.nodebyte.host";

  const html = baseTemplate(`
    <h1>Welcome to {{panelName}}</h1>
    <p>Hi <span class="hl">${displayName}</span>, welcome aboard!</p>
    <p>Your account is ready. Head to the dashboard to deploy your first game server it only takes about 60 seconds.</p>
    <a class="btn" href="${panelUrl}/dashboard">Go to dashboard</a>
    <p class="meta">
      Need help? Visit <a href="{{supportUrl}}" style="color:#737373">{{supportUrl}}</a>.
    </p>
  `);

  const text = [
    `Welcome to {{panelName}}, ${displayName}!`,
    ``,
    `Your account is ready. Head to the dashboard to deploy your first game server.`,
    ``,
    `${panelUrl}/dashboard`,
    ``,
    `Need help? Visit {{supportUrl}}`,
  ].join("\n");

  return sendMail({
    html,
    subject: "Welcome to {{panelName}}",
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------

export const sendPasswordResetEmail = (
  toEmail: string,
  resetUrl: string
): Promise<boolean> => {
  const html = baseTemplate(`
    <h1>Reset your password</h1>
    <p>We received a request to reset the password for your {{panelName}} account.</p>
    <a class="btn" href="${resetUrl}">Reset password</a>
    <p class="meta">
      This link expires in <strong style="color:#737373">1 hour</strong>.
      If you didn't request a password reset, you can safely ignore this email your password won't change.
    </p>
  `);

  const text = [
    `Reset your {{panelName}} password`,
    ``,
    `Click the link below to reset your password (expires in 1 hour):`,
    resetUrl,
    ``,
    `If you didn't request this, ignore this email.`,
  ].join("\n");

  return sendMail({
    html,
    subject: "Reset your {{panelName}} password",
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Server created email
// ---------------------------------------------------------------------------

interface ServerCreatedParams {
  toEmail: string;
  userName: string | null | undefined;
  serverName: string;
  game: string;
  region: string;
  serverUrl: string;
}

export const sendServerCreatedEmail = (
  params: ServerCreatedParams
): Promise<boolean> => {
  const { toEmail, userName, serverName, game, region, serverUrl } = params;
  const displayName = userName ?? "there";
  const gameLabel =
    game.charAt(0).toUpperCase() + game.slice(1).replaceAll("-", " ");

  const html = baseTemplate(`
    <h1>Your server is being provisioned</h1>
    <p>Hi <span class="hl">${displayName}</span>, your new game server is spinning up and should be ready in about 60 seconds.</p>
    <dl class="info-box">
      <dt>Server name</dt><dd>${serverName}</dd>
      <dt>Game</dt><dd>${gameLabel}</dd>
      <dt>Region</dt><dd>${region}</dd>
    </dl>
    <a class="btn" href="${serverUrl}">View server</a>
    <p class="meta">
      Once provisioned, you'll find the connection details on your server page.
    </p>
  `);

  const text = [
    `Your {{panelName}} server "${serverName}" is being provisioned.`,
    ``,
    `Game: ${gameLabel}`,
    `Region: ${region}`,
    ``,
    `View your server: ${serverUrl}`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Your server "${serverName}" is being provisioned`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Server deleted email
// ---------------------------------------------------------------------------

interface ServerDeletedParams {
  toEmail: string;
  userName: string | null | undefined;
  serverName: string;
}

export const sendServerDeletedEmail = (
  params: ServerDeletedParams
): Promise<boolean> => {
  const { toEmail, userName, serverName } = params;
  const displayName = userName ?? "there";

  const html = baseTemplate(`
    <h1>Server deletion initiated</h1>
    <p>Hi <span class="hl">${displayName}</span>, your server <span class="hl">${serverName}</span> has been queued for deletion.</p>
    <p>All associated resources will be removed shortly. Your billing subscription for this server will also be cancelled.</p>
    <p class="meta">
      If this was a mistake or you have any questions, contact us at
      <a href="{{supportUrl}}" style="color:#737373">{{supportUrl}}</a> as soon as possible.
    </p>
  `);

  const text = [
    `Your {{panelName}} server "${serverName}" has been queued for deletion.`,
    ``,
    `All resources will be removed and your subscription will be cancelled.`,
    ``,
    `If this was a mistake, contact us at {{supportUrl}}`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Server "${serverName}" is being deleted`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Snapshot bake notification emails (superadmin-only internal alerts)
// ---------------------------------------------------------------------------

interface SnapshotBakeStartedParams {
  toEmails: string[];
  buildId: string;
  triggeredByEmail: string;
  environment: string;
  adminUrl: string;
}

export const sendSnapshotBakeStartedEmail = async (
  params: SnapshotBakeStartedParams
): Promise<void> => {
  const { toEmails, buildId, triggeredByEmail, environment, adminUrl } = params;

  const html = baseTemplate(`
    <h1>Snapshot bake started</h1>
    <p>A new server image bake has been triggered on {{panelName}}.</p>
    <dl class="info-box">
      <dt>Build ID</dt><dd>${buildId}</dd>
      <dt>Triggered by</dt><dd>${triggeredByEmail}</dd>
      <dt>Environment</dt><dd>${environment}</dd>
    </dl>
    <a class="btn" href="${adminUrl}">View bake progress</a>
    <p class="meta">
      This is an automated alert. The build typically completes within 30–45 minutes.
      You will receive another email when the bake finishes.
    </p>
  `);

  const text = [
    `Snapshot bake started on {{panelName}}.`,
    ``,
    `Build ID: ${buildId}`,
    `Triggered by: ${triggeredByEmail}`,
    `Environment: ${environment}`,
    ``,
    `View progress: ${adminUrl}`,
  ].join("\n");

  await Promise.all(
    toEmails.map((to) =>
      sendMail({
        html,
        subject: "{{panelName}}: Snapshot bake started",
        text,
        to,
      })
    )
  );
};

interface SnapshotBakeCompletedParams {
  toEmails: string[];
  buildId: string;
  success: boolean;
  environment: string;
  adminUrl: string;
  /** Only set on success */
  newSnapshotId?: string | null;
  /** Only set on failure */
  errorReason?: string | null;
  /** ISO string */
  startedAt: string;
  /** ISO string */
  finishedAt: string;
}

export const sendSnapshotBakeCompletedEmail = async (
  params: SnapshotBakeCompletedParams
): Promise<void> => {
  const {
    toEmails,
    buildId,
    success,
    environment,
    adminUrl,
    newSnapshotId,
    errorReason,
    startedAt,
    finishedAt,
  } = params;

  const durationMs =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const durationMin = Math.round(durationMs / 60_000);
  const durationLabel =
    durationMs < 60_000
      ? `${Math.round(durationMs / 1000)}s`
      : `${durationMin}m`;

  const statusLabel = success ? "✅ Succeeded" : "❌ Failed";
  const headerColour = success ? "#16a34a" : "#dc2626";

  const detailRows = success
    ? `<dt>New image ID</dt><dd>${newSnapshotId ?? "—"}</dd>`
    : `<dt>Error</dt><dd style="color:#f87171">${errorReason ?? "Unknown error"}</dd>`;

  const html = baseTemplate(`
    <h1 style="color:${headerColour}">Snapshot bake ${success ? "succeeded" : "failed"}</h1>
    <p>The snapshot bake triggered on {{panelName}} has <strong>${success ? "completed successfully" : "failed"}</strong>.</p>
    <dl class="info-box">
      <dt>Status</dt><dd>${statusLabel}</dd>
      <dt>Build ID</dt><dd>${buildId}</dd>
      <dt>Environment</dt><dd>${environment}</dd>
      <dt>Duration</dt><dd>${durationLabel}</dd>
      ${detailRows}
    </dl>
    <a class="btn" href="${adminUrl}">View build details</a>
    ${success ? "" : `<p class="meta" style="color:#f87171">Action required: review the build logs and re-trigger the bake once the issue is resolved.</p>`}
  `);

  const text = success
    ? [
        `Snapshot bake succeeded on {{panelName}}.`,
        ``,
        `Build ID: ${buildId}`,
        `Environment: ${environment}`,
        `Duration: ${durationLabel}`,
        `New image ID: ${newSnapshotId ?? "—"}`,
        ``,
        `View details: ${adminUrl}`,
      ].join("\n")
    : [
        `Snapshot bake FAILED on {{panelName}}.`,
        ``,
        `Build ID: ${buildId}`,
        `Environment: ${environment}`,
        `Duration: ${durationLabel}`,
        `Error: ${errorReason ?? "Unknown error"}`,
        ``,
        `Review the build details and re-trigger once resolved: ${adminUrl}`,
      ].join("\n");

  const subject = success
    ? "{{panelName}}: Snapshot bake succeeded"
    : "{{panelName}}: Snapshot bake FAILED";

  await Promise.all(
    toEmails.map((to) => sendMail({ html, subject, text, to }))
  );
};

// ---------------------------------------------------------------------------
// Server rescaled email
// ---------------------------------------------------------------------------

interface ServerRescaledParams {
  toEmail: string;
  userName: string | null | undefined;
  serverName: string;
  newServerType: string;
  serverUrl: string;
}

export const sendServerRescaledEmail = (
  params: ServerRescaledParams
): Promise<boolean> => {
  const { toEmail, userName, serverName, newServerType, serverUrl } = params;
  const displayName = userName ?? "there";

  const html = baseTemplate(`
    <h1>Server rescaled</h1>
    <p>Hi <span class="hl">${displayName}</span>, your server <span class="hl">${serverName}</span> has been successfully rescaled.</p>
    <dl class="info-box">
      <dt>New plan</dt><dd>${newServerType}</dd>
    </dl>
    <a class="btn" href="${serverUrl}">View server</a>
    <p class="meta">
      Your billing subscription has been updated to reflect the new plan. Start your server when you're ready.
    </p>
  `);

  const text = [
    `Your {{panelName}} server "${serverName}" has been rescaled.`,
    ``,
    `New plan: ${newServerType}`,
    ``,
    `View your server: ${serverUrl}`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Server "${serverName}" rescaled to ${newServerType}`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Invoice paid email
// ---------------------------------------------------------------------------

interface InvoicePaidParams {
  toEmail: string;
  toName: string | null | undefined;
  planName: string;
  amountPaidCents: number;
  currency: string;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export const sendInvoicePaidEmail = (
  params: InvoicePaidParams
): Promise<boolean> => {
  const {
    toEmail,
    toName,
    planName,
    amountPaidCents,
    currency,
    invoiceUrl,
    invoicePdf,
    periodStart,
    periodEnd,
  } = params;
  const displayName = toName ?? "there";

  const amountLabel = new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency",
  }).format(amountPaidCents / 100);

  const periodLabel =
    periodStart && periodEnd
      ? `${periodStart.toLocaleDateString("en-US", { dateStyle: "medium" })} – ${periodEnd.toLocaleDateString("en-US", { dateStyle: "medium" })}`
      : null;

  let invoiceLink: string;
  if (invoiceUrl) {
    invoiceLink = `<a class="btn" href="${invoiceUrl}">View invoice</a>`;
  } else if (invoicePdf) {
    invoiceLink = `<a class="btn" href="${invoicePdf}">Download PDF</a>`;
  } else {
    invoiceLink = "";
  }

  const html = baseTemplate(`
    <h1>Payment confirmed</h1>
    <p>Hi <span class="hl">${displayName}</span>, thank you — your payment has been received and your server subscription is active.</p>
    <dl class="info-box">
      <dt>Plan</dt><dd>${planName}</dd>
      <dt>Amount paid</dt><dd>${amountLabel}</dd>
      ${periodLabel ? `<dt>Billing period</dt><dd>${periodLabel}</dd>` : ""}
    </dl>
    ${invoiceLink}
    <p class="meta">
      If you have any questions about your invoice, contact us at
      <a href="{{supportUrl}}" style="color:#737373">{{supportUrl}}</a>.
    </p>
  `);

  let textInvoiceItem = "";
  if (invoiceUrl) {
    textInvoiceItem = `View invoice: ${invoiceUrl}`;
  } else if (invoicePdf) {
    textInvoiceItem = `Download PDF: ${invoicePdf}`;
  }

  const text = [
    `Payment confirmed — {{panelName}}`,
    ``,
    `Hi ${displayName}, your payment has been received.`,
    ``,
    `Plan: ${planName}`,
    `Amount paid: ${amountLabel}`,
    periodLabel ? `Billing period: ${periodLabel}` : "",
    ``,
    textInvoiceItem,
  ]
    .filter(Boolean)
    .join("\n");

  return sendMail({
    html,
    subject: `Payment confirmed — ${amountLabel} for ${planName}`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Invoice payment failed email
// ---------------------------------------------------------------------------

interface InvoiceFailedParams {
  toEmail: string;
  toName: string | null | undefined;
  amountDueCents: number;
  currency: string;
  invoiceUrl: string | null;
  gracePeriodEnd: Date;
}

export const sendInvoiceFailedEmail = (
  params: InvoiceFailedParams
): Promise<boolean> => {
  const {
    toEmail,
    toName,
    amountDueCents,
    currency,
    invoiceUrl,
    gracePeriodEnd,
  } = params;
  const displayName = toName ?? "there";

  const amountLabel = new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency",
  }).format(amountDueCents / 100);

  const deadlineLabel = gracePeriodEnd.toLocaleDateString("en-US", {
    dateStyle: "long",
  });

  const html = baseTemplate(`
    <h1 style="color:#dc2626">Payment failed</h1>
    <p>Hi <span class="hl">${displayName}</span>, we were unable to collect your latest payment.</p>
    <dl class="info-box">
      <dt>Amount due</dt><dd style="color:#f87171">${amountLabel}</dd>
      <dt>Suspension deadline</dt><dd>${deadlineLabel}</dd>
    </dl>
    ${invoiceUrl ? `<a class="btn" href="${invoiceUrl}">Pay now</a>` : ""}
    <p>
      Please update your payment method and settle the outstanding balance before <strong style="color:#e5e5e5">${deadlineLabel}</strong>,
      after which your server may be automatically suspended.
    </p>
    <p class="meta">
      Update your payment details in the billing portal or contact us at
      <a href="{{supportUrl}}" style="color:#737373">{{supportUrl}}</a>.
    </p>
  `);

  const text = [
    `Payment failed — {{panelName}}`,
    ``,
    `Hi ${displayName}, we were unable to collect your latest payment of ${amountLabel}.`,
    ``,
    `Please update your payment method before ${deadlineLabel} to avoid server suspension.`,
    ``,
    invoiceUrl ? `Pay now: ${invoiceUrl}` : "",
    ``,
    `Contact support: {{supportUrl}}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return sendMail({
    html,
    subject: `Action required: payment of ${amountLabel} failed`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Suspension warning / suspension notice email
// ---------------------------------------------------------------------------

interface SuspensionWarningParams {
  toEmail: string;
  toName: string | null | undefined;
  planName: string;
  invoiceUrl: string | null;
  gracePeriodEnd: Date;
  /** `true` = server has already been suspended; `false` = warning before suspension */
  suspended: boolean;
}

export const sendSuspensionWarningEmail = (
  params: SuspensionWarningParams
): Promise<boolean> => {
  const { toEmail, toName, planName, invoiceUrl, gracePeriodEnd, suspended } =
    params;
  const displayName = toName ?? "there";
  const deadlineLabel = gracePeriodEnd.toLocaleDateString("en-US", {
    dateStyle: "long",
  });

  const title = suspended
    ? "Your server has been suspended"
    : "Your server will be suspended soon";
  const colour = suspended ? "#dc2626" : "#d97706";

  const bodyText = suspended
    ? `Your server (<span class="hl">${planName}</span>) has been suspended due to a failed payment. It will be permanently deleted if the outstanding balance remains unpaid.`
    : `Your server (<span class="hl">${planName}</span>) is scheduled for suspension on <strong style="color:#e5e5e5">${deadlineLabel}</strong> due to an unpaid invoice. Please update your payment method immediately to avoid interruption.`;

  const html = baseTemplate(`
    <h1 style="color:${colour}">${title}</h1>
    <p>Hi <span class="hl">${displayName}</span>, ${bodyText}</p>
    ${invoiceUrl ? `<a class="btn" href="${invoiceUrl}">Pay now to restore</a>` : ""}
    <p class="meta">
      If you believe this is a mistake, contact us at
      <a href="{{supportUrl}}" style="color:#737373">{{supportUrl}}</a>.
    </p>
  `);

  const text = suspended
    ? [
        `Your {{panelName}} server has been suspended.`,
        ``,
        `Plan: ${planName}`,
        `Reason: Failed payment — grace period exceeded`,
        ``,
        invoiceUrl ? `Pay now to restore: ${invoiceUrl}` : "",
        `Contact support: {{supportUrl}}`,
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `Your {{panelName}} server will be suspended on ${deadlineLabel}.`,
        ``,
        `Plan: ${planName}`,
        `Reason: Unpaid invoice`,
        ``,
        invoiceUrl ? `Pay now: ${invoiceUrl}` : "",
        `Contact support: {{supportUrl}}`,
      ]
        .filter(Boolean)
        .join("\n");

  return sendMail({
    html,
    subject: suspended
      ? `Your server has been suspended — {{panelName}}`
      : `Action required: your server will be suspended on ${deadlineLabel}`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Server ready email
// ---------------------------------------------------------------------------

interface ServerReadyParams {
  toEmail: string;
  userName: string | null | undefined;
  serverName: string;
  game: string;
  region: string;
  serverUrl: string;
}

export const sendServerReadyEmail = (
  params: ServerReadyParams
): Promise<boolean> => {
  const { toEmail, userName, serverName, game, region, serverUrl } = params;
  const displayName = userName ?? "there";
  const gameLabel =
    game.charAt(0).toUpperCase() + game.slice(1).replaceAll("-", " ");

  const html = baseTemplate(`
    <h1>Your server is ready! 🎮</h1>
    <p>Hi <span class="hl">${displayName}</span>, your game server has finished provisioning and is ready to use.</p>
    <dl class="info-box">
      <dt>Server name</dt><dd>${serverName}</dd>
      <dt>Game</dt><dd>${gameLabel}</dd>
      <dt>Region</dt><dd>${region}</dd>
    </dl>
    <a class="btn" href="${serverUrl}">Go to server</a>
    <p class="meta">
      You'll find the connection details and server controls on your server page.
    </p>
  `);

  const text = [
    `Your {{panelName}} server "${serverName}" is ready!`,
    ``,
    `Game: ${gameLabel}`,
    `Region: ${region}`,
    ``,
    `Go to your server: ${serverUrl}`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Your server "${serverName}" is ready to play`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Server provision failed email
// ---------------------------------------------------------------------------

interface ServerProvisionFailedParams {
  toEmail: string;
  userName: string | null | undefined;
  serverName: string;
  reason: string;
  supportUrl: string;
}

export const sendServerProvisionFailedEmail = (
  params: ServerProvisionFailedParams
): Promise<boolean> => {
  const { toEmail, userName, serverName, reason, supportUrl } = params;
  const displayName = userName ?? "there";

  const html = baseTemplate(`
    <h1 style="color:#dc2626">Server provisioning failed</h1>
    <p>Hi <span class="hl">${displayName}</span>, we were unable to provision your server <span class="hl">${serverName}</span>.</p>
    <dl class="info-box">
      <dt>Reason</dt><dd style="color:#f87171">${reason}</dd>
    </dl>
    <p>Our team has been notified. Please contact support and we'll get this resolved for you.</p>
    <a class="btn" href="${supportUrl}">Contact support</a>
    <p class="meta">
      Your subscription will not be charged for a server that failed to provision.
    </p>
  `);

  const text = [
    `Server provisioning failed — {{panelName}}`,
    ``,
    `Hi ${displayName}, we were unable to provision "${serverName}".`,
    ``,
    `Reason: ${reason}`,
    ``,
    `Please contact support: ${supportUrl}`,
    `Your subscription will not be charged for a server that failed to provision.`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Server "${serverName}" failed to provision`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Server provision initiated email (admin creates server, user approves)
// ---------------------------------------------------------------------------

interface ServerProvisionInitiatedParams {
  toEmail: string;
  userName: string;
  serverName: string;
  serverType: string;
  location: string;
  game: string;
  approveUrl: string;
}

export const sendServerProvisionInitiatedEmail = (
  params: ServerProvisionInitiatedParams
): Promise<boolean> => {
  const {
    toEmail,
    userName,
    serverName,
    serverType,
    location,
    game,
    approveUrl,
  } = params;
  const displayName = userName ?? "there";
  const gameLabel =
    game.charAt(0).toUpperCase() + game.slice(1).replaceAll("-", " ");

  const html = baseTemplate(`
    <h1>Admin created a server for you</h1>
    <p>Hi <span class="hl">${displayName}</span>, an admin has created a new game server for your account. Review the settings and approve to start provisioning.</p>
    <dl class="info-box">
      <dt>Server name</dt><dd>${serverName}</dd>
      <dt>Game</dt><dd>${gameLabel}</dd>
      <dt>Server type</dt><dd>${serverType}</dd>
      <dt>Region</dt><dd>${location}</dd>
    </dl>
    <a class="btn" href="${approveUrl}">Review and approve</a>
    <p class="meta">
      You can adjust any settings after reviewing. Once approved, provisioning will begin and the server will be ready in about 60 seconds.
    </p>
  `);

  const text = [
    `Admin created a server for you — {{panelName}}`,
    ``,
    `Hi ${displayName}, an admin has set up a new game server on your account.`,
    ``,
    `Server name: ${serverName}`,
    `Game: ${gameLabel}`,
    `Server type: ${serverType}`,
    `Region: ${location}`,
    ``,
    `Review and approve: ${approveUrl}`,
    ``,
    `Once approved, provisioning will begin and your server will be ready in about 60 seconds.`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Admin created server "${serverName}" for you`,
    text,
    to: toEmail,
  });
};

// ---------------------------------------------------------------------------
// Server member added (direct-add, no invite link)
// ---------------------------------------------------------------------------

interface ServerMemberAddedParams {
  toEmail: string;
  serverName: string;
  addedByName: string;
  role: string;
  serverUrl: string;
}

export const sendServerMemberAddedEmail = (
  params: ServerMemberAddedParams
): Promise<boolean> => {
  const { toEmail, serverName, addedByName, role, serverUrl } = params;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const html = baseTemplate(`
    <h1>You've been added to a server</h1>
    <p>
      <span class="hl">${addedByName}</span> has added you to the server
      <span class="hl">${serverName}</span> on {{panelName}}.
    </p>
    <p>You have been granted the <span class="badge">${roleLabel}</span> role.</p>
    <a class="btn" href="${serverUrl}">View server</a>
    <p class="meta">
      You can manage your server access from within the panel.
      If you believe this was a mistake, contact the server owner.
    </p>
  `);

  const text = [
    `You've been added to ${serverName} on {{panelName}} by ${addedByName}.`,
    ``,
    `Role: ${roleLabel}`,
    ``,
    `View the server: ${serverUrl}`,
  ].join("\n");

  return sendMail({
    html,
    subject: `You've been added to ${serverName} on {{panelName}}`,
    text,
    to: toEmail,
  });
};
