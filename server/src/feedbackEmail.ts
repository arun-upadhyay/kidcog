import { Resend } from 'resend';

export type FeedbackEmailInput = {
  id: string;
  category: 'idea' | 'problem' | 'praise' | 'other';
  rating: number | null;
  message: string;
  allowContact: boolean;
  accountEmail: string | null;
  platform: string;
  appVersion: string;
  screen: string;
};

const CATEGORY_LABELS: Record<FeedbackEmailInput['category'], string> = {
  idea: 'Idea', problem: 'Problem', praise: 'Something they like', other: 'Other',
};
const DEFAULT_RECIPIENTS = ['info@ritvikglobal.com', 'arun.upadhyay1107@gmail.com'];

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function recipients(): string[] {
  const configured = (process.env.FEEDBACK_TO_EMAILS ?? process.env.FEEDBACK_TO_EMAIL ?? '')
    .split(',').map(value => value.trim()).filter(Boolean);
  return configured.length ? [...new Set(configured)] : DEFAULT_RECIPIENTS;
}

let warnedMissingKey = false;

/**
 * Email the KidCog owners after feedback has been saved. Email is a
 * notification channel, not the system of record: a temporary Resend problem
 * must never discard the parent's message from product_feedback.
 */
export async function sendFeedbackEmail(input: FeedbackEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn('  ⚠ Feedback email is off. Add RESEND_API_KEY to the server environment.');
      warnedMissingKey = true;
    }
    return false;
  }

  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() || 'KidCog Feedback <onboarding@resend.dev>';
  const category = CATEGORY_LABELS[input.category];
  const rating = input.rating ? `${input.rating}/5` : 'Not provided';
  const replyTo = input.allowContact && input.accountEmail ? input.accountEmail : undefined;
  const contact = replyTo ? `Allowed — ${replyTo}` : 'Not allowed';
  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from,
    to: recipients(),
    ...(replyTo ? { replyTo } : {}),
    subject: `[KidCog feedback] ${category}${input.rating ? ` · ${rating}` : ''}`,
    text: `Category: ${category}\nRating: ${rating}\nContact permitted: ${contact}\nPlatform: ${input.platform}\nApp version: ${input.appVersion}\nScreen: ${input.screen}\nFeedback ID: ${input.id}\n\nMessage:\n${input.message}`,
    html: `
      <div style="background:#fff9f0;padding:28px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#2a2118">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #eadfd0;border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(74,55,40,.08)">
          <div style="padding:22px 24px;background:linear-gradient(135deg,#7650c7,#60439b);color:#fff">
            <div style="font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase">🦉 KidCog</div>
            <div style="font-size:24px;font-weight:900;margin-top:5px">New ${escapeHtml(category.toLowerCase())}</div>
          </div>
          <div style="padding:24px">
            <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 8px;font-size:14px">
              <tr><td style="color:#6b6259;width:145px">Experience</td><td style="font-weight:800">${escapeHtml(rating)}</td></tr>
              <tr><td style="color:#6b6259">Contact permitted</td><td style="font-weight:700">${escapeHtml(contact)}</td></tr>
              <tr><td style="color:#6b6259">Context</td><td>${escapeHtml(input.platform)} · v${escapeHtml(input.appVersion)} · ${escapeHtml(input.screen)}</td></tr>
            </table>
            <div style="margin-top:18px;padding:18px;border-radius:16px;background:#f5f0ff;border:1px solid #d9cdf5;white-space:pre-wrap;font-size:16px;line-height:1.6">${escapeHtml(input.message)}</div>
            ${replyTo ? `<a href="mailto:${escapeHtml(replyTo)}" style="display:inline-block;margin-top:18px;padding:11px 16px;border-radius:12px;background:#e8724f;color:#fff;text-decoration:none;font-weight:800">Reply to parent</a>` : ''}
          </div>
          <div style="padding:14px 24px;background:#fff9f0;border-top:1px solid #eadfd0;color:#6b6259;font-size:12px">Feedback ID: ${escapeHtml(input.id)}</div>
        </div>
      </div>`,
  });

  if (result.error) throw new Error(`Resend: ${result.error.message}`);
  return true;
}
