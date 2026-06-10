// Renders a recruiter email signature as HTML from profile fields.
// If `customHtml` is provided (non-empty), it is used verbatim and structured fields are ignored.

export interface SignatureFields {
  name?: string | null;
  title?: string | null;
  agency?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  linkedin?: string | null;
  customHtml?: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ensureUrl = (u: string) =>
  /^https?:\/\//i.test(u) ? u : `https://${u}`;

export function buildSignatureHtml(fields: SignatureFields): string {
  const custom = (fields.customHtml || '').trim();
  if (custom) {
    // If it looks like plain text, convert line breaks to <br>
    if (!/<[a-z][\s\S]*>/i.test(custom)) {
      return `<div style="font-family:Arial,sans-serif;font-size:13px;color:#374151;line-height:1.5;">${custom
        .split('\n')
        .map((l) => esc(l))
        .join('<br/>')}</div>`;
    }
    return custom;
  }

  const name = (fields.name || '').trim();
  const title = (fields.title || '').trim();
  const agency = (fields.agency || '').trim();
  const phone = (fields.phone || '').trim();
  const email = (fields.email || '').trim();
  const website = (fields.website || '').trim();
  const linkedin = (fields.linkedin || '').trim();

  if (!name && !title && !agency && !phone && !email && !website && !linkedin) {
    return '';
  }

  const lines: string[] = [];
  if (name) lines.push(`<div style="font-weight:600;color:#111827;font-size:14px;">${esc(name)}</div>`);
  if (title || agency) {
    const t = [title, agency].filter(Boolean).map(esc).join(' &middot; ');
    lines.push(`<div style="color:#374151;font-size:13px;">${t}</div>`);
  }
  const contactBits: string[] = [];
  if (phone) contactBits.push(`<a href="tel:${esc(phone.replace(/\s+/g, ''))}" style="color:#374151;text-decoration:none;">${esc(phone)}</a>`);
  if (email) contactBits.push(`<a href="mailto:${esc(email)}" style="color:#374151;text-decoration:none;">${esc(email)}</a>`);
  if (contactBits.length)
    lines.push(`<div style="color:#374151;font-size:13px;">${contactBits.join(' &nbsp;|&nbsp; ')}</div>`);

  const linkBits: string[] = [];
  if (website) linkBits.push(`<a href="${esc(ensureUrl(website))}" style="color:#2563eb;text-decoration:none;">${esc(website)}</a>`);
  if (linkedin) linkBits.push(`<a href="${esc(ensureUrl(linkedin))}" style="color:#2563eb;text-decoration:none;">LinkedIn</a>`);
  if (linkBits.length)
    lines.push(`<div style="font-size:13px;">${linkBits.join(' &nbsp;|&nbsp; ')}</div>`);

  return `<div style="font-family:Arial,sans-serif;line-height:1.5;margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">${lines.join('')}</div>`;
}

export function appendSignatureToHtml(bodyHtml: string, fields: SignatureFields): string {
  const sig = buildSignatureHtml(fields);
  if (!sig) return bodyHtml;
  return `${bodyHtml}\n${sig}`;
}
