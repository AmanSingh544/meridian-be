function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  PENDING: 'Pending',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  ESCALATED: 'Escalated',
};

export function ticketStatusChangedTemplate(p: {
  ticketNumber: string;
  title: string;
  previousStatus: string;
  newStatus: string;
  recipientName: string;
}): { subject: string; html: string } {
  const prev = STATUS_LABELS[p.previousStatus] ?? p.previousStatus;
  const next = STATUS_LABELS[p.newStatus] ?? p.newStatus;
  return {
    subject: `[${p.ticketNumber}] Status updated: ${prev} → ${next}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">Ticket status updated</h2>
        <p>Hi ${esc(p.recipientName)},</p>
        <p>The status of your ticket has been updated.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:140px">Ticket</td><td style="padding:8px">${esc(p.ticketNumber)}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Title</td><td style="padding:8px">${esc(p.title)}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Previous status</td><td style="padding:8px">${esc(prev)}</td></tr>
          <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">New status</td><td style="padding:8px"><strong>${esc(next)}</strong></td></tr>
        </table>
      </div>
    `,
  };
}
