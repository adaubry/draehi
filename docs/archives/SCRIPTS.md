# Draehi Setup Scripts

Automated setup scripts for Draehi local development environment.

## Quick Start

Run the master setup script to configure everything:

```bash
./scripts/setup.sh
```

This will:
1. Check prerequisites (Node.js, npm, Git)
2. Install npm dependencies
3. Create `.env.local` from template
4. Install Rust and export-logseq-notes
5. Set up PostgreSQL database schema
6. Optionally set up MinIO S3 storage

---

## Individual Scripts

### 1. Install Rust Tools

**Script:** `./scripts/install-rust-tools.sh`

**What it does:**
- Checks if Rust/Cargo is installed
- Installs Rust via rustup if missing (macOS/Linux)
- Installs export-logseq-notes Cargo package
- Configures `CARGO_BIN_PATH` in `.env.local` for Next.js access

**Requirements:**
- Internet connection
- Supported OS: macOS, Linux

**Usage:**
```bash
./scripts/install-rust-tools.sh
```

---

### 2. Set Up MinIO S3 Storage

**Script:** `./scripts/setup-minio.sh`

**What it does:**
- Checks if Docker is installed
- Creates MinIO container (if doesn't exist)
- Starts MinIO server
- Creates `draehi-assets` bucket
- Sets bucket to public access

**Requirements:**
- Docker installed and running
- Ports 9000 and 9001 available

**First-time setup:**
```bash
npm run minio:setup
# OR
./scripts/setup-minio.sh
```

**Daily usage:**
```bash
# Start MinIO
npm run minio

# Other commands via minio.sh
./scripts/minio.sh stop
./scripts/minio.sh restart
./scripts/minio.sh logs
./scripts/minio.sh status
```

**Configuration (add to `.env.local`):**
```bash
STORAGE_MODE=local
MINIO_ENDPOINT=http://localhost:9000
MINIO_PUBLIC_URL=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=draehi-assets
```

**MinIO Access:**
- API: http://localhost:9000
- Console: http://localhost:9001
- Credentials: minioadmin / minioadmin

---

### 3. Set Up Database

**Script:** `./scripts/setup-database.sh`

**What it does:**
- Checks if `.env.local` exists
- Validates `DATABASE_URL` is set
- Installs npm dependencies (if needed)
- Pushes Drizzle schema to PostgreSQL

**Requirements:**
- `.env.local` with valid `DATABASE_URL`
- PostgreSQL database accessible

**Usage:**
```bash
./scripts/setup-database.sh
```

**Prerequisites:**

1. Create `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Set `DATABASE_URL` in `.env.local`:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5432/draehi
   ```

**Database Providers:**
- **Neon** (recommended): https://neon.tech (free tier)
- **Supabase**: https://supabase.com
- **Local PostgreSQL**: Install via Homebrew/apt

---

### 4. Master Setup

**Script:** `./scripts/setup.sh`

**What it does:**
- Runs all setup steps in correct order
- Interactive prompts for configuration
- Optional MinIO setup

**Usage:**
```bash
./scripts/setup.sh
```

---

## Testing Scripts

### Backend E2E Tests

**Script:** `./scripts/test-e2e.sh`

Tests the full ingestion pipeline:
- Database schema setup
- Test user creation
- Workspace creation
- Git repository connection
- Content validation

**Usage:**
```bash
./scripts/test-e2e.sh
```

### Frontend E2E Tests

**Script:** `./scripts/test-frontend-e2e.sh`

Validates frontend rendering:
- Pages load correctly (HTTP 200)
- Blocks display properly
- URL encoding works
- CSS stylesheets loaded

**Usage:**
```bash
./scripts/test-frontend-e2e.sh
```

### Structure Comparison

**Script:** `npx tsx scripts/compare-with-logseq.ts`

Compares database structure with Logseq docs:
- Page count validation
- Block quality checks
- Key pages verification

---

## Troubleshooting

### "Permission denied" when running scripts

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### Docker not found (MinIO)

Install Docker:
- **macOS**: Docker Desktop (https://www.docker.com/products/docker-desktop)
- **Linux**: `curl -fsSL https://get.docker.com | sh`

### DATABASE_URL connection fails

Check:
1. Database server is running
2. Credentials are correct
3. Database name exists
4. Host/port are accessible

### export-logseq-notes not found after install

Ensure Cargo bin is in PATH:
```bash
source $HOME/.cargo/env
```

Or add to `~/.bashrc` / `~/.zshrc`:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

---

## Script Architecture

All scripts follow industry best practices documented in [BASH_GUIDELINES.md](BASH_GUIDELINES.md):

1. **Idempotent** - Safe to run multiple times
2. **Unix-compatible** - Works on macOS/Linux
3. **Error handling** - `set -euo pipefail` + cleanup traps
4. **Self-cleaning** - Removes temp files on success AND failure
5. **User-friendly** - Clear output with indicators

---

**Last Updated:** 2025-11-23
