function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function ticketCreatedTemplate(p: {
  ticketNumber: string;
  title: string;
  priority: string;
  category: string;
  recipientName: string;
}): { subject: string; html: string } {
  return {
    subject: `[${p.ticketNumber}] New ticket created: ${p.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">New ticket created</h2>
        <p>Hi ${esc(p.recipientName)},</p>
        <p>Your ticket has been received and is being processed.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:140px">Ticket</td><td style="padding:8px">${esc(p.ticketNumber)}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Title</td><td style="padding:8px">${esc(p.title)}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Priority</td><td style="padding:8px">${esc(p.priority)}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Category</td><td style="padding:8px">${esc(p.category)}</td></tr>
        </table>
        <p style="color:#666;font-size:12px">You will receive updates as the status changes.</p>
      </div>
    `,
  };
}
