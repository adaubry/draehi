import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/surreal";
import { syncRepository } from "@/modules/git/sync";
import { GitRepository } from "@/modules/git/schema";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature for verification
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    // Only process push events
    if (event !== "push") {
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }

    const body = await request.json();

    // Extract repository URL from payload
    const repoUrl = body.repository?.clone_url || body.repository?.html_url;
    const branch = body.ref?.replace("refs/heads/", "");

    if (!repoUrl || !branch) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    // Find matching repository in database
    const repositories = await query<GitRepository>(
      `SELECT * FROM git_repositories WHERE repo_url = $repo_url`,
      { repo_url: repoUrl }
    );

    const repository = repositories[0];

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Only sync if branch matches
    if (repository.branch !== branch) {
      return NextResponse.json(
        { message: "Branch mismatch, ignoring" },
        { status: 200 }
      );
    }

    // Trigger sync (don't await - run in background)
    if (repository.deploy_key) {
      syncRepository(
        repository.workspace,
        repository.repo_url,
        repository.branch,
        repository.deploy_key
      ).catch((error) => {
        console.error("Webhook sync failed:", error);
      });
    }

    return NextResponse.json(
      { message: "Deployment triggered" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Verify GitHub webhook signature
function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
