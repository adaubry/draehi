# Bash Script Guidelines for Draehi

Industry best practices for production-grade bash scripts.

## Core Principles

1. **Safety First** - Never leave system in broken state
2. **Idempotent** - Safe to run multiple times
3. **Self-Cleaning** - Clean up on success AND failure
4. **User-Friendly** - Clear feedback at every step
5. **Portable** - Works across Unix systems (macOS/Linux)

---

## Script Header (MANDATORY)

Every script must start with:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Script description
# Usage: ./script-name.sh [args]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Trap for cleanup on exit
trap cleanup EXIT ERR INT TERM
```

### Flags Explained

- `set -e` - Exit on any error
- `set -u` - Exit on undefined variable
- `set -o pipefail` - Pipe fails if any command fails

---

## Cleanup Pattern (MANDATORY)

Always implement cleanup for temporary resources:

```bash
# Track what needs cleanup
TEMP_FILES=()
TEMP_DIRS=()
CLEANUP_NEEDED=false

cleanup() {
    local exit_code=$?

    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo
        echo "🧹 Cleaning up..."

        # Remove temporary files
        for file in "${TEMP_FILES[@]}"; do
            [[ -f "$file" ]] && rm -f "$file"
        done

        # Remove temporary directories
        for dir in "${TEMP_DIRS[@]}"; do
            [[ -d "$dir" ]] && rm -rf "$dir"
        done
    fi

    # Only show success if exit code is 0
    if [[ $exit_code -eq 0 ]]; then
        echo "✅ Complete"
    else
        echo "❌ Failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

# Register cleanup trap
trap cleanup EXIT ERR INT TERM
```

### Usage Example

```bash
# Create temp dir and register for cleanup
TEMP_DIR=$(mktemp -d)
TEMP_DIRS+=("${TEMP_DIR}")
CLEANUP_NEEDED=true

# Create temp file and register for cleanup
TEMP_FILE=$(mktemp)
TEMP_FILES+=("${TEMP_FILE}")
```

---

## Error Handling

### Check Prerequisites

```bash
check_command() {
    local cmd=$1
    local install_msg=$2

    if ! command -v "${cmd}" &> /dev/null; then
        echo "❌ ${cmd} not found"
        echo "${install_msg}"
        exit 1
    fi

    echo "✅ ${cmd} found"
}

# Usage
check_command "git" "Install Git: https://git-scm.com"
check_command "node" "Install Node.js 20+: https://nodejs.org"
```

### Check Permissions

```bash
check_write_permission() {
    local dir=$1

    if [[ ! -w "${dir}" ]]; then
        echo "❌ No write permission for ${dir}"
        echo "Run with appropriate permissions or choose different directory"
        exit 1
    fi
}

# Usage
check_write_permission "${PROJECT_ROOT}"
```

### Validate Required Arguments

```bash
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <required-arg>"
    exit 1
fi

REQUIRED_ARG=$1
```

---

## User Feedback

### Status Indicators

```bash
echo "✅ Success message"
echo "❌ Error message"
echo "⚠️  Warning message"
echo "📦 Installing..."
echo "🔄 Processing..."
echo "🧹 Cleaning up..."
echo "ℹ️  Info message"
```

### Progress Indication

```bash
echo "=== Step 1/5: Description ==="
echo
# ... do work
echo

echo "=== Step 2/5: Description ==="
echo
# ... do work
```

### Confirmation Prompts

```bash
read -p "Continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted by user"
    exit 0
fi
```

---

## Platform Detection

```bash
detect_platform() {
    case "${OSTYPE}" in
        linux*)   echo "linux" ;;
        darwin*)  echo "macos" ;;
        *)        echo "unknown" ;;
    esac
}

PLATFORM=$(detect_platform)

case "${PLATFORM}" in
    linux)
        echo "Running on Linux"
        ;;
    macos)
        echo "Running on macOS"
        ;;
    *)
        echo "❌ Unsupported platform: ${OSTYPE}"
        exit 1
        ;;
esac
```

---

## Installation Pattern

### Safe Download & Build

```bash
install_from_source() {
    local repo_url=$1
    local binary_name=$2

    # Check if already installed
    if command -v "${binary_name}" &> /dev/null; then
        echo "✅ ${binary_name} already installed"
        return 0
    fi

    echo "📦 Installing ${binary_name} from source..."

    # Create temp dir and register for cleanup
    local temp_dir=$(mktemp -d)
    TEMP_DIRS+=("${temp_dir}")
    CLEANUP_NEEDED=true

    # Save current dir
    local original_dir=$(pwd)

    (
        cd "${temp_dir}"

        echo "Cloning repository..."
        if ! git clone "${repo_url}" repo; then
            echo "❌ Failed to clone repository"
            exit 1
        fi

        cd repo

        echo "Building..."
        if ! cargo build --release; then
            echo "❌ Build failed"
            exit 1
        fi

        echo "Installing..."
        if ! cargo install --path .; then
            echo "❌ Installation failed"
            exit 1
        fi

        echo "✅ ${binary_name} installed successfully"
    )

    # Return to original directory
    cd "${original_dir}"
}

# Usage
install_from_source "https://github.com/user/repo.git" "binary-name"
```

---

## Docker Setup Pattern

### Create Docker Group if Missing

```bash
ensure_docker_group() {
    if ! getent group docker &> /dev/null; then
        echo "→ Creating docker group..."
        if ! sudo groupadd docker; then
            echo "❌ Failed to create docker group"
            return 1
        fi
        echo "✅ Docker group created"
    fi
    return 0
}

# Usage
if ! ensure_docker_group; then
    exit 1
fi
```

### Fix Docker Permissions (Complete Pattern)

```bash
# Helper function to ensure docker group exists
ensure_docker_group() {
    if ! getent group docker &> /dev/null; then
        echo "→ Creating docker group..."
        if ! sudo groupadd docker; then
            echo "❌ Failed to create docker group"
            return 1
        fi
        echo "✅ Docker group created"
    fi
    return 0
}

# Helper function to fix docker permissions
fix_docker_permissions() {
    # Only applicable on Linux
    if [[ "${OSTYPE}" != "linux"* ]]; then
        echo "❌ Cannot access Docker"
        echo "Make sure Docker Desktop is running"
        return 1
    fi

    echo "⚠️  Docker permission denied"
    echo

    # Ensure docker group exists
    if ! ensure_docker_group; then
        return 1
    fi

    # Check if user is in docker group
    if ! groups "${USER}" | grep -q '\bdocker\b'; then
        echo "→ Adding ${USER} to docker group..."
        if ! sudo usermod -aG docker "${USER}"; then
            echo "❌ Failed to add user to docker group"
            return 1
        fi

        echo "✅ User added to docker group"
        echo
        echo "⚠️  IMPORTANT: Log out and log back in to apply changes"
        echo
        read -p "Log out now? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "After logging back in, run this script again"
            exit 0
        else
            echo "❌ Cannot continue without Docker permissions"
            echo
            echo "Please log out and log back in, then run this script again"
            return 1
        fi
    fi

    return 0
}

# Usage
if ! docker ps &> /dev/null; then
    if ! fix_docker_permissions; then
        exit 1
    fi
fi

echo "✅ Docker permissions OK"
```

**Key features:**
- Platform detection (Linux-specific)
- Proper error handling with return codes
- Creates docker group if missing
- Adds user to group with validation
- User prompt for logout
- Clear exit paths

---

## Logging Pattern

```bash
# Log file setup
LOG_FILE="${PROJECT_ROOT}/logs/setup-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "${LOG_FILE}")"

log() {
    local message=$1
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ${message}" | tee -a "${LOG_FILE}"
}

# Usage
log "Starting installation..."
log "✅ Installation complete"
```

---

## Testing Scripts

### Dry Run Mode

```bash
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo
fi

run_command() {
    local cmd=$*

    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "[DRY RUN] Would run: ${cmd}"
    else
        eval "${cmd}"
    fi
}

# Usage
run_command "npm install"
run_command "cargo build --release"
```

---

## Complete Example

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install example tool
# Usage: ./install-tool.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cleanup tracking
TEMP_FILES=()
TEMP_DIRS=()
CLEANUP_NEEDED=false

cleanup() {
    local exit_code=$?

    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo
        echo "🧹 Cleaning up temporary files..."

        for file in "${TEMP_FILES[@]}"; do
            [[ -f "$file" ]] && rm -f "$file"
        done

        for dir in "${TEMP_DIRS[@]}"; do
            [[ -d "$dir" ]] && rm -rf "$dir"
        done
    fi

    if [[ $exit_code -eq 0 ]]; then
        echo "✅ Installation complete"
    else
        echo "❌ Installation failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

echo "=== Installing Example Tool ==="
echo

# Check prerequisites
if ! command -v git &> /dev/null; then
    echo "❌ Git not found. Please install Git first."
    exit 1
fi

echo "✅ Git found"

# Install tool
if command -v example-tool &> /dev/null; then
    echo "✅ example-tool already installed"
else
    echo "📦 Installing example-tool..."

    # Create temp dir
    TEMP_DIR=$(mktemp -d)
    TEMP_DIRS+=("${TEMP_DIR}")
    CLEANUP_NEEDED=true

    (
        cd "${TEMP_DIR}"
        git clone https://github.com/user/repo.git
        cd repo
        cargo install --path .
    )

    echo "✅ example-tool installed"
fi
```

---

## Checklist for New Scripts

- [ ] Starts with `#!/usr/bin/env bash`
- [ ] Has `set -euo pipefail`
- [ ] Implements cleanup trap
- [ ] Tracks temp files/dirs for cleanup
- [ ] Checks prerequisites before proceeding
- [ ] Provides clear user feedback (✅/❌/⚠️)
- [ ] Handles errors gracefully
- [ ] Works on macOS and Linux
- [ ] Is idempotent (safe to rerun)
- [ ] Documents usage in header comment
- [ ] Cleans up on both success AND failure

---

## Next.js Server Execution Pattern

### Problem: PATH and Environment in Node.js

When executing shell commands from Next.js server components or API routes:

**Issue:**
- Node.js doesn't inherit shell configuration (`.bashrc`, `.zshrc`)
- `process.env.PATH` may not include user-installed binaries
- Commands like `which`, `cargo`, custom bins fail

**Bad Pattern:**
```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ❌ This will fail if binary not in Node.js PATH
await execAsync("export-logseq-notes --help");
await execAsync("which my-tool");
```

**Good Pattern:**
```typescript
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

/**
 * Execute command with explicit PATH configuration
 * Ensures user binaries (cargo, npm, custom) are accessible
 */
async function execWithPath(
  command: string,
  options: any = {}
): Promise<{ stdout: string; stderr: string }> {
  // Build extended PATH with common binary locations
  const paths = [
    process.env.PATH || "",
    process.env.CARGO_BIN_PATH || path.join(process.env.HOME || "", ".cargo/bin"),
    path.join(process.env.HOME || "", ".local/bin"),
    "/usr/local/bin",
    "/usr/bin",
  ].filter(Boolean);

  const extendedPath = paths.join(":");

  return execAsync(command, {
    ...options,
    env: {
      ...process.env,
      ...options.env,
      PATH: extendedPath,
    },
  });
}

// ✅ Use extended PATH
await execWithPath("export-logseq-notes --help");
```

### Environment Variable Configuration

**Add to `.env.local`:**
```bash
# Rust cargo binaries (for export-logseq-notes)
CARGO_BIN_PATH=/home/user/.cargo/bin
```

**Add to `.env.example`:**
```bash
# Binary paths (auto-detected during setup)
CARGO_BIN_PATH=$HOME/.cargo/bin
```

### Binary Existence Check Pattern

**Bad:**
```typescript
// ❌ Relies on PATH, throws error
try {
  await execAsync("which my-tool");
} catch {
  throw new Error("my-tool not found");
}
```

**Good:**
```typescript
import fs from "fs/promises";

// ✅ Check multiple locations explicitly
async function findBinary(name: string): Promise<string | null> {
  const locations = [
    process.env.CARGO_BIN_PATH && path.join(process.env.CARGO_BIN_PATH, name),
    path.join(process.env.HOME || "", ".cargo/bin", name),
    path.join(process.env.HOME || "", ".local/bin", name),
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ].filter(Boolean) as string[];

  for (const location of locations) {
    try {
      await fs.access(location, fs.constants.X_OK);
      return location;
    } catch {
      continue;
    }
  }

  return null;
}

// Usage
const binaryPath = await findBinary("export-logseq-notes");
if (!binaryPath) {
  throw new Error("export-logseq-notes not found. Install with: cargo install ...");
}

await execAsync(`"${binaryPath}" --help`);
```

### Setup Script Integration

Setup scripts should configure environment variables:

```bash
# scripts/install-rust-tools.sh

echo "→ Configuring environment..."

# Add to .env.local if not present
if ! grep -q "CARGO_BIN_PATH" .env.local 2>/dev/null; then
    echo "" >> .env.local
    echo "# Rust cargo binaries" >> .env.local
    echo "CARGO_BIN_PATH=$HOME/.cargo/bin" >> .env.local
    echo "✅ Added CARGO_BIN_PATH to .env.local"
fi
```

### Why This Matters

**Development:**
- Next.js dev server runs as Node.js process
- Doesn't source shell config
- Inherits parent process environment only

**Production:**
- Systemd, Docker, PM2 have minimal PATH
- No shell configuration loaded
- Must explicitly configure binary locations

**CI/CD:**
- GitHub Actions, GitLab CI have different PATH
- Must install and configure explicitly

### Complete Example

```typescript
"use server";

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

/**
 * Find binary in common locations
 */
async function findBinary(name: string): Promise<string | null> {
  const locations = [
    process.env.CARGO_BIN_PATH && path.join(process.env.CARGO_BIN_PATH, name),
    path.join(process.env.HOME || "", ".cargo/bin", name),
    path.join(process.env.HOME || "", ".local/bin", name),
    `/usr/local/bin/${name}`,
  ].filter(Boolean) as string[];

  for (const location of locations) {
    try {
      await fs.access(location, fs.constants.X_OK);
      return location;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Execute with extended PATH
 */
async function execWithPath(
  command: string,
  options: any = {}
): Promise<{ stdout: string; stderr: string }> {
  const paths = [
    process.env.PATH || "",
    process.env.CARGO_BIN_PATH || path.join(process.env.HOME || "", ".cargo/bin"),
    path.join(process.env.HOME || "", ".local/bin"),
  ].filter(Boolean);

  return execAsync(command, {
    ...options,
    env: { ...process.env, PATH: paths.join(":") },
  });
}

// Use in your code
export async function runTool() {
  const toolPath = await findBinary("my-tool");
  if (!toolPath) {
    return { success: false, error: "my-tool not found" };
  }

  const { stdout } = await execWithPath(`"${toolPath}" --output json`);
  return { success: true, output: stdout };
}
```

---

**Last Updated:** 2025-11-16
