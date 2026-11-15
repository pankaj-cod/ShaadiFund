/** Email bodies. Plain, warm, and readable without images. */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#fbf8f2;font-family:Helvetica,Arial,sans-serif;color:#2b2926">
<div style="max-width:480px;margin:0 auto;padding:40px 24px">
<p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px;color:#7d5f24;margin:0 0 24px">VowFund</p>
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;margin:0 0 16px">${escapeHtml(heading)}</h1>
${bodyHtml}
</div></body></html>`;
}

export function magicLinkEmail(url: string): { subject: string; text: string; html: string } {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Your sign-in link for VowFund",
    text: `Sign in to VowFund with this link. It works once and expires in 15 minutes.\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
    html: layout(
      "Sign in to VowFund",
      `<p style="line-height:1.6;margin:0 0 24px">This link signs you in. It works once and expires in 15 minutes.</p>
<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#2b2926;color:#fbf8f2;text-decoration:none;padding:14px 24px;border-radius:10px">Sign in</a></p>
<p style="line-height:1.6;font-size:13px;color:#6a6359;margin:0">If you did not ask for this, you can ignore this email.</p>`,
    ),
  };
}

export interface GiftEmailData {
  coupleNames: string;
  dreamTitle: string;
  guestName: string;
  amount: string;
  fee: string;
  total: string;
  message: string | null;
  url: string;
  demo: boolean;
}

const DEMO_TEXT = "DEMO MODE: this was a test. No real money moved.";

function demoHtml(demo: boolean): string {
  return demo
    ? `<p style="background:#f1eadc;border-radius:8px;padding:12px 16px;font-size:13px;margin:0 0 24px"><strong>Demo mode.</strong> This was a test. No real money moved.</p>`
    : "";
}

/** To the guest: confirmation of their gift, with a link to their acknowledgment page. */
export function giftReceiptEmail(data: GiftEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [
    `Thank you, ${data.guestName}.`,
    `Your gift towards "${data.dreamTitle}" for ${data.coupleNames} is confirmed.`,
    "",
    `Gift: ${data.amount}`,
    `Platform fee: ${data.fee}`,
    `Total paid: ${data.total}`,
    "",
    `Your acknowledgment: ${data.url}`,
  ];
  if (data.demo) lines.unshift(DEMO_TEXT, "");
  return {
    subject: `Your gift to ${data.coupleNames} is confirmed`,
    text: lines.join("\n"),
    html: layout(
      `Thank you, ${data.guestName}`,
      `${demoHtml(data.demo)}<p style="line-height:1.6;margin:0 0 20px">Your gift towards <strong>${escapeHtml(data.dreamTitle)}</strong> for ${escapeHtml(data.coupleNames)} is confirmed.</p>
<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px">
<tr><td style="padding:6px 0;color:#6a6359">Gift</td><td style="padding:6px 0;text-align:right">${escapeHtml(data.amount)}</td></tr>
<tr><td style="padding:6px 0;color:#6a6359">Platform fee</td><td style="padding:6px 0;text-align:right">${escapeHtml(data.fee)}</td></tr>
<tr><td style="padding:10px 0 0;border-top:1px solid #e6decf"><strong>Total paid</strong></td><td style="padding:10px 0 0;border-top:1px solid #e6decf;text-align:right"><strong>${escapeHtml(data.total)}</strong></td></tr>
</table>
<p style="margin:0"><a href="${escapeHtml(data.url)}" style="display:inline-block;background:#2b2926;color:#fbf8f2;text-decoration:none;padding:14px 24px;border-radius:10px">View your acknowledgment</a></p>`,
    ),
  };
}

/** To the couple: someone has contributed. */
export function giftReceivedEmail(data: GiftEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [
    `${data.guestName} contributed ${data.amount} towards "${data.dreamTitle}".`,
    data.message ? `\nTheir message:\n${data.message}` : "",
    `\nSee it on your dashboard: ${data.url}`,
  ];
  if (data.demo) lines.unshift(DEMO_TEXT, "");
  return {
    subject: `${data.guestName} contributed to ${data.dreamTitle}`,
    text: lines.join("\n"),
    html: layout(
      "A new gift has arrived",
      `${demoHtml(data.demo)}<p style="line-height:1.6;margin:0 0 20px"><strong>${escapeHtml(data.guestName)}</strong> contributed <strong>${escapeHtml(data.amount)}</strong> towards <strong>${escapeHtml(data.dreamTitle)}</strong>.</p>
${data.message ? `<blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #b3924f;font-family:Georgia,serif;font-style:italic;line-height:1.6;white-space:pre-line">${escapeHtml(data.message)}</blockquote>` : ""}
<p style="margin:0"><a href="${escapeHtml(data.url)}" style="display:inline-block;background:#2b2926;color:#fbf8f2;text-decoration:none;padding:14px 24px;border-radius:10px">Open your dashboard</a></p>`,
    ),
  };
}
