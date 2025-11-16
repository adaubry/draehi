import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gitRepositories } from "@/modules/git/schema";
import { eq } from "drizzle-orm";
import { syncRepository } from "@/modules/git/sync";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature for verification
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    // Only process push events
    if (event !== "push") {
      return NextResponse.json(
        { message: "Event ignored" },
        { status: 200 }
      );
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
    const repository = await db.query.gitRepositories.findFirst({
      where: eq(gitRepositories.repoUrl, repoUrl),
    });

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
    if (repository.deployKey) {
      syncRepository(
        repository.workspaceId,
        repository.repoUrl,
        repository.branch,
        repository.deployKey
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
