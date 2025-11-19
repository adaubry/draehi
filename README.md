# Draehi

**Deploy your Logseq graph to the web in 60 seconds.**

A "Vercel for Logseq graphs" - Transform your personal knowledge base into a high-performance, SEO-optimized website.

## Status

✅ **Phase 4 Complete** - Public Viewer with Logseq Features

Next: Phase 5 - Deployment Pipeline & Polish

See [ROADMAP.md](docs/ROADMAP.md) for development plan.

## Features

- ✅ **Authentication system** - Username/password with iron-session
- ✅ **Workspace management** - One workspace per user, auto-created
- ✅ **Git integration** - Connect GitHub repositories
- ✅ **Repository sync** - Clone & sync on connection
- ✅ **GitHub webhooks** - Auto-deploy on push
- ✅ **Manual deployments** - Trigger sync manually
- ✅ **Deployment history** - Track all deployments
- ✅ **Git-based workflow** - Push to deploy
- ✅ **Logseq processing** - Rust-based HTML export
- ✅ **Pre-rendered content** - Stored in PostgreSQL
- ✅ **Public workspace viewer** - Namespace-based routing
- ✅ **Block hierarchy** - Collapsible nested content
- ✅ **Page/Block references** - `[[page]]` and `((uuid))` support
- ✅ **Task markers** - TODO/DOING/DONE with checkboxes
- ✅ **Priority badges** - [#A]/[#B]/[#C] color-coded
- ✅ **Backlinks** - Cited by and Related sections
- ✅ **Breadcrumbs** - Navigation hierarchy

## Quick Start

### Prerequisites

- Node.js 20+
- Git
- PostgreSQL database (Neon recommended for free tier)
- Docker (optional, for local S3 storage)

### Automated Setup (Recommended)

Run the master setup script:

```bash
./scripts/setup.sh
```

This automated script will:
- Install npm dependencies
- Set up environment variables
- Install Rust + export-logseq-notes
- Configure database schema
- Optionally set up MinIO S3 storage

See [docs/SCRIPTS.md](docs/SCRIPTS.md) for detailed documentation.

### Manual Setup

If you prefer manual setup or need to troubleshoot:

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd draehi
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local - set DATABASE_URL and SESSION_SECRET
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Install Rust tools**
   ```bash
   ./scripts/install-rust-tools.sh
   ```

5. **Set up database**
   ```bash
   ./scripts/setup-database.sh
   ```

6. **Optional: Set up MinIO S3**
   ```bash
   ./scripts/setup-minio.sh
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

8. **Open browser**
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

## GitHub Personal Access Token Setup

**IMPORTANT**: Never use a token with full repository access. Always use fine-grained tokens with minimal permissions.

### Creating a Secure Fine-Grained PAT

1. **Go to GitHub Settings**
   - Navigate to https://github.com/settings/tokens?type=beta
   - Click "Generate new token" → "Fine-grained token"

2. **Token Configuration**
   - **Token name**: `draehi-logseq-graph` (or similar descriptive name)
   - **Expiration**: 90 days (recommended) or custom
   - **Resource owner**: Select your account
   - **Repository access**: "Only select repositories"
     - Choose ONLY your Logseq graph repository
     - **DO NOT** select "All repositories"

3. **Repository Permissions** (minimum required)
   - **Contents**: Read-only (required to clone/pull)
   - **Metadata**: Read-only (auto-selected)
   - **DO NOT** grant write access unless you need push capabilities

4. **Generate and Copy**
   - Click "Generate token"
   - Copy the token immediately (starts with `github_pat_`)
   - Store it securely - you won't see it again

5. **Security Best Practices**
   - ✅ Use fine-grained tokens (not classic tokens)
   - ✅ Limit to specific repositories only
   - ✅ Use read-only permissions
   - ✅ Set expiration dates
   - ✅ Regenerate tokens periodically
   - ❌ Never commit tokens to git
   - ❌ Never share tokens publicly
   - ❌ Never use tokens with write access unless absolutely needed

### Troubleshooting

**"Authentication failed"**
- Token expired → Generate new token
- Wrong permissions → Verify "Contents: Read" permission
- Wrong repository selected → Check repository access settings

**"Repository not found"**
- Token doesn't have access to repository
- Repository URL incorrect
- Repository is private and token lacks access

## Documentation

- [SCRIPTS.md](docs/SCRIPTS.md) - Setup scripts documentation
- [ROADMAP.md](docs/ROADMAP.md) - Development roadmap
- [DIRECTORY.md](docs/DIRECTORY.md) - Project structure guide
- [CRUD_GUIDELINES.md](docs/CRUD_GUIDELINES.md) - CRUD patterns
- [PERFORMANCE_GUIDELINES.md](docs/PERFORMANCE_GUIDELINES.md) - Performance patterns
- [CHANGELOG.md](docs/CHANGELOG.md) - Version history
- [CLAUDE.md](CLAUDE.md) - AI agent instructions

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Drizzle ORM
- **Styling**: Tailwind CSS v4
- **Auth**: iron-session + bcryptjs
- **Validation**: Zod
- **Content Processing**: export-logseq-notes (Rust)
- **Asset Storage**: S3-compatible (MinIO local, AWS S3 prod)

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
