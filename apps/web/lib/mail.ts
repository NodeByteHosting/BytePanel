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
  template.replaceAll(/\{\{(?<key>\w+)\}\}/gu, (match, key: string) =>
    Object.hasOwn(values, key) ? (values[key] as string) : match
  );

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

interface ServerInviteParams {
  toEmail: string;
  serverName: string;
  invitedByName: string;
  role: string;
  acceptUrl: string;
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
  <title>Server Invite - {{panelName}}</title>
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
    <p>All associated resources will be removed shortly.</p>
    <p class="meta">
      If this was a mistake or you have any questions, contact us at
      <a href="{{supportUrl}}" style="color:#737373">{{supportUrl}}</a> as soon as possible.
    </p>
  `);

  const text = [
    `Your {{panelName}} server "${serverName}" has been queued for deletion.`,
    ``,
    `All resources will be removed.`,
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
  `);

  const text = [
    `Server provisioning failed - {{panelName}}`,
    ``,
    `Hi ${displayName}, we were unable to provision "${serverName}".`,
    ``,
    `Reason: ${reason}`,
    ``,
    `Please contact support: ${supportUrl}`,
  ].join("\n");

  return sendMail({
    html,
    subject: `Server "${serverName}" failed to provision`,
    text,
    to: toEmail,
  });
};

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
