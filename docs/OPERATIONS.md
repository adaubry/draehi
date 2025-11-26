# Draehi Operations Guide

Complete reference for all development operations: setup, Docker management, testing, and debugging.

---

## 🚀 Quick Start (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Start all services (SurrealDB, KeyDB, MinIO, Surrealist GUI)
npm run docker:setup

# 3. Initialize database schema
npx tsx scripts/init-surreal-schema.ts

# 4. Run comprehensive tests to verify everything works
source .test.env
./scripts/test-db.sh
```

All services are now running:

- **Surrealist GUI**: http://localhost:8080 (query database visually)
- **Application**: Start with `npm run dev` (outside Docker)

### Connecting Surrealist to SurrealDB

Surrealist automatically loads pre-configured connections from `surrealist-instance.json`:

1. Open http://localhost:8080 in your browser
2. You should see "Local Development" connection in the connections list
3. Click to connect and query the database

If the connection doesn't appear:
- Browser localStorage may have cached old settings
- Clear browser cache (DevTools → Application → Clear site data)
- Reload the page
- Try manually adding connection: `ws://surrealdb:8000/rpc` with username `root`, password `root`

---

## 📦 Docker Management

### Start Services

**Development mode** (with bash, curl, debugging tools + Surrealist GUI):

```bash
npm run docker:setup
# or: BUILD_MODE=dev docker compose up --profile dev
```

Includes Surrealist (SurrealDB GUI) at `http://localhost:8080`

**Production mode** (lean, minimal containers):

```bash
npm run docker:setup:prod
# or: BUILD_MODE=prod docker compose up
```

### Stop & Clean Up

**Standard cleanup** (flushes database + Auth0 before stopping):

```bash
# Stop all containers
npm run docker:stop

# Remove all containers and volumes (clean slate)
npm run docker:clean
```

**Force cleanup** (stops immediately without flushing):

```bash
# Stop containers without flushing
npm run docker:stop:force

# Remove containers and volumes without flushing
npm run docker:clean:force
```

**Note:** `docker:stop` and `docker:clean` automatically call `npm run flush:db` before stopping/cleaning, which:

- Clears local session tokens
- Deletes Auth0 users (if credentials configured)
- Wipes all SurrealDB data
- Use `:force` variants to skip cleanup

### Access Container Shells

Access container shells for debugging:

```bash
npm run docker:shell:keydb    # KeyDB (Redis) ✅ Works
npm run docker:shell:minio    # MinIO (S3) ✅ Works

```

**Note:** SurrealDB's official image is minimal (distroless) without bash. Use `docker logs` or HTTP health endpoint for debugging instead.

### Container Health & Logs

```bash
# Check container status
docker ps

# View container logs
docker logs draehi-surrealdb
docker logs draehi-keydb
docker logs draehi-minio

# Check container stats (CPU, memory)
docker stats

# Inspect specific container
docker inspect draehi-surrealdb
```

---

## 🧪 Testing

### Database Tests (Most Important)

**Comprehensive database test suite** - Tests all 42 database operations:

```bash
# Setup
source .test.env
npm run docker:setup

# Run all database tests
npx tsx scripts/test-db-comprehensive.ts

# Expected: All 26 tests pass ✅
# Duration: ~15 seconds
```

**Bash version** - More verbose output for debugging:

```bash
source .test.env
./scripts/test-db.sh

# Expected: All 89 tests pass ✅
# Duration: ~30 seconds
```

### Module-Specific Tests

Quick tests for specific features:

```bash
# Auth + workspace creation flow
npx tsx scripts/test-auth-workspace-flow.ts

# Deployment workflow
npx tsx scripts/test-deployment-flow.ts

# Dashboard page load flow
npx tsx scripts/test-exact-dashboard-flow.ts

# RecordId parameter handling (CRITICAL for understanding SurrealDB)
npx tsx scripts/test-userid-comparison.ts
```

### End-to-End Tests

Full workflow tests that exercise the entire system:

```bash
# Backend E2E - User creation → workspace → content ingestion
./scripts/test-e2e.sh
# Duration: ~2 minutes

# Frontend E2E - Page rendering and display validation
./scripts/test-frontend-e2e.sh
# Duration: ~1 minute
```

### Running Full Test Suite

```bash
# 1. Setup environment
source .test.env
npm run docker:setup

# 2. Initialize schema
npx tsx scripts/init-surreal-schema.ts

# 3. Run tests in order
npx tsx scripts/test-db-comprehensive.ts     # Database operations (15s)
npx tsx scripts/test-auth-workspace-flow.ts  # Auth (5s)
npx tsx scripts/test-deployment-flow.ts      # Deployments (5s)
./scripts/test-e2e.sh                         # Full workflow (2m)

# Total time: ~3 minutes
# All tests should pass ✅

# 4. Clean up after tests (optional)
npm run flush:db  # Wipes all data + Auth0 users + local sessions
```

---

## 🔧 Setup Scripts

### Initialize Database

```bash
npx tsx scripts/init-surreal-schema.ts

# Creates:
# - Namespaces and database
# - Tables: users, workspaces, nodes, git_repositories, deployment_history
# - Indexes for performance
# - Constraints (unique, foreign keys)
```

### Flush Database (Test Cleanup)

Completely clear all data and Auth0 users (useful after tests):

```bash
npm run flush:db

# Clears (in order):
# 1. Local session tokens
# 2. Auth0 users (via Management API, if configured)
# 3. SurrealDB records:
#    deployment_history → git_repositories → nodes → workspaces → users
```

**Auth0 Cleanup Setup:**

Auth0 user deletion requires Management API credentials with `delete:users` permission:

1. Go to Auth0 Dashboard → Applications → Your App
2. Click "Machine to Machine Applications" tab
3. Find and authorize "Auth0 Management API"
4. Grant `delete:users` permission
5. Retry `npm run flush:db`

**If Auth0 cleanup fails:**

- Script gracefully continues with SurrealDB cleanup
- Error message shows exact missing permissions
- Set `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` in `.env.local`

### Rust Tools (export-logseq-notes)

The application uses a Rust tool to convert Logseq graphs:

```bash
# Already installed in Docker, but if installing on host:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
cargo install export-logseq-notes

# Verify installation
export-logseq-notes --help
```

---

## 🐛 Debugging Workflows

### "Container is unhealthy" Issue

**Note:** SurrealDB shows "unhealthy" in `docker ps` even when working correctly. This is because:

- Docker's health check tries to run `curl` inside the container
- SurrealDB's official image is distroless (no curl)
- The health check command fails, but the service itself works fine

**SurrealDB is actually healthy if:**

```bash
curl http://localhost:8000/health  # Returns HTTP 200 ✅
```

**Other services** (KeyDB, MinIO) show correct health status.

If services genuinely fail to start, check initialization time. Health checks include `start_period` grace periods:

- **SurrealDB**: 30s (database setup)
- **KeyDB**: 15s (startup)
- **MinIO**: 15s (startup)
- **Next.js app**: 45s (build + startup)

**To increase timeout:**

Edit `docker-compose.yml` and increase `start_period` values:

```yaml
healthcheck:
  start_period: 60s # Increase from 30s to 60s
  interval: 5s
  timeout: 5s
  retries: 10
```

Then rebuild:

```bash
BUILD_MODE=dev docker compose up --build
```

### Testing Service Connectivity

```bash
# SurrealDB - HTTP health check
curl http://localhost:8000/health

# KeyDB - Redis connectivity
redis-cli -p 6379 ping
# or: docker exec draehi-keydb keydb-cli ping

# MinIO - S3 connectivity
curl http://localhost:9000/minio/health
# or access console: http://localhost:9001 (minioadmin/minioadmin)
```

### "Connection refused" Error

```bash
# Check if containers are running
docker ps

# View logs for errors
docker logs draehi-surrealdb
docker logs draehi-keydb
docker logs draehi-minio

# Follow logs in real-time
docker logs -f draehi-surrealdb

# Restart services
npm run docker:stop && npm run docker:setup
```

### Accessing Container Shells

**KeyDB (Redis):**

```bash
npm run docker:shell:keydb

# Inside container:
keydb-cli
> ping
> info
> exit
```

**MinIO (S3):**

```bash
npm run docker:shell:minio

# Inside container:
mc --version
mc ls myminio/
exit
```

**SurrealDB:**

```bash
npm run docker:shell:surreal

# Inside container:
curl http://localhost:8000/health
surreal version
exit
```

### "Workspace not found" Error

This is usually a RecordId vs string parameter issue:

```bash
# See exact issue
npx tsx scripts/test-userid-comparison.ts

# Key: Keep user.id as RecordId object, don't convert to string
```

### Surrealist Connection Troubleshooting

**Problem: Surrealist shows "You must be connected to a SurrealDB instance before performing this operation"**

Solution steps:

1. **Verify WebSocket connectivity:**
   ```bash
   curl -i http://localhost:8000/health
   # Should return HTTP 200
   ```

2. **Check browser console for errors:**
   - Open http://localhost:8080
   - Press F12 → Console tab
   - Look for connection errors

3. **Clear browser cache and retry:**
   - DevTools → Application tab
   - Click "Clear site data"
   - Reload page

4. **Manually add connection if auto-load fails:**
   - Connection type: **WebSocket**
   - URL: `ws://localhost:8000/rpc` (from host) or `ws://surrealdb:8000/rpc` (from Docker)
   - Username: `root`
   - Password: `root`
   - Namespace: `draehi`
   - Database: `main`

5. **Check instance.json is mounted:**
   ```bash
   docker exec draehi-surrealist cat /home/surrealist/.surrealist/instance.json
   # Should show connection configuration
   ```

**Common errors and fixes:**

| Error | Cause | Fix |
| ----- | ----- | --- |
| "There was a problem with authentication" | WebSocket connection failing | Check namespace/database are set |
| "Connection refused" | SurrealDB not responding | Verify `curl http://localhost:8000/health` works |
| "timeout" | Network issue or slow startup | Wait 30s for SurrealDB health check to pass |

### Database Query Debugging

Access SurrealDB directly to test queries:

```bash
npm run docker:shell:surreal

# Inside container - test queries
curl -X POST http://localhost:8000/sql \
  -u root:root \
  -d "SELECT * FROM users LIMIT 1;"
```

### Performance Profiling

```bash
npm run docker:shell:app

# Inside container
htop           # CPU and memory usage
ps aux         # Process list
df -h          # Disk usage
```

---

## 🔍 Environment Configuration

### Test Configuration (`.test.env`)

Copy from template:

```bash
cp .test.env.example .test.env
```

Contents:

```bash
# SurrealDB
SURREAL_URL=http://localhost:8000
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NS=draehi
SURREAL_DB=main

# Test repository (for E2E tests)
TEST_REPO_URL=https://github.com/adaubry/logseq_graph_example.git
TEST_REPO_BRANCH=main

# Application
TEST_APP_URL=http://localhost:3000
```

### Application Environment (`.env.local`)

Copy from template:

```bash
cp .env.example .env.local
```

Key variables for Docker mode:

```bash
NODE_ENV=development
SURREAL_URL=http://localhost:8000
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NS=draehi
SURREAL_DB=main
KEYDB_URL=redis://localhost:6379
MINIO_ENDPOINT=http://localhost:9000
MINIO_PUBLIC_URL=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=draehi-assets
```

---

## 🏗️ Dev vs Prod Docker Modes

### What's the Difference?

| Feature         | Dev Mode                  | Prod Mode    |
| --------------- | ------------------------- | ------------ |
| Shell access    | ✅ bash included          | ❌ No bash   |
| Debugging tools | curl, wget, nc, vim, htop | None         |
| Size            | ~500MB (app)              | ~400MB (app) |
| Security        | ⚠️ Dev-only               | ✅ Hardened  |
| Use case        | Local development         | Deployment   |

### Dev Mode (Default)

```bash
npm run docker:setup
```

Includes: bash, curl, wget, netcat, vim, htop for interactive debugging.

**Typical dev workflow:**

```bash
npm run docker:shell:surreal
# Inside container: test SurrealDB health
curl http://localhost:8000/health
```

### Prod Mode

```bash
npm run docker:setup:prod
```

Lean containers without shell access. ~100MB smaller total.

**For deployment:**

- No shell = reduced attack surface
- Debugging via logs only: `docker logs [container]`
- Monitoring via external tools (APM, log aggregation)

---

## 📋 Common Tasks

### Verify System is Healthy

```bash
# 1. Containers running
docker ps

# 2. Services responding
curl http://localhost:8000/health      # SurrealDB
redis-cli -p 6379 ping                 # KeyDB
curl http://localhost:9001/            # MinIO console

# 3. Database works
npx tsx scripts/test-db-comprehensive.ts

# 4. Full workflow works
./scripts/test-e2e.sh
```

### Start Fresh

```bash
# Remove everything
npm run docker:clean

# Start fresh
npm run docker:setup

# Reinitialize schema
npx tsx scripts/init-surreal-schema.ts

# Verify
npx tsx scripts/test-db-comprehensive.ts
```

### Debug a Failing Test

```bash
# Run single test with detailed output
npx tsx scripts/test-userid-comparison.ts

# If database issue, check directly:
npm run docker:shell:surreal
curl -X POST http://localhost:8000/sql \
  -u root:root \
  -d "SELECT * FROM users LIMIT 1;"

# If connection issue, check logs:
docker logs draehi-surrealdb
docker logs draehi-app
```

### Add Development Dependencies

```bash
# Install packages
npm install [package-name]

# Run type check
npm run type-check

# Run linter
npm run lint

# Build and test
npm run build
npx tsx scripts/test-db-comprehensive.ts
```

---

## 🚨 Troubleshooting Reference

| Issue                   | Command to Debug                                                                                                  | Solution                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Containers not starting | `docker logs draehi-surrealdb`                                                                                    | Increase `start_period` in docker-compose.yml |
| "Connection refused"    | `docker ps`                                                                                                       | Run `npm run docker:setup`                    |
| Tests failing           | `npx tsx scripts/test-db-comprehensive.ts`                                                                        | Check `.test.env` is sourced                  |
| Database empty          | `npm run docker:shell:surreal` then `curl http://localhost:8000/sql -u root:root -d "SELECT count() FROM users;"` | Run `npx tsx scripts/init-surreal-schema.ts`  |
| Performance slow        | `npm run docker:shell:app` then `htop`                                                                            | Check CPU/memory, restart containers          |
| "Workspace not found"   | `npx tsx scripts/test-userid-comparison.ts`                                                                       | RecordId vs string issue, see test output     |

---

## 📚 Additional Resources

- [DATABASE.md](DATABASE.md) - Complete database schema and query reference
- [DOCKER_MODES.md](DOCKER_MODES.md) - Detailed Docker configuration
- [BASH_GUIDELINES.md](BASH_GUIDELINES.md) - Script writing standards
- [CLAUDE.md](../CLAUDE.md) - Project overview and architecture
- [DIRECTORY.md](DIRECTORY.md) - File structure navigation

---

**Last Updated:** 2025-11-26
