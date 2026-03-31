# Planning Copilot

## Overview

AI Chat-Based Construction Scheduling Platform. A professional-grade planning workspace for project controls teams working on large EPC, mining, oil & gas, and industrial projects.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite + Tailwind CSS

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/        # Express API server
│   └── planning-copilot/  # React + Vite frontend
├── lib/
│   ├── api-spec/          # OpenAPI spec + Orval codegen config
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-zod/           # Generated Zod schemas
│   └── db/                # Drizzle ORM schema + DB connection
├── scripts/               # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Application Architecture

### Frontend (artifacts/planning-copilot)

- **Home page** (`/`): Project list with stats, "New Project" dialog, template library
- **Project Workspace** (`/projects/:id`): 3-panel layout
  - Left: AI chat panel with schedule generation trigger
  - Center: Gantt / Kanban / Network views (tabbed)
  - Right: Inspector / AI Suggestions / Validation panels
- **Top bar**: Project name, status, Export P6 XML, version history, settings

### Backend Services (artifacts/api-server)

All routes mounted at `/api`:

| Route | Purpose |
|-------|---------|
| `GET /projects` | List all projects |
| `POST /projects` | Create project |
| `GET /projects/:id/summary` | Schedule summary stats |
| `GET /projects/:id/tasks` | Get tasks |
| `POST /projects/:id/tasks` | Create task |
| `PUT /tasks/:id` | Update task |
| `DELETE /tasks/:id` | Delete task |
| `GET/POST /projects/:id/dependencies` | Dependencies |
| `PUT/DELETE /dependencies/:id` | Edit dependency |
| `GET/POST /projects/:id/wbs` | WBS nodes |
| `POST /projects/:id/chat/message` | AI chat |
| `GET /projects/:id/chat/history` | Chat history |
| `POST /projects/:id/chat/generate-schedule` | Generate full schedule |
| `GET /projects/:id/ai-suggestions` | AI suggestions |
| `POST /ai-suggestions/:id/accept` | Accept suggestion |
| `POST /ai-suggestions/:id/reject` | Reject suggestion |
| `GET /projects/:id/validation` | Schedule validation |
| `GET /templates` | Template library |
| `POST /projects/:id/export/p6-xml` | P6 XML export |
| `GET/POST /projects/:id/versions` | Version history |

### Database Schema (lib/db/src/schema/)

- `projects` — Project metadata (type, industry, dates, status)
- `wbs_nodes` — WBS hierarchy with parent-child relationships
- `tasks` — Activities and milestones (P6-aligned fields)
- `dependencies` — Logic links with FS/SS/FF/SF relationships and lag
- `chat_messages` — Conversation history per project
- `ai_suggestions` — AI-generated recommendations with accept/reject
- `templates` — System template library (10 seeded templates)
- `schedule_versions` — Snapshot versioning

### Key Features

1. **Chat-Driven Scheduling**: Describe project → AI extracts data, asks clarifying questions → Generate Schedule button creates full WBS + tasks + dependencies
2. **Gantt View**: Custom timeline with task bars, milestones (diamonds), dependency lines, zoom controls
3. **Kanban View**: Drag-and-drop status columns (Not Started / In Progress / Completed / On Hold)
4. **Network View**: SVG-based dependency graph with zoom and pan
5. **AI Suggestions Panel**: Shows duration warnings, missing logic, resource conflicts — accept/reject workflow
6. **Validation Engine**: Cycle detection, orphan tasks, missing dates, zero-duration tasks, discipline checks
7. **P6 Export**: Primavera P6 XML format export with WBS, activities, and relationships
8. **Version History**: Schedule snapshots for baseline comparison

### Primavera P6 Alignment

The data model is designed to map to P6 concepts:
- Task → Activity
- WbsNode → WBS
- Dependency → Relationship (FS/SS/FF/SF with lag)
- Milestone Task → Start/Finish Milestone Activity
- taskCode → Activity ID

## Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/planning-copilot run dev

# Push DB schema changes
pnpm --filter @workspace/db run push

# Run codegen after OpenAPI spec changes
pnpm --filter @workspace/api-spec run codegen
```

## Seed Data

- 1 demo project (Greenfield Water Treatment Plant - Phase 1, Brisbane)
- 10 system templates across Construction, Engineering, Procurement, Commissioning, Infrastructure categories
- Schedule generates 37 tasks + 37 dependencies + 5 AI suggestions when "Generate Schedule" is triggered

## Future Expansion (Out of Scope for v1)

- Cost control module
- Risk register module
- Primavera P6 live API synchronization
- Earned value dashboards
- Multi-tenant enterprise administration
- Document management
