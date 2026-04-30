function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function mentionTemplate(p: {
  ticketNumber: string;
  ticketTitle: string;
  commentBody: string;
  authorName: string;
  recipientName: string;
}): { subject: string; html: string } {
  return {
    subject: `[${p.ticketNumber}] You were mentioned by ${p.authorName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">You were mentioned in a comment</h2>
        <p>Hi ${esc(p.recipientName)},</p>
        <p><strong>${esc(p.authorName)}</strong> mentioned you in a comment on ticket <strong>${esc(p.ticketNumber)}</strong>.</p>
        <div style="background:#f9f9f9;border-left:4px solid #4f46e5;padding:12px 16px;margin:16px 0;border-radius:4px">
          <p style="margin:0;white-space:pre-wrap">${esc(p.commentBody)}</p>
        </div>
        <p style="color:#666;font-size:12px">Ticket: ${esc(p.ticketTitle)}</p>
      </div>
    `,
  };
}
