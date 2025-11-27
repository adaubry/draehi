# Draehi Scripts

Complete bash automation for Draehi development and AWS deployment. All scripts follow [BASH_GUIDELINES.md](../docs/BASH_GUIDELINES.md) with proper error handling, cleanup, and user feedback.

## Quick Start

### Local Development Setup (One Command)
```bash
./scripts/setup.sh
```

This automated script will:
- Check prerequisites (git, node, docker)
- Install npm dependencies
- Configure environment (.env.local)
- Install Rust tools
- Start Docker services
- Initialize databases

## Scripts by Category

### 🚀 Core Setup Scripts

#### `setup.sh`
Master orchestrator for local development setup.
```bash
./scripts/setup.sh [--skip-docker] [--skip-rust]
```

- Checks prerequisites
- Installs npm dependencies
- Configures .env.local from templates
- Installs Rust and export-logseq-notes
- Starts Docker services
- Initializes database schema

#### `docker-setup.sh`
Manages Docker Compose for all services: SurrealDB, Surrealist GUI, KeyDB, MinIO.
```bash
./scripts/docker-setup.sh {start|stop|clean|status|logs} [service]
```

**Commands:**
- `start` - Start all services (includes Surrealist GUI at http://localhost:8080)
- `stop` - Graceful shutdown
- `clean` - Remove containers and volumes
- `status` - Show container health and service URLs
- `logs` - Stream logs (optionally filter by service)

**Examples:**
```bash
./scripts/docker-setup.sh start
./scripts/docker-setup.sh status
./scripts/docker-setup.sh logs surrealist
./scripts/docker-setup.sh logs surrealdb
./scripts/docker-setup.sh clean
```

#### `install-rust-tools.sh`
Installs Rust and export-logseq-notes binary.
```bash
./scripts/install-rust-tools.sh
```

- Auto-detects if already installed
- Installs Rust via rustup.rs
- Compiles export-logseq-notes from source

#### `setup-databases.sh`
Initializes SurrealDB, KeyDB, MinIO in one command.
```bash
./scripts/setup-databases.sh [--skip-schema]
```

- Waits for service health
- Runs schema initialization
- Configures all databases

### 🧪 Testing & Validation

#### `test-e2e.sh`
End-to-end backend workflow testing.
```bash
source .test.env
./scripts/test-e2e.sh
```

Tests:
- Service health
- User and workspace creation
- Content ingestion
- Database verification

#### `health-check.sh`
Verifies all services are healthy.
```bash
./scripts/health-check.sh [--watch]
```

Checks:
- SurrealDB (http://localhost:8000/health)
- KeyDB (redis://localhost:6379)
- MinIO (http://localhost:9000)
- Next.js app (http://localhost:3000)

**Watch Mode:**
```bash
./scripts/health-check.sh --watch  # Real-time dashboard
```

### 🗄️ Database Utilities

#### `db-flush.sh`
Clears all data for testing.
```bash
source .test.env
./scripts/db-flush.sh
```

Flushes:
- SurrealDB (drops database)
- KeyDB (FLUSHALL)
- MinIO buckets (optional)

### ☁️ AWS Deployment Scripts

#### `deploy-complete.sh`
Orchestrates complete AWS stack deployment.
```bash
./scripts/deploy-complete.sh --stack-name draehi-prod
```

Deploys:
- Builds Next.js app
- Pushes Docker image to ECR
- SurrealDB on EKS
- KeyDB on ElastiCache or EKS
- S3 buckets
- Next.js app on EC2

#### `deploy-surrealdb-eks.sh`
Deploys SurrealDB to EKS.
```bash
./scripts/deploy-surrealdb-eks.sh \
  --stack-name draehi-surrealdb \
  --region us-east-1
```

Per AWS documentation: https://surrealdb.com/docs/surrealdb/deployment/amazon

Configures:
- EKS cluster with Helm
- Persistent volumes (EBS)
- Auto-scaling
- Load balancer

#### `deploy-keydb-eks.sh`
Deploys Redis/KeyDB to EKS or AWS ElastiCache.
```bash
./scripts/deploy-keydb-eks.sh \
  --stack-name draehi-keydb \
  --mode elasticache  # or k8s
```

Supports:
- AWS ElastiCache Redis (managed)
- Self-hosted KeyDB on Kubernetes (Helm)

#### `deploy-s3-assets.sh`
Configures S3 buckets for assets.
```bash
./scripts/deploy-s3-assets.sh \
  --stack-name draehi
```

Configures:
- Bucket creation
- Versioning
- Encryption (AES256)
- CORS
- IAM policies

#### `deploy-ec2.sh`
Deploys Next.js app to EC2.
```bash
./scripts/deploy-ec2.sh \
  --stack-name draehi \
  --image <ecr-image-uri> \
  --instance-type t3.medium
```

Configures:
- Security groups
- EC2 instance
- Docker container runtime
- Auto-scaling (optional)

## Service URLs

### Local Development
- **SurrealDB**: http://localhost:8000
- **Surrealist GUI**: http://localhost:8080 (includes dev-mode profile in docker-compose.yml)
- **KeyDB/Redis**: redis://localhost:6379
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **App**: http://localhost:3000

### AWS Deployment
- **SurrealDB**: http://{load-balancer}:8000
- **KeyDB**: redis://{elasticache-endpoint}:6379
- **S3**: https://{bucket-name}.s3.amazonaws.com
- **App**: http://{ec2-public-ip}:3000

## Environment Configuration

### Local Development (`.env.local`)
Auto-created by `setup.sh` from `.env.docker` template:
```bash
SURREAL_URL=http://localhost:8000
SURREAL_USER=root
SURREAL_PASS=root
KEYDB_URL=redis://localhost:6379
MINIO_ENDPOINT=http://localhost:9000
```

### Testing (`.test.env`)
Copy from template:
```bash
cp .test.env.example .test.env
source .test.env
./scripts/test-e2e.sh
```

### AWS Deployment (`.env.aws`)
Required for deploy scripts:
```bash
AWS_REGION=us-east-1
AWS_PROFILE=default
AWS_ACCOUNT_ID=123456789
```

## Common Workflows

### Fresh Local Setup
```bash
./scripts/setup.sh
npm run dev
```

### Run Tests
```bash
source .test.env
./scripts/test-e2e.sh
./scripts/health-check.sh
```

### Clean Data for Testing
```bash
source .test.env
./scripts/db-flush.sh
```

### Deploy to AWS
```bash
./scripts/deploy-complete.sh --stack-name draehi-prod
```

Or deploy individual components:
```bash
./scripts/deploy-surrealdb-eks.sh --stack-name draehi-surrealdb
./scripts/deploy-keydb-eks.sh --stack-name draehi-keydb --mode elasticache
./scripts/deploy-s3-assets.sh --stack-name draehi
./scripts/deploy-ec2.sh --stack-name draehi --image <uri>
```

## Troubleshooting

### Docker Permission Denied
Scripts automatically fix this on Linux:
```bash
./scripts/docker-setup.sh start
# Scripts will add you to docker group and prompt for logout
```

### Services Not Starting
```bash
# Check status
./scripts/health-check.sh

# View logs
./scripts/docker-setup.sh logs surrealdb
./scripts/docker-setup.sh logs surrealist
./scripts/docker-setup.sh logs keydb

# Verify containers
docker ps
```

### Database Issues
```bash
# Check database health
curl http://localhost:8000/health

# View SurrealDB logs
./scripts/docker-setup.sh logs surrealdb

# Flush and reinitialize
./scripts/db-flush.sh
./scripts/setup-databases.sh
```

### AWS Deployment Issues

**EKS Cluster Not Found:**
```bash
aws eks list-clusters --region us-east-1
```

**Image Push Failure:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin {account-id}.dkr.ecr.us-east-1.amazonaws.com
docker push {image-uri}
```

## Script Standards

All scripts follow [BASH_GUIDELINES.md](../docs/BASH_GUIDELINES.md):

✅ **Safety**
- `set -euo pipefail` for safe execution
- Cleanup traps for temporary files
- Error handling with clear messages

✅ **Usability**
- Status indicators (✅ ❌ ⚠️ ℹ️)
- Progress tracking
- Clear help text

✅ **Reliability**
- Idempotent operations
- Docker permission handling
- Cross-platform support (Linux/macOS)

## Contributing

When adding new scripts:
1. Follow script header format from [BASH_GUIDELINES.md](../docs/BASH_GUIDELINES.md)
2. Implement cleanup trap
3. Add clear user feedback
4. Document usage in this README
5. Make executable: `chmod +x scripts/your-script.sh`

## Related Documentation

- [BASH_GUIDELINES.md](../docs/BASH_GUIDELINES.md) - Script writing standards
- [OPERATIONS.md](../docs/OPERATIONS.md) - Development operations
- [DATABASE.md](../docs/DATABASE.md) - Database reference
- [CLAUDE.md](../CLAUDE.md) - Project overview
