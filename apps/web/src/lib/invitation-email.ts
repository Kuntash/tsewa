import { groupDescription, groupLabel } from "@/lib/access-control";
import type { AccessGroupKey } from "@/lib/access-control";

type InvitationEmailInput = {
  organizationName: string;
  expiresAt: string;
  invitationUrl: string;
  inviterEmail: string;
  inviterName: string;
  recipient: string;
  group: Exclude<AccessGroupKey, "owner">;
  locale: string;
  timezone: string;
};

export async function sendInvitationEmail(
  runtime: Env,
  input: InvitationEmailInput,
): Promise<string> {
  const copy = buildInvitationEmail(input);
  const result = await runtime.EMAIL.send({
    to: input.recipient,
    from: { name: runtime.APP_NAME, email: runtime.TRANSACTIONAL_FROM_EMAIL },
    replyTo: input.inviterEmail,
    subject: `${input.inviterName} invited you to ${input.organizationName}`,
    html: copy.html,
    text: copy.text,
  });
  return result.messageId;
}

export function buildInvitationEmail(input: InvitationEmailInput) {
  const organizationName = escapeHtml(input.organizationName);
  const inviterName = escapeHtml(input.inviterName);
  const invitationUrl = escapeHtml(input.invitationUrl);
  const group = escapeHtml(groupLabel(input.group));
  const accessDescription = groupDescription(input.group);
  const escapedAccessDescription = escapeHtml(accessDescription);
  const expiry = new Intl.DateTimeFormat(input.locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(new Date(input.expiresAt));

  const text = `${input.inviterName} invited you to ${input.organizationName}\n\nRole: ${groupLabel(input.group)}\n${accessDescription}\n\nAccept your invitation: ${input.invitationUrl}\n\nThis private link expires ${expiry} and is intended only for ${input.recipient}. If you were not expecting it, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1e9;color:#243229;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fffdf8;border:1px solid #ddd7ca;border-radius:24px"><tr><td style="padding:38px 32px"><p style="margin:0 0 22px;color:#47705a;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Tsewa · School & care operations</p><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:34px;font-weight:500;line-height:1.15">Join ${organizationName}</h1><p style="margin:0 0 22px;font-size:17px;line-height:1.6"><strong>${inviterName}</strong> invited you to work in Tsewa.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;background:#f4f1e9;border-radius:14px"><tr><td style="padding:16px 18px"><p style="margin:0 0 6px;color:#68736d;font-size:12px;font-weight:700;text-transform:uppercase">Role</p><p style="margin:0 0 8px;font-size:15px;font-weight:700">${group}</p><p style="margin:0;font-size:14px;line-height:1.55">${escapedAccessDescription}</p></td></tr></table><a href="${invitationUrl}" style="display:inline-block;background:#315f48;border-radius:12px;color:#fffdf8;font-size:15px;font-weight:700;padding:14px 22px;text-decoration:none">Review invitation</a><p style="margin:28px 0 0;color:#6d746f;font-size:13px;line-height:1.6">This private link expires ${expiry} and is intended only for ${escapeHtml(input.recipient)}. If you weren’t expecting it, you can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
  return { html, text };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}
