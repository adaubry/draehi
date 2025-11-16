import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

/**
 * Find binary in common locations
 * Checks multiple paths to locate executables that may not be in Next.js PATH
 *
 * @param name - Binary name (e.g., "export-logseq-notes", "git")
 * @returns Absolute path to binary, or null if not found
 */
export async function findBinary(name: string): Promise<string | null> {
  const locations = [
    // User-configured path from environment
    process.env.CARGO_BIN_PATH && path.join(process.env.CARGO_BIN_PATH, name),
    // Standard cargo installation
    path.join(process.env.HOME || "", ".cargo/bin", name),
    // User local binaries
    path.join(process.env.HOME || "", ".local/bin", name),
    // System-wide locations
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

/**
 * Execute shell command with extended PATH
 * Ensures user-installed binaries (cargo, npm, etc.) are accessible
 *
 * @param command - Shell command to execute
 * @param options - exec options (cwd, env, timeout, maxBuffer, etc.)
 * @returns stdout and stderr from command
 */
export async function execWithPath(
  command: string,
  options: Parameters<typeof execAsync>[1] = {}
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

  const result = await execAsync(command, {
    ...options,
    env: {
      ...process.env,
      ...(options?.env || {}),
      PATH: extendedPath,
    },
  });

  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

/**
 * Check if binary exists in any common location
 * Fast check without actually executing the binary
 *
 * @param name - Binary name
 * @returns true if binary exists and is executable
 */
export async function binaryExists(name: string): Promise<boolean> {
  const binaryPath = await findBinary(name);
  return binaryPath !== null;
}
