#!/usr/bin/env tsx

/**
 * Compare Draehi structure against official Logseq docs
 * Validates we're creating the right pages/nodes
 */

import { db } from "../lib/db";
import * as contentSchema from "../modules/content/schema";
import { eq } from "drizzle-orm";

const LOGSEQ_DOCS_BASE = "https://docs.logseq.com";

interface PageCheck {
  name: string;
  logseqUrl: string;
  found: boolean;
  hasBlocks: boolean;
}

// Key pages from Logseq docs that should exist
const EXPECTED_PAGES = [
  { name: "contents", logseqUrl: "#/page/contents" },
  { name: "Tutorial", logseqUrl: "#/page/Tutorial" },
  { name: "Queries", logseqUrl: "#/page/Queries" },
  { name: "Shortcuts", logseqUrl: "#/page/Shortcuts" },
  { name: "Term Portal", logseqUrl: "#/page/Term%20Portal" },
  { name: "FAQ", logseqUrl: "#/page/FAQ" },
  { name: "Publishing (Desktop App Only)", logseqUrl: "#/page/Publishing%20(Desktop%20App%20Only)" },
];

async function checkPageExists(
  pageName: string,
  logseqUrl: string
): Promise<PageCheck> {
  console.log(`\n📄 Checking: ${pageName}`);
  console.log(`   Reference: ${LOGSEQ_DOCS_BASE}/${logseqUrl}`);

  try {
    // Check if page exists in database
    const page = await db.query.nodes.findFirst({
      where: (nodes, { and, eq }) =>
        and(
          eq(nodes.nodeType, "page"),
          eq(nodes.pageName, pageName)
        ),
    });

    if (!page) {
      console.log(`   ❌ Page not found in database`);
      return {
        name: pageName,
        logseqUrl,
        found: false,
        hasBlocks: false,
      };
    }

    console.log(`   ✅ Page found (slug: ${page.slug})`);

    // Check if page has blocks
    const blocks = await db.query.nodes.findMany({
      where: (nodes, { and, eq }) =>
        and(
          eq(nodes.nodeType, "block"),
          eq(nodes.pageName, pageName)
        ),
      limit: 1,
    });

    const hasBlocks = blocks.length > 0;
    console.log(`   ${hasBlocks ? "✅" : "⚠️"} Has blocks: ${hasBlocks ? "yes" : "no"}`);

    return {
      name: pageName,
      logseqUrl,
      found: true,
      hasBlocks,
    };
  } catch (error) {
    console.error(`   ❌ Error checking page: ${error}`);
    return {
      name: pageName,
      logseqUrl,
      found: false,
      hasBlocks: false,
    };
  }
}

async function checkDatabaseStats() {
  console.log("\n📊 Database Statistics:");

  // Count pages
  const pages = await db.query.nodes.findMany({
    where: eq(contentSchema.nodes.nodeType, "page"),
  });

  console.log(`   Total pages: ${pages.length}`);

  // Count blocks
  const blocks = await db.query.nodes.findMany({
    where: eq(contentSchema.nodes.nodeType, "block"),
  });

  console.log(`   Total blocks: ${blocks.length}`);

  // Count journals
  const journals = pages.filter((p) => p.isJournal);
  console.log(`   Journal pages: ${journals.length}`);

  // Check namespace pages
  const namespacedPages = pages.filter((p) => p.namespace);
  console.log(`   Namespaced pages: ${namespacedPages.length}`);

  // Block quality checks
  console.log("\n🧱 Block Quality:");

  const blocksWithUUID = blocks.filter((b) => b.blockUuid !== null);
  console.log(`   Blocks with UUID: ${blocksWithUUID.length}/${blocks.length}`);

  const blocksWithHTML = blocks.filter((b) => b.html !== null);
  console.log(`   Blocks with HTML: ${blocksWithHTML.length}/${blocks.length}`);

  const blocksWithParent = blocks.filter((b) => b.parentId !== null);
  console.log(`   Blocks with parent: ${blocksWithParent.length}/${blocks.length}`);

  // Sample some blocks to check HTML quality
  const sampleBlocks = blocks.slice(0, 5);
  let blocksWithPageRefs = 0;
  let blocksWithBlockRefs = 0;

  for (const block of sampleBlocks) {
    if (block.html?.includes('class="page-reference"')) {
      blocksWithPageRefs++;
    }
    if (block.html?.includes('class="block-reference"')) {
      blocksWithBlockRefs++;
    }
  }

  if (sampleBlocks.length > 0) {
    console.log(`   Sample blocks with page refs: ${blocksWithPageRefs}/${sampleBlocks.length}`);
    console.log(`   Sample blocks with block refs: ${blocksWithBlockRefs}/${sampleBlocks.length}`);
  }

  return {
    totalPages: pages.length,
    totalBlocks: blocks.length,
    totalJournals: journals.length,
    namespacedPages: namespacedPages.length,
    blocksWithUUID: blocksWithUUID.length,
    blocksWithHTML: blocksWithHTML.length,
    blocksWithParent: blocksWithParent.length,
  };
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  Logseq Structure Comparison Test     ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log(`Reference: ${LOGSEQ_DOCS_BASE}`);
  console.log(`Testing:   Database content`);
  console.log("");

  // Check database stats
  const stats = await checkDatabaseStats();

  // Expected stats (Logseq docs graph)
  const expectedPages = 238;
  const expectedJournals = 75;

  console.log("\n📈 Expected vs Actual:");
  console.log(`   Pages:    Expected ~${expectedPages}, Got ${stats.totalPages}`);
  console.log(`   Journals: Expected ~${expectedJournals}, Got ${stats.totalJournals}`);

  const pageMatch = Math.abs(stats.totalPages - expectedPages) / expectedPages;
  const journalMatch = Math.abs(stats.totalJournals - expectedJournals) / expectedJournals;

  const issues: string[] = [];

  if (pageMatch > 0.1) {
    // 10% tolerance
    issues.push(
      `Page count off by ${(pageMatch * 100).toFixed(1)}% (expected ~${expectedPages}, got ${stats.totalPages})`
    );
  }

  if (journalMatch > 0.1) {
    issues.push(
      `Journal count off by ${(journalMatch * 100).toFixed(1)}% (expected ~${expectedJournals}, got ${stats.totalJournals})`
    );
  }

  // Check specific important pages
  console.log("\n📋 Key Pages Check:");
  const pageChecks = await Promise.all(
    EXPECTED_PAGES.map((p) => checkPageExists(p.name, p.logseqUrl))
  );

  const missingPages = pageChecks.filter((p) => !p.found);
  const pagesWithoutBlocks = pageChecks.filter((p) => p.found && !p.hasBlocks);

  // Summary
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║  Summary                               ║");
  console.log("╚════════════════════════════════════════╝");

  console.log(`\n📊 Statistics:`);
  console.log(`   ✅ Total pages: ${stats.totalPages}`);
  console.log(`   ✅ Total blocks: ${stats.totalBlocks}`);
  console.log(`   ✅ Journals: ${stats.totalJournals}`);
  console.log(`   ✅ Namespaced: ${stats.namespacedPages}`);

  console.log(`\n🧱 Block Quality:`);
  const uuidPercent = (stats.blocksWithUUID / stats.totalBlocks) * 100;
  const htmlPercent = (stats.blocksWithHTML / stats.totalBlocks) * 100;
  const parentPercent = (stats.blocksWithParent / stats.totalBlocks) * 100;

  console.log(`   ${uuidPercent > 90 ? "✅" : "⚠️"} Blocks with UUID: ${uuidPercent.toFixed(1)}%`);
  console.log(`   ${htmlPercent > 90 ? "✅" : "⚠️"} Blocks with HTML: ${htmlPercent.toFixed(1)}%`);
  console.log(`   ${parentPercent > 80 ? "✅" : "⚠️"} Blocks with parent: ${parentPercent.toFixed(1)}%`);

  if (uuidPercent < 90) {
    issues.push(`Only ${uuidPercent.toFixed(1)}% of blocks have UUIDs (expected >90%)`);
  }
  if (htmlPercent < 90) {
    issues.push(`Only ${htmlPercent.toFixed(1)}% of blocks have HTML (expected >90%)`);
  }

  console.log(`\n📄 Key Pages:`);
  console.log(`   ✅ Found: ${pageChecks.length - missingPages.length}/${pageChecks.length}`);
  if (missingPages.length > 0) {
    console.log(`   ❌ Missing:`);
    missingPages.forEach((p) => console.log(`      - ${p.name}`));
    issues.push(`Missing ${missingPages.length} key pages`);
  }

  if (pagesWithoutBlocks.length > 0) {
    console.log(`   ⚠️  Pages without blocks:`);
    pagesWithoutBlocks.forEach((p) => console.log(`      - ${p.name}`));
  }

  if (issues.length > 0) {
    console.log("\n❌ Issues Found:");
    issues.forEach((issue) => console.log(`   - ${issue}`));
    console.log("\n⚠️  Draehi structure differs from Logseq docs");
    console.log("   Review issues above to improve import accuracy");
    process.exit(1);
  } else {
    console.log("\n🎉 Draehi successfully imported Logseq structure!");
    console.log("   All key pages present with expected counts");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
