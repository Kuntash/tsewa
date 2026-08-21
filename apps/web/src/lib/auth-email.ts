type PasswordResetEmailInput = {
  email: string;
  name: string;
  url: string;
};

export async function sendPasswordResetEmail(
  runtime: Env,
  input: PasswordResetEmailInput,
): Promise<void> {
  const copy = buildPasswordResetEmail(input);
  await runtime.EMAIL.send({
    to: input.email,
    from: { name: runtime.APP_NAME, email: runtime.TRANSACTIONAL_FROM_EMAIL },
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
  });
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput) {
  const subject = "Reset your Tsewa password";
  const name = escapeHtml(input.name || "there");
  const url = escapeHtml(input.url);
  const explanation =
    "Use this private link to choose a new password. Resetting it signs out your other sessions.";
  const safety =
    "If you did not request a password reset, your current password still works and you can ignore this email.";
  const text = `Hello ${input.name || "there"},\n\n${explanation}\n\nReset password: ${input.url}\n\n${safety}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1e9;color:#243229;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fffdf8;border:1px solid #ddd7ca;border-radius:24px"><tr><td style="padding:38px 32px"><p style="margin:0 0 22px;color:#47705a;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Tsewa · School &amp; care operations</p><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:34px;font-weight:500;line-height:1.15">Choose a new password</h1><p style="margin:0 0 14px;font-size:17px;line-height:1.6">Hello ${name},</p><p style="margin:0 0 28px;color:#56635c;font-size:15px;line-height:1.65">${explanation}</p><a href="${url}" style="display:inline-block;background:#315f48;border-radius:12px;color:#fffdf8;font-size:15px;font-weight:700;padding:14px 22px;text-decoration:none">Reset password</a><p style="margin:28px 0 0;color:#6d746f;font-size:13px;line-height:1.6">${safety}</p></td></tr></table></td></tr></table></body></html>`;
  return { html, subject, text };
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
