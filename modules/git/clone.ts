import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { execWithPath } from "@/lib/shell";

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
  branch?: string; // Actual branch used (may differ from requested)
}

export async function getDefaultBranch(
  repoUrl: string,
  accessToken: string
): Promise<{ success: boolean; branch?: string; error?: string }> {
  try {
    const urlWithAuth = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`
    );

    // Use git ls-remote to get default branch
    const { stdout } = await execWithPath(
      `git ls-remote --symref ${urlWithAuth} HEAD`,
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      }
    );

    // Parse output: "ref: refs/heads/main	HEAD"
    const match = stdout.match(/ref: refs\/heads\/(\S+)/);
    if (match && match[1]) {
      return { success: true, branch: match[1] };
    }

    return { success: false, error: "Could not determine default branch" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function validateBranch(
  repoUrl: string,
  branch: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const urlWithAuth = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`
    );

    // List all branches
    const { stdout } = await execWithPath(
      `git ls-remote --heads ${urlWithAuth} refs/heads/${branch}`,
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      }
    );

    if (!stdout.trim()) {
      return {
        success: false,
        error: `Branch '${branch}' does not exist in repository`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function cloneRepository(
  repoUrl: string,
  branch: string,
  accessToken: string
): Promise<CloneResult> {
  let tempDir: string | null = null;
  let actualBranch = branch;

  try {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), "draehi-"));

    // Construct authenticated URL
    const urlWithAuth = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`
    );

    // Validate branch exists first
    const validation = await validateBranch(repoUrl, branch, accessToken);
    if (!validation.success) {
      // Auto-detect and use default branch instead
      const defaultBranch = await getDefaultBranch(repoUrl, accessToken);
      if (defaultBranch.success && defaultBranch.branch) {
        console.log(
          `Branch '${branch}' not found. Auto-switching to default branch '${defaultBranch.branch}'`
        );
        actualBranch = defaultBranch.branch;
      } else {
        return {
          success: false,
          error:
            validation.error ||
            "Branch validation failed and could not detect default branch",
        };
      }
    }

    // Clone repository with detected branch
    const cloneCmd = `git clone --depth 1 --branch ${actualBranch} ${urlWithAuth} ${tempDir}`;
    await execWithPath(cloneCmd, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return {
      success: true,
      path: tempDir,
      // Return actual branch used (may differ from requested)
      branch: actualBranch,
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

    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Provide helpful error messages
    if (errorMsg.includes("authentication failed")) {
      return {
        success: false,
        error:
          "Authentication failed. Please check your GitHub Personal Access Token has correct permissions.",
      };
    }

    if (errorMsg.includes("Repository not found")) {
      return {
        success: false,
        error:
          "Repository not found. Please check the URL and ensure your token has access to this repository.",
      };
    }

    return {
      success: false,
      error: errorMsg,
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
    await execWithPath(pullCmd, {
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
    const { stdout } = await execWithPath(`cd ${repoPath} && git rev-parse HEAD`);
    return stdout.trim();
  } catch (error) {
    throw new Error(
      `Failed to get commit SHA: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
