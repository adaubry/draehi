# Draehi

**Deploy your Logseq graph to the web in 60 seconds.**

A "Vercel for Logseq graphs" - Transform your personal knowledge base into a high-performance, SEO-optimized website.

## Status

🚧 **In Development** - Phase 2: Git Integration (Complete)

See [ROADMAP.md](docs/ROADMAP.md) for development plan.

## Features

- ✅ **Authentication system** - Username/password with iron-session
- ✅ **Workspace management** - One workspace per user, auto-created
- ✅ **Git integration** - Connect GitHub repositories
- ✅ **Repository sync** - Clone & sync on connection
- ✅ **GitHub webhooks** - Auto-deploy on push
- ✅ **Manual deployments** - Trigger sync manually
- ✅ **Deployment history** - Track all deployments
- ✅ **Git-based workflow** - Push to deploy foundation
- 🚧 Logseq graph processing (Phase 3)
- 🚧 Pre-rendered content using Rust export tool
- 🚧 Public workspace viewer

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- Git

### Setup

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd draehi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your database URL and session secret
   ```

4. **Set up database**
   ```bash
   npm run db:push
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   ```
   http://localhost:3000
   ```

## Project Structure

```
draehi/
├── modules/          # Modular monolith (auth, workspace, content, git, logseq)
├── app/              # Next.js App Router
├── components/       # React components
├── lib/              # Shared utilities
├── drizzle/          # Database migrations
└── docs/             # Documentation
```

See [DIRECTORY.md](docs/DIRECTORY.md) for detailed structure.

## Scripts

```bash
npm run dev           # Run development server
npm run build         # Build for production
npm run type-check    # TypeScript type checking
npm run lint          # ESLint
npm run db:generate   # Generate migrations
npm run db:push       # Push schema to database
npm run db:studio     # Open Drizzle Studio
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - AI agent instructions
- [ROADMAP.md](docs/ROADMAP.md) - Development roadmap
- [DIRECTORY.md](docs/DIRECTORY.md) - Project structure guide
- [CRUD_GUIDELINES.md](docs/CRUD_GUIDELINES.md) - CRUD patterns
- [PERFORMANCE_GUIDELINES.md](docs/PERFORMANCE_GUIDELINES.md) - Performance patterns
- [CHANGELOG.md](docs/CHANGELOG.md) - Version history

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Drizzle ORM
- **Styling**: Tailwind CSS v4
- **Auth**: iron-session + bcryptjs
- **Validation**: Zod
- **Content Processing**: export-logseq-notes (Rust)

## Architecture Principles

1. **Modular Monolith** - Organized modules, single deployable unit
2. **Server Components** - Default to server-side rendering
3. **Performance First** - PPR, caching, prefetching
4. **Git as Source of Truth** - No manual CRUD, only deployments
5. **Namespace Hierarchy** - O(1) lookups, no recursion

## Contributing

See [ROADMAP.md](docs/ROADMAP.md) for current priorities.

## License

MIT
