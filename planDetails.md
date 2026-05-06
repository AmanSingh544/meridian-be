# Plan: User Creation, Tenant/Project Assignment — Full Architecture Fix

## Context

The current user creation system has several critical gaps:
1. No tenant selector in the invite UI — internal admin can't pick which client tenant to add a user to
2. No project-level user assignment (no `UserProject` junction table exists)
3. Internal staff are all silently added to the 3SC internal tenant with no UI clarity
4. `email` is globally unique in DB schema but the service checks per-tenant — a silent mismatch
5. `internalSubRole`, `department`, `jobTitle`, `phone`, `timezone` are stored as JSON in `preferences`, not real DB columns
6. Super Admin cross-tenant query is an ad-hoc `if (actorRole === 'ADMIN')` bypass scattered across every service
7. The invite payload from frontend doesn't send `tenant_id` — it's a query param only on backend, body never carries it
8. `skillIds` exists in `InviteUserPayload` type but is never wired into any UI form or backend logic
9. No project assignment UI exists anywhere

## Constraints

- **Email sending is not active** (domain not purchased yet). Do NOT remove or comment out any email-sending code. User is created and shown in the UI; they can change their password or update details later via the UI.
- **DB can be reset and reseeded** if needed. The new seed must include: multiple tenants, multiple projects per tenant, tickets per project, and all the existing entity variety currently in the seed.

---

## Architecture Decisions

### A. Email Uniqueness — Fix Schema to Per-Tenant (with pre-migration audit)
Change `email @unique` → `@@unique([tenant_id, email])` on the `User` model.
Also add an **explicit index** on `(tenant_id, email)` since the main user lookup path uses both columns.

**Pre-migration requirement:** Audit existing data for cross-tenant email duplicates:
```sql
SELECT email, COUNT(DISTINCT tenant_id) AS tenant_count
FROM users GROUP BY email HAVING COUNT(DISTINCT tenant_id) > 1;
```
If rows returned → resolve conflicts before migration. In dev, DB can be reset and reseeded cleanly.

### B. Auth/Tenant-Scope Policy — Centralise FIRST (build before any service code)
Replace every `if (actorRole === 'ADMIN')` bypass with a single shared helper. This is **built first** so no new code re-introduces the old pattern.

```typescript
// backend/src/shared/utils/tenant-scope.ts

import { BadRequestException } from '@nestjs/common';

export interface TenantContext {
  tenantId: string | undefined;
  role: string;
}

/**
 * Returns a Prisma `where` fragment for tenant scoping.
 * If tenantId is present it always wins — even for ADMIN.
 * If absent AND actor is ADMIN → global (no filter).
 * If absent AND actor is not ADMIN → throws 400.
 *
 * The return type is intentionally open (`Record<string, any>`) so call
 * sites can spread it into larger Prisma `where` objects without boxing in.
 */
export function buildTenantWhere(ctx: TenantContext): Record<string, any> {
  if (ctx.tenantId) return { tenant_id: ctx.tenantId };
  if (ctx.role === 'ADMIN') return {};
  throw new BadRequestException('tenant_id is required');
}

export function canAccessAllTenants(role: string): boolean {
  return role === 'ADMIN';
}
```

Rules enforced by this helper:
- ADMIN + `tenant_id` present → scoped to that tenant
- ADMIN + no `tenant_id` → global query across all tenants
- Non-ADMIN + no `tenant_id` → 400, never a silent empty list

### C. Project-Level User Assignment — `UserProject` Junction Table
```prisma
enum ProjectRole {
  VIEWER
  MEMBER
  LEAD
}

model UserProject {
  id         String      @id @default(uuid()) @db.Uuid
  user_id    String      @db.Uuid
  project_id String      @db.Uuid
  role       ProjectRole @default(MEMBER)
  created_at DateTime    @default(now()) @db.Timestamptz(6)

  user    User    @relation(fields: [user_id], references: [id], onDelete: Cascade)
  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@unique([user_id, project_id])
  @@map("user_projects")
}
```
Add `user_projects UserProject[]` on both `User` and `Project` models.

**Validation rule (both invite AND edit flows):** When `project_ids` are supplied, every project's `tenant_id` must equal the user's `tenant_id`. Reject with 400 if any mismatch. This guard lives in the service layer, not just the UI.

### D. Promote Profile Columns — Backfill Before Migration
Add real columns to `users`:
```prisma
internal_sub_role  String?
department         String?
job_title          String?
phone              String?
timezone           String?
```

**Backfill script** runs as part of the migration (or a separate seed step) to copy existing values out of `preferences` JSON into the new columns for any users who already have them. The `preferences` JSON column stays for future flexible metadata only. After backfill, the service no longer reads these from `preferences`.

### E. Invite Endpoint — `tenant_id` into Request Body, Remove Query Param
`POST /users/invite` body (snake_case wire format end-to-end):
```typescript
{
  email: string;             // required
  role: UserRole;            // required
  tenant_id: string;         // required, in body NOT query param
  first_name?: string;
  last_name?: string;
  internal_sub_role?: string; // DEVELOPER|DELIVERY|SUPPORT|TEAM_LEAD|ADMIN — internal roles only; DTO validator enforces this
  department?: string;
  project_ids?: string[];    // validated: all must belong to tenant_id (both invite and edit)
  skill_ids?: string[];      // internal staff only; DTO validator enforces this
}
```
Remove `@ApiQuery({ name: 'tenant_id' })` from controller. The frontend API slice sends `tenant_id` in the body. No query-param version remains.

**DTO-level guards (backend):**
- `internal_sub_role` and `skill_ids` are only accepted when `role` is ADMIN, LEAD, or AGENT — rejected with 400 otherwise
- `project_ids` validates each project belongs to `tenant_id`

**Naming convention:** snake_case throughout on the wire. Frontend types use snake_case keys matching the backend DTO exactly — no camelCase/snake_case mixing in payloads.

### F. Separate Internal vs Client Invite Branches
Two distinct form branches in the UI with separate validation:

**Internal Staff:**
- Tenant: always "3SC Internal" → read-only label, not a dropdown
- Role: ADMIN / LEAD / AGENT (required)
- Sub-Role: DEVELOPER / DELIVERY / SUPPORT / TEAM_LEAD / ADMIN (required)
- Department: text (optional)
- Projects: multi-select across all projects (optional)
- Skills: multi-select (optional)

**Client User:**
- Tenant: dropdown from `GET /organizations` → **required**, nothing else enables until selected
- Role: CLIENT_ADMIN / CLIENT_USER (required)
- Projects: multi-select, **loads from** `GET /projects?tenant_id={chosen}` — only after tenant chosen (optional)
- No sub-role, no skills

### G. Email Not Sent — No Code Removed
Email-sending code in `auth.service.ts` and `users.service.ts` stays intact. When a user is invited, they appear in the UI with a temporary password. They (or an admin) can update credentials later. Email will activate once the domain is purchased.

### H. Project Member Management — Post-Invite via Detail Page
New endpoints on `projects` module:
- `GET /projects/:id/members` — list users assigned to the project
- `POST /projects/:id/members` — assign a user
- `DELETE /projects/:id/members/:userId` — remove a user

These allow project membership to be managed after invite, not only at invite time.

### I. Customer Portal Project Scope
In the customer portal invite, the project selector is scoped to the tenant derived from the JWT (`session.tenantId`), not from a convention. The API call is `GET /projects?tenant_id={session.tenantId}` — no hardcoding.

---

## Seed Data Requirements (for DB reset)

The new seed must include:
- 3SC Internal tenant (ORG-001) with all current internal staff users (ADMIN/LEAD/AGENT)
- At least 3 client tenants (Acme Corp, TechWave, Global Finance)
- Multiple projects per client tenant (at least 2 per tenant)
- Tickets per project (mix of open, in-progress, resolved)
- `user_projects` rows wiring internal staff to some projects
- `user_projects` rows wiring client admins to their tenant's projects
- All existing entities: skills, KB articles, SLA policies, etc.

---

## Files to Change

### Phase 0 — Auth/Tenant-Scope Policy
| File | Change |
|------|--------|
| `backend/src/shared/utils/tenant-scope.ts` | **NEW** — `buildTenantWhere()` and `canAccessAllTenants()` |

### Phase 1 — Database Migration
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Remove `email @unique`; add `@@unique([tenant_id, email])`; add new `User` columns; add `ProjectRole` enum; add `UserProject` model; add relations |
| `backend/prisma/migrations/` | New migration via `prisma migrate dev --name add_user_project_and_user_columns` |
| `backend/prisma/seed.ts` | Update to use new columns; add `user_projects` seed rows; ensure multi-tenant, multi-project, multi-ticket coverage |

### Phase 2 — Backend DTO
| File | Change |
|------|--------|
| `backend/src/modules/users/dto/create-user.dto.ts` | Add `tenant_id`, `project_ids?`, `skill_ids?`, `internal_sub_role?`, `department?`; add role-based DTO validators |

### Phase 3 — Backend Services & Controllers
| File | Change |
|------|--------|
| `backend/src/modules/users/users.service.ts` | `invite()`: body-sourced `tenant_id`; validate `project_ids` vs tenant; create `UserProject`+`UserSkill` records; write new columns; leave email-send code intact. `update()`: new columns not preferences. `buildUserShape()`: include projects. Replace all ADMIN bypasses with `buildTenantWhere()` |
| `backend/src/modules/users/users.controller.ts` | Remove `@ApiQuery tenant_id` from invite; accept from `@Body()` |
| `backend/src/modules/projects/projects.service.ts` | Add `getMembers`, `addMember`, `removeMember`; use `buildTenantWhere()` |
| `backend/src/modules/projects/projects.controller.ts` | Add `GET /projects/:id/members`, `POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` |

### Phase 4 — Frontend Types & API Slice
| File | Change |
|------|--------|
| `frontend/packages/types/src/index.ts` | Update `InviteUserPayload` to snake_case, add `tenant_id`; add `UserProject` interface; add `ProjectRole` enum |
| `frontend/packages/api/src/index.ts` | Update `inviteUser` mutation body; add `getProjectMembers`, `addProjectMember`, `removeProjectMember` |

### Phase 5 — Frontend UI
| File | Change |
|------|--------|
| `frontend/apps/internal-console/src/pages/UsersPage.tsx` | Split `InviteModal` into `InternalInviteForm` + `ClientInviteForm`; add tenant selector (client); cascade project selector; add skills (internal) |
| `frontend/apps/customer-portal/src/pages/TeamManagementPage.tsx` | Add optional project selector scoped to `session.tenantId`; no tenant selector |

---

## UI Design

### Internal Staff Form
```
┌────────────────────────────────────────────┐
│ Add Staff Member                            │
│                                            │
│ First Name*         Last Name*             │
│ [____________]      [____________]         │
│                                            │
│ Email*                                     │
│ [__________________________________]       │
│                                            │
│ Role*               Sub-Role*              │
│ [Agent ▼]           [Support ▼]            │
│                                            │
│ Department                                 │
│ [__________________________________]       │
│                                            │
│ Tenant                                     │
│  3SC Internal  (read-only)                 │
│                                            │
│ Assign to Projects  (optional)             │
│ [Select projects… ▼]  (multi-select)       │
│                                            │
│ Assign Skills  (optional)                  │
│ [Select skills… ▼]  (multi-select)         │
│                                            │
│                  [Cancel]  [Send Invite]   │
└────────────────────────────────────────────┘
```

### Client User Form
```
┌────────────────────────────────────────────┐
│ Add Client User                             │
│                                            │
│ First Name*         Last Name*             │
│ [____________]      [____________]         │
│                                            │
│ Email*                                     │
│ [__________________________________]       │
│                                            │
│ Role*                                      │
│ [Client User ▼]                            │
│                                            │
│ Client / Tenant*  ← required first         │
│ [Select organisation ▼]                    │
│                                            │
│ Assign to Projects  (optional)             │
│ [Select projects… ▼] ← loads after tenant  │
│                                            │
│                  [Cancel]  [Send Invite]   │
└────────────────────────────────────────────┘
```

---

## Wire Format Summary

### POST /users/invite body
```json
{
  "email": "user@example.com",
  "role": "AGENT",
  "tenant_id": "uuid",
  "first_name": "Jane",
  "last_name": "Doe",
  "internal_sub_role": "SUPPORT",
  "department": "Engineering",
  "project_ids": ["uuid1", "uuid2"],
  "skill_ids": ["uuid3"]
}
```

### GET /users query params
```
tenant_id   required for non-ADMIN; absent = global for ADMIN
page        default 1
limit       default 25
role        comma-separated, e.g. AGENT,LEAD
search      text, searches email + first_name + last_name
```

### User response (additions)
```json
{
  "internal_sub_role": "SUPPORT",
  "department": "Engineering",
  "job_title": "...",
  "projects": [
    { "id": "uuid", "name": "Project X", "role": "MEMBER" }
  ]
}
```

---

## Verification Plan

1. **Pre-migration audit** — SQL for cross-tenant email duplicates → 0 rows expected; reset and reseed if needed
2. **Migration** — `prisma migrate dev` clean; `prisma studio` confirms `user_projects` table and new `users` columns
3. **Invite internal staff** — POST body with 3SC internal `tenant_id`, no `project_ids` → user created in correct tenant
4. **Invite client user** — POST body with client `tenant_id`, `project_ids` from same tenant → user created + `user_projects` rows inserted
5. **Cross-tenant project guard** — POST invite with `project_ids` from a different tenant → 400
6. **`internal_sub_role` guard** — POST invite for CLIENT_USER with `internal_sub_role` field → 400
7. **Email uniqueness** — Same email in two different tenants → both succeed; same email in same tenant → 409
8. **ADMIN global** — `GET /users` no `tenant_id`, ADMIN role → returns all tenants' users
9. **Non-admin missing tenant** — `GET /users` no `tenant_id`, LEAD role → 400 (not silent empty)
10. **ADMIN scoped** — `GET /users?tenant_id=X` ADMIN role → only tenant X users
11. **Internal console invite UI** — Staff form: tenant shows read-only "3SC Internal"; projects and skills multi-selects work
12. **Internal console invite UI** — Client form: tenant dropdown required; project selector disabled until tenant chosen
13. **Customer portal** — Client admin invite: no tenant selector; project selector shows own tenant's projects only; all scoped from JWT
14. **Email code intact** — User is created and appears in the list; email-sending code path still exists in service, just not triggered
15. **Backfill validation** — Existing users who had `internalSubRole` in `preferences` now have it in `internal_sub_role` column
16. **Project member endpoints** — `POST /projects/:id/members` creates row; `DELETE` removes it; `GET` lists them correctly