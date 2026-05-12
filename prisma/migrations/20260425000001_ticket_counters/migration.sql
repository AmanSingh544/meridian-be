-- Atomic per-tenant ticket number counter
-- One row per tenant; incremented with a single upsert, no read-modify-write race.
CREATE TABLE ticket_counters (
  tenant_id   UUID    PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Back-fill existing tenants from real ticket data so the counter starts
-- at the current max, not at zero (which would collide with existing tickets).
INSERT INTO ticket_counters (tenant_id, last_number)
SELECT
  t.tenant_id,
  COALESCE(MAX(CAST(SUBSTRING(t.ticket_number FROM 5) AS INTEGER)), 0)
FROM tickets t
WHERE t.ticket_number ~ '^TKT-[0-9]+$'
GROUP BY t.tenant_id
ON CONFLICT (tenant_id) DO UPDATE
  SET last_number = EXCLUDED.last_number;
