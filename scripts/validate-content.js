#!/usr/bin/env node

/**
 * Content validation script
 * Validates that Logseq content was ingested correctly
 */

import { db } from '../lib/db.js';
import { nodes } from '../modules/content/schema.js';
import { eq } from 'drizzle-orm';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${COLORS.reset}`);
}

async function validateContent() {
  console.log(`\n${COLORS.blue}╔════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.blue}║  Content Validation Report           ║${COLORS.reset}`);
  console.log(`${COLORS.blue}╚════════════════════════════════════════╝${COLORS.reset}\n`);

  let errors = 0;
  let warnings = 0;

  try {
    // Get all nodes
    const allNodes = await db.query.nodes.findMany();
    const pages = allNodes.filter(n => n.nodeType === 'page');
    const blocks = allNodes.filter(n => n.nodeType === 'block');

    // Basic counts
    console.log(`${COLORS.blue}📊 Statistics:${COLORS.reset}`);
    log(COLORS.green, '✓', `Total nodes: ${allNodes.length}`);
    log(COLORS.green, '✓', `Pages: ${pages.length}`);
    log(COLORS.green, '✓', `Blocks: ${blocks.length}`);
    console.log('');

    // Page breakdown
    console.log(`${COLORS.blue}📄 Page Breakdown:${COLORS.reset}`);
    const journalPages = pages.filter(p => p.isJournal);
    const regularPages = pages.filter(p => !p.isJournal);
    log(COLORS.green, '✓', `Regular pages: ${regularPages.length}`);
    log(COLORS.green, '✓', `Journal pages: ${journalPages.length}`);
    console.log('');

    // Expected metrics for Logseq docs graph
    console.log(`${COLORS.blue}📊 Expected Metrics (Logseq Docs):${COLORS.reset}`);
    const EXPECTED_TOTAL_PAGES = 917;
    const EXPECTED_REGULAR_PAGES = 695;
    const EXPECTED_JOURNALS = EXPECTED_TOTAL_PAGES - EXPECTED_REGULAR_PAGES; // ~222

    // Check total pages (within 5% tolerance)
    const pageTolerance = Math.floor(EXPECTED_TOTAL_PAGES * 0.05);
    if (Math.abs(pages.length - EXPECTED_TOTAL_PAGES) <= pageTolerance) {
      log(COLORS.green, '✓', `Total pages: ${pages.length} (expected ~${EXPECTED_TOTAL_PAGES})`);
    } else {
      log(COLORS.yellow, '⚠', `Total pages: ${pages.length} (expected ~${EXPECTED_TOTAL_PAGES})`);
      warnings++;
    }

    // Check regular pages
    const regularTolerance = Math.floor(EXPECTED_REGULAR_PAGES * 0.05);
    if (Math.abs(regularPages.length - EXPECTED_REGULAR_PAGES) <= regularTolerance) {
      log(COLORS.green, '✓', `Regular pages: ${regularPages.length} (expected ~${EXPECTED_REGULAR_PAGES})`);
    } else {
      log(COLORS.yellow, '⚠', `Regular pages: ${regularPages.length} (expected ~${EXPECTED_REGULAR_PAGES})`);
      warnings++;
    }

    // Check journals
    const journalTolerance = Math.floor(EXPECTED_JOURNALS * 0.05);
    if (Math.abs(journalPages.length - EXPECTED_JOURNALS) <= journalTolerance) {
      log(COLORS.green, '✓', `Journal pages: ${journalPages.length} (expected ~${EXPECTED_JOURNALS})`);
    } else {
      log(COLORS.yellow, '⚠', `Journal pages: ${journalPages.length} (expected ~${EXPECTED_JOURNALS})`);
      warnings++;
    }
    console.log('');

    // Check for page references in HTML
    console.log(`${COLORS.blue}🔗 Page References:${COLORS.reset}`);
    const blocksWithPageRefs = blocks.filter(b =>
      b.html && b.html.includes('class="page-reference"')
    );
    if (blocksWithPageRefs.length > 0) {
      log(COLORS.green, '✓', `Found ${blocksWithPageRefs.length} blocks with page references`);
    } else {
      log(COLORS.red, '✗', 'No page references found in HTML');
      errors++;
    }
    console.log('');

    // Check for block references in HTML
    console.log(`${COLORS.blue}🔗 Block References:${COLORS.reset}`);
    const blocksWithBlockRefs = blocks.filter(b =>
      b.html && b.html.includes('class="block-reference"')
    );
    if (blocksWithBlockRefs.length > 0) {
      log(COLORS.green, '✓', `Found ${blocksWithBlockRefs.length} blocks with block references`);
    } else {
      log(COLORS.yellow, '⚠', 'No block references found in HTML');
      warnings++;
    }
    console.log('');

    // Check for task markers
    console.log(`${COLORS.blue}✅ Task Markers:${COLORS.reset}`);
    const taskTypes = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW'];
    for (const taskType of taskTypes) {
      const blocksWithTask = blocks.filter(b =>
        b.html && b.html.includes(`class="task-marker task-${taskType.toLowerCase()}"`)
      );
      if (blocksWithTask.length > 0) {
        log(COLORS.green, '✓', `${taskType}: ${blocksWithTask.length} blocks`);
      } else {
        log(COLORS.yellow, '⚠', `${taskType}: No blocks found`);
        warnings++;
      }
    }
    console.log('');

    // Check for priority levels
    console.log(`${COLORS.blue}⭐ Priority Levels:${COLORS.reset}`);
    const priorities = ['A', 'B', 'C'];
    for (const priority of priorities) {
      const blocksWithPriority = blocks.filter(b =>
        b.html && b.html.includes(`class="priority priority-${priority}"`)
      );
      if (blocksWithPriority.length > 0) {
        log(COLORS.green, '✓', `[#${priority}]: ${blocksWithPriority.length} blocks`);
      } else {
        log(COLORS.yellow, '⚠', `[#${priority}]: No blocks found`);
        warnings++;
      }
    }
    console.log('');

    // Check block hierarchy
    console.log(`${COLORS.blue}🌳 Block Hierarchy:${COLORS.reset}`);
    const blocksWithParent = blocks.filter(b => b.parentId !== null);
    const orphanBlocks = blocks.filter(b => b.parentId === null);
    log(COLORS.green, '✓', `Blocks with parent: ${blocksWithParent.length}`);
    if (orphanBlocks.length > 0) {
      log(COLORS.yellow, '⚠', `Orphan blocks: ${orphanBlocks.length}`);
      warnings++;
    }
    console.log('');

    // Check block UUIDs
    console.log(`${COLORS.blue}🔑 Block UUIDs:${COLORS.reset}`);
    const blocksWithUuid = blocks.filter(b => b.blockUuid !== null);
    const blocksWithoutUuid = blocks.filter(b => b.blockUuid === null);
    log(COLORS.green, '✓', `Blocks with UUID: ${blocksWithUuid.length}`);
    if (blocksWithoutUuid.length > 0) {
      log(COLORS.yellow, '⚠', `Blocks without UUID: ${blocksWithoutUuid.length}`);
      warnings++;
    }
    console.log('');

    // Summary
    console.log(`${COLORS.blue}╔════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.blue}║  Validation Summary                   ║${COLORS.reset}`);
    console.log(`${COLORS.blue}╚════════════════════════════════════════╝${COLORS.reset}`);
    if (errors === 0 && warnings === 0) {
      log(COLORS.green, '✓', 'All checks passed!');
    } else {
      if (errors > 0) {
        log(COLORS.red, '✗', `${errors} error(s) found`);
      }
      if (warnings > 0) {
        log(COLORS.yellow, '⚠', `${warnings} warning(s) found`);
      }
    }
    console.log('');

    process.exit(errors > 0 ? 1 : 0);

  } catch (error) {
    console.error(`\n${COLORS.red}Fatal error:${COLORS.reset}`, error);
    process.exit(1);
  }
}

validateContent();
