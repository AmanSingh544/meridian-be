# 3SC Platform Backend

NestJS + Prisma + PostgreSQL + Redis backend for the 3SC customer support platform.

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

# 4. Start development server
npm run start:dev
```

## Project Structure

```
src/
├── modules/
│   ├── auth/          # JWT authentication
│   ├── users/         # User management
│   ├── tickets/       # Ticket CRUD + state machine
│   ├── ai/            # Multi-provider AI gateway
│   ├── health/        # Health check endpoint
│   └── ...            # Add more modules as needed
├── shared/
│   ├── prisma/        # Prisma service (global)
│   ├── guards/        # JWT auth guard
│   └── decorators/    # CurrentUser decorator
├── main.ts            # Application entry point
└── app.module.ts      # Root module
```

## AI Provider Routing

The AI service supports multiple LLM providers:
- **OpenAI GPT-4o** — premium quality, higher cost
- **OpenAI GPT-4o-mini** — balanced quality/cost (default)
- **Anthropic Claude** — add ANTHROPIC_API_KEY to enable
- **Groq** — fastest, lowest cost

Providers are selected automatically based on `budget_tier` parameter:
- `economy` → cheapest available
- `standard` → balanced (GPT-4o-mini)
- `premium` → highest quality (GPT-4o)

## Deployment (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and init
railway login
railway init

# Add PostgreSQL and Redis plugins
railway add --database postgres
railway add --database redis

# Set environment variables
railway variables --set "JWT_SECRET=$(openssl rand -base64 32)"

# Deploy
railway up
```

## Database Schema

See `prisma/schema.prisma` for the complete data model.

Key entities:
- **Tenants** — multi-tenancy root
- **Users** — with role-based access (ADMIN, LEAD, AGENT, CLIENT_ADMIN, CLIENT_USER)
- **Tickets** — core support tickets with status/priority
- **Comments** — threaded with internal note support
- **Attachments** — metadata + R2 storage keys
- **Knowledge Base** — articles with pgvector embeddings
- **SLA Policies** — business hours aware
- **Audit Logs** — immutable change tracking

## API Documentation

Once running, Swagger docs are available at:
```
http://localhost:3000/api/v1/docs
```

*(To enable Swagger, install `@nestjs/swagger` and add DocumentBuilder in main.ts)*
