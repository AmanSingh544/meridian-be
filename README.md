# 3SC Platform Backend

NestJS + Prisma + PostgreSQL + Redis backend for the 3SC customer support platform (Meridian).

## Tech Stack

- **Framework**: NestJS v10 (Node.js + TypeScript)
- **Database**: PostgreSQL + Prisma ORM + pgvector (semantic search)
- **Cache / Queues**: Redis + BullMQ
- **Real-time**: Socket.io WebSocket gateway
- **AI**: OpenAI, Anthropic Claude, Groq (multi-provider gateway)
- **Email**: Brevo (SMTP + API)
- **File Storage**: Cloudflare R2 / AWS S3
- **Deployment**: Docker + Railway.app

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database URL and API keys

# 3. Run database migrations
npx prisma migrate dev
npx prisma generate

# 4. (Optional) Seed the database
npm run db:seed

# 5. Start development server
npm run start:dev
```

Server starts on `http://localhost:3000`. Swagger UI is at `http://localhost:3000/api/v1/docs`.

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/3sc_platform?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# CORS
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
COOKIE_SAME_SITE="lax"   # use "none" for cross-origin + HTTPS

# AI Providers (add any combination)
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# File Storage (Cloudflare R2 or S3-compatible)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="3sc-attachments"
R2_PUBLIC_URL="https://cdn.yourdomain.com"

# Email (Brevo — free tier: 300 emails/day)
BREVO_API_KEY="..."
BREVO_SMTP_KEY="..."
BREVO_SMTP_USER="your-brevo-account@email.com"
EMAIL_FROM="noreply@brevosend.com"
EMAIL_FROM_NAME="3SC Platform"

# Error Tracking
SENTRY_DSN="https://..."
```

See `.env.example` for the full list.

## Available Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload (nest watch) |
| `npm run start:prod` | Build then start production server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run db:migrate` | Run pending Prisma migrations (dev) |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed the database |
| `npm run test` | Run Jest unit tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run lint` | Lint and auto-fix with ESLint |

## Project Structure

```
src/
├── main.ts                    # Bootstrap: CORS, Swagger, validation, Socket.io
├── app.module.ts              # Root module — imports all feature modules
│
├── events/                    # Internal event bus
│   ├── event-bus.ts           # EventEmitter2 singleton
│   └── ticket.events.ts       # Ticket lifecycle event types
│
├── modules/                   # Feature modules (35 total)
│   ├── ai/                    # Multi-provider LLM gateway
│   ├── ai-copilot/            # AI copilot conversations
│   ├── ai-extended/           # Extended AI features (suggestions, embeddings)
│   ├── analytics/             # Metrics and reporting
│   ├── attachments/           # File upload/download (R2/S3)
│   ├── audit-logs/            # Immutable change tracking
│   ├── auth/                  # JWT auth + refresh tokens + permissions
│   ├── comments/              # Threaded ticket comments + internal notes
│   ├── dashboard/             # Dashboard summary endpoints
│   ├── delivery/              # Delivery board / release tracking
│   ├── documents/             # Department document management
│   ├── email/                 # Brevo email service
│   ├── escalations/           # Ticket escalation workflows
│   ├── feedback/              # CSAT / NPS survey collection
│   ├── health/                # Health check endpoint
│   ├── knowledge-base/        # KB articles + pgvector semantic search
│   ├── notifications/         # In-app + email notifications
│   ├── onboarding/            # Onboarding task checklists
│   ├── organizations/         # Tenant / organization management
│   ├── projects/              # Project grouping for tickets
│   ├── realtime/              # Socket.io WebSocket gateway
│   ├── roadmap/               # Feature roadmap
│   ├── routing-rules/         # Automated ticket routing
│   ├── scheduler/             # Cron jobs (SLA checks, digest emails)
│   ├── skills/                # Agent skill tagging
│   ├── sla/                   # SLA policy enforcement (business-hours aware)
│   ├── system-settings/       # Global tenant configuration
│   ├── team/                  # Team management
│   ├── tickets/               # Core ticket CRUD + state machine
│   ├── user-preferences/      # Per-user settings
│   ├── users/                 # User management + RBAC
│   ├── whatsapp/              # WhatsApp channel integration
│   └── workloads/             # Agent workload tracking
│
└── shared/
    ├── decorators/            # @CurrentUser, @Public, etc.
    ├── enums/                 # Shared enums (Role, Status, Priority …)
    ├── guards/                # JwtAuthGuard, RolesGuard
    ├── interceptors/          # Response transform, logging
    ├── prisma/                # PrismaService (global singleton)
    ├── redis/                 # RedisService (ioredis wrapper)
    └── utils/                 # Helpers (pagination, slugs, dates …)
```

## AI Provider Routing

The `ai` module is a multi-provider gateway. Providers are selected by `budget_tier`:

| Tier | Provider | Model | Use case |
|---|---|---|---|
| `economy` | Groq | llama3-8b | Fastest, cheapest |
| `standard` | OpenAI | gpt-4o-mini | Balanced (default) |
| `premium` | OpenAI | gpt-4o | Highest quality |

Set `ANTHROPIC_API_KEY` to enable Claude as an additional option. The gateway falls back to the next available provider if one is unavailable.

AI features across the platform:
- **Ticket classification** — auto-suggest priority and category on creation
- **Reply generation** — draft responses from ticket context
- **Semantic search** — KB articles indexed with pgvector embeddings
- **AI Copilot** — persistent per-ticket conversation threads with the LLM
- **Bug clustering** — cosine similarity grouping via pgvector KNN

## Real-time (WebSocket)

The `realtime` module runs a Socket.io gateway on the same port as the HTTP server. Events emitted to connected clients:

- `ticket:created`, `ticket:updated`, `ticket:assigned`
- `comment:created`
- `notification:new`

Authentication uses the same JWT cookie — clients must be logged in before connecting.

## Notification System

Notifications are fired through the internal event bus (`src/events/`). On each ticket or comment event the `notifications` module:

1. Persists a `Notification` row in Postgres
2. Pushes a `notification:new` WebSocket event to the recipient
3. Sends an email via Brevo (if `SystemSettings.emailNotificationsEnabled = true`)

Email sends are gated by the `system-settings` module — disable globally or per-tenant without a deploy.

## Database Schema

Run `npm run db:studio` to browse data visually.

Key models (see `prisma/schema.prisma` for full detail):

| Model | Purpose |
|---|---|
| `Tenant` | Multi-tenancy root |
| `User` | Roles: `ADMIN`, `LEAD`, `AGENT`, `CLIENT_ADMIN`, `CLIENT_USER` |
| `Ticket` | Core support ticket with status / priority state machine |
| `Comment` | Threaded replies + internal notes |
| `Attachment` | File metadata; content stored in R2/S3 |
| `Document` | Shared department documents |
| `KbArticle` / `KbCategory` | Knowledge base with pgvector embeddings |
| `Notification` | In-app + email notification records |
| `AuditLog` | Immutable field-level change history |
| `SlaPolicy` | Business-hours-aware SLA enforcement |
| `PermissionOverride` | Attribute-based RBAC overrides |
| `Project` | Group tickets by project |
| `DeliveryItem` | Delivery board cards |
| `RoadmapFeature` | Feature roadmap entries with upvotes |
| `OnboardingItem` | Onboarding task checklist |
| `Escalation` | Escalation records with reason + history |
| `RoutingRule` | Automated ticket-routing conditions |
| `Skill` / `UserSkill` | Agent skill registry |
| `AiConversation` / `AiMessage` | Copilot conversation threads |
| `SurveyToken` / `FeedbackResponse` | CSAT / NPS survey tokens and responses |
| `ProjectApiKey` | Per-project API keys for external integrations |

### Migrations

```bash
# Create a new migration during development
npx prisma migrate dev --name describe_the_change

# Apply migrations in production (no schema drift)
npx prisma migrate deploy
```

Migration history lives in `prisma/migrations/`.

## API Documentation

Swagger UI (enabled in `main.ts`):

```
http://localhost:3000/api/v1/docs
```

All routes are prefixed with `/api/v1`.

## Deployment (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway init

# Add managed PostgreSQL and Redis
railway add --database postgres
railway add --database redis

# Set required secrets
railway variables --set "JWT_SECRET=$(openssl rand -base64 32)"
railway variables --set "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"

# Deploy (uses Dockerfile automatically via railway.json)
railway up
```

Railway runs `sh ./start.sh` on container start, which runs `prisma migrate deploy` then starts the Node process. Health check: `GET /api/v1/health`.

### Docker (local)

```bash
docker build -t 3sc-backend .
docker run -p 3000:3000 --env-file .env 3sc-backend
```

The Dockerfile uses a multi-stage build (builder → production) on `node:20-slim`.
