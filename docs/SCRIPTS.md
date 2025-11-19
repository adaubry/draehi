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

You can also run individual scripts as needed:

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

**Manual alternative:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install export-logseq-notes
cargo install export-logseq-notes
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

**Daily usage (quick launcher):**
```bash
# Start MinIO (auto-runs setup if needed)
npm run minio

# Stop MinIO
npm run minio stop

# Restart MinIO
npm run minio restart

# View logs
npm run minio logs

# Check status
npm run minio status
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

**Asset Ingestion Flow:**
1. Start MinIO: `npm run minio`
2. Sync workspace: triggers `ingestLogseqGraph()`
3. Assets (`../assets/image.png`) uploaded to MinIO
4. HTML updated with S3 URLs (`http://localhost:9000/draehi-assets/workspaces/1/assets/image.png`)
5. Frontend serves assets from MinIO

**Test asset upload:**
```bash
npx tsx scripts/test-asset-upload.ts
```

**When to skip:**
- You don't need asset hosting yet
- You're using AWS S3 directly (set `STORAGE_MODE=production`)
- You're only testing auth/git features

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

**Manual alternative:**
```bash
npm install
npm run db:push
```

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

**Interactive prompts:**
1. Pauses after creating `.env.local` to let you configure it
2. Asks if you want to set up MinIO

**Non-interactive mode (for CI):**
```bash
# Skip MinIO setup automatically
echo "N" | ./scripts/setup.sh
```

---

## Troubleshooting

### "Permission denied" when running scripts

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### Rust installation fails on Linux

Install build dependencies first:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential curl

# Fedora/RHEL
sudo dnf groupinstall -y "Development Tools"
```

### Docker not found (MinIO)

Install Docker:
- **macOS**: Docker Desktop (https://www.docker.com/products/docker-desktop)
- **Linux**: `curl -fsSL https://get.docker.com | sh`
- **Windows**: WSL2 + Docker Desktop

### Docker permission denied (Linux)

The script will automatically detect and fix this:
```bash
./scripts/setup-minio.sh
```

If prompted, enter your sudo password. You'll need to log out and log back in.

**Manual fix:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in
# Then verify:
docker ps
```

### export-logseq-notes: "not found in registry"

The tool is not published to crates.io. The script automatically builds from source.

**Requirements:**
- Git installed
- Rust build tools (installed automatically)
- Internet connection

**Manual install:**
```bash
git clone https://github.com/dimfeld/export-logseq-notes.git
cd export-logseq-notes
cargo install --path .
```

### Rust compilation error (time crate v0.3.20)

**Error:** `type annotations needed for Box<_>` in time-0.3.20

This is a known incompatibility between old `time` crate and modern Rust.

**The script automatically tries:**
```bash
cargo update  # Updates time to latest 0.3.x
```

**If build still fails, use older Rust:**
```bash
# Install and use Rust 1.70 (compatible with time 0.3.20)
rustup install 1.70.0
rustup default 1.70.0

# Build
cd /tmp
git clone https://github.com/dimfeld/export-logseq-notes.git
cd export-logseq-notes
cargo install --path .

# Return to latest Rust after
rustup default stable
```

**Manual fix (edit upstream project):**
```bash
cd /tmp/export-logseq-notes
# Edit Cargo.toml: change time = "0.3.20" to time = "0.3.36"
cargo build --release
cargo install --path .
```

### DATABASE_URL connection fails

Check:
1. Database server is running
2. Credentials are correct
3. Database name exists
4. Host/port are accessible

Test connection:
```bash
psql "${DATABASE_URL}"
```

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

All scripts follow industry best practices documented in [docs/BASH_GUIDELINES.md](BASH_GUIDELINES.md):

1. **Idempotent** - Safe to run multiple times
2. **Unix-compatible** - Works on macOS/Linux
3. **Error handling** - `set -euo pipefail` + cleanup traps
4. **Self-cleaning** - Removes temp files on success AND failure
5. **User-friendly** - Clear output with ✅/❌ indicators
6. **Fail-safe** - Never leaves system in broken state

**Directory structure:**
```
scripts/
├── setup.sh                    # Master setup script
├── install-rust-tools.sh       # Rust + export-logseq-notes
├── setup-minio.sh              # Local S3 storage
└── setup-database.sh           # PostgreSQL schema
```

**See also:**
- [BASH_GUIDELINES.md](BASH_GUIDELINES.md) - Complete bash scripting standards

---

## For CI/CD

Use individual scripts in CI pipelines:

```yaml
# Example GitHub Actions
- name: Install Rust tools
  run: ./scripts/install-rust-tools.sh

- name: Setup database
  run: ./scripts/setup-database.sh
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Contributing

When adding new setup scripts:

1. Place in `scripts/` directory
2. Use `#!/usr/bin/env bash` shebang
3. Add `set -euo pipefail` for safety
4. Make executable: `chmod +x scripts/your-script.sh`
5. Document in this file
6. Update master `setup.sh` if needed

---

**Last Updated:** 2025-11-16
