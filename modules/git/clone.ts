import { exec } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function cloneRepository(
  repoUrl: string,
  branch: string,
  accessToken: string
): Promise<CloneResult> {
  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), "draehi-"));

    // Construct authenticated URL
    const urlWithAuth = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`
    );

    // Clone repository
    const cloneCmd = `git clone --depth 1 --branch ${branch} ${urlWithAuth} ${tempDir}`;
    await execAsync(cloneCmd, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return {
      success: true,
      path: tempDir,
    };
  } catch (error) {
    // Clean up temp dir if clone failed
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function pullRepository(
  repoPath: string,
  branch: string
): Promise<CloneResult> {
  try {
    // Pull latest changes
    const pullCmd = `cd ${repoPath} && git pull origin ${branch}`;
    await execAsync(pullCmd, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      success: true,
      path: repoPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function cleanupRepository(repoPath: string): Promise<void> {
  try {
    await rm(repoPath, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to cleanup repository:", error);
  }
}

export async function getLatestCommit(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd ${repoPath} && git rev-parse HEAD`);
    return stdout.trim();
  } catch (error) {
    throw new Error(
      `Failed to get commit SHA: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
