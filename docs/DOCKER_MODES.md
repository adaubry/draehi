# Docker Build Modes: Dev vs Prod

Draehi supports two Docker build modes to balance debugging capabilities with production security and size:

- **dev** - Development mode with debugging tools (default)
- **prod** - Production mode with minimal, lean containers

## Quick Start

### Development Mode (Default)

Start containers with debugging tools enabled:

```bash
npm run docker:setup
# or explicitly:
BUILD_MODE=dev docker compose up
```

### Production Mode

Start lean containers without debugging tools:

```bash
npm run docker:setup:prod
# or explicitly:
BUILD_MODE=prod docker compose up
```

## Debugging Tools Included in Dev Mode

### SurrealDB Container
- `bash` - Interactive shell access
- `curl` - HTTP client for testing APIs
- `wget` - Alternative download tool
- `netcat-openbsd` (`nc`) - Port testing and network debugging
- `vim` - Text editor
- `htop` - Process monitoring

### KeyDB Container
- `bash` - Interactive shell access
- `keydb-cli` - Already included for Redis operations

### MinIO Container
- `bash` - Interactive shell access
- `mc` - MinIO client (already included)

### Next.js App Container
- `bash` - Interactive shell access
- `curl` - HTTP client
- `vim` - Text editor
- `wget` - Alternative download tool
- `netcat-openbsd` - Port testing
- `htop` - Process monitoring

## Accessing Container Shells

Once containers are running, you can access any container's shell:

```bash
# SurrealDB shell
npm run docker:shell:surreal

# KeyDB shell
npm run docker:shell:keydb

# MinIO shell
npm run docker:shell:minio

# Next.js app shell
npm run docker:shell:app
```

## Debugging Examples

### Test SurrealDB Health

```bash
npm run docker:shell:surreal

# Inside container:
curl -f http://localhost:8000/health
curl http://localhost:8000/
```

### Test KeyDB Connectivity

```bash
npm run docker:shell:keydb

# Inside container:
keydb-cli ping
keydb-cli info
```

### Test Network Connectivity

```bash
npm run docker:shell:surreal

# Inside container - test if keydb is reachable:
nc -zv keydb 6379
```

### Check Process Usage

```bash
npm run docker:shell:app

# Inside container:
htop
ps aux
```

## Size Comparison

| Container | Dev Mode | Prod Mode | Difference |
|-----------|----------|-----------|-----------|
| Next.js app | ~500MB | ~400MB | -100MB |
| SurrealDB | ~80MB | ~70MB | -10MB |
| KeyDB | ~70MB | ~65MB | -5MB |

## Production Deployment

For production:

1. Build with production mode:
   ```bash
   BUILD_MODE=prod docker compose up
   ```

2. No shell access is available in prod containers - this prevents:
   - Unauthorized container access
   - Potential escape vectors via bash
   - Accidental modifications to running services

3. For production debugging:
   - Use container logs: `docker logs draehi-surrealdb`
   - Use Docker stats: `docker stats`
   - Implement external monitoring (APM, log aggregation)

## How It Works

The `BUILD_MODE` environment variable is passed to Docker during build:

1. **docker-compose.yml** passes `BUILD_MODE` as a build arg to the Dockerfile
2. **Dockerfile** uses conditional install in a multi-stage build:
   ```dockerfile
   RUN if [ "$BUILD_MODE" = "dev" ]; then \
         apk add --no-cache bash curl wget netcat vim htop; \
       fi
   ```
3. Dev mode includes tools; prod mode skips them

## Environment Variables

Set the build mode in your shell:

```bash
# Permanently for a session:
export BUILD_MODE=prod
docker compose up

# Or pass it per command:
BUILD_MODE=prod docker compose up
```

The npm scripts automatically set `BUILD_MODE=dev` and `BUILD_MODE=prod` respectively.

## Troubleshooting

### Containers are unhealthy on startup

This is often due to services needing time to initialize. The `start_period` in healthchecks allows a grace period:

- **SurrealDB**: 30 second start period
- **KeyDB**: 15 second start period
- **MinIO**: 15 second start period
- **Next.js app**: 45 second start period

If services are still failing, increase these values in `docker-compose.yml`.

### Can't access container shell

Make sure containers are running in dev mode:

```bash
# Check build mode used:
docker compose config | grep BUILD_MODE

# Rebuild in dev mode:
BUILD_MODE=dev docker compose up --build
```

### Need different tools?

Add tools to the Dockerfile conditional:

```dockerfile
RUN if [ "$BUILD_MODE" = "dev" ]; then \
      apk add --no-cache bash curl wget netcat vim htop [your-tool]; \
    fi
```

Then rebuild:

```bash
BUILD_MODE=dev docker compose up --build
```
