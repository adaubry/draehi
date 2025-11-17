#!/usr/bin/env tsx

/**
 * Diagnostic script to understand markdown parser behavior
 * Examines specific Logseq files to debug parsing issues
 */

import { parseLogseqMarkdown } from '../modules/logseq/markdown-parser';
import fs from 'fs/promises';
import path from 'path';

const TEST_REPO = '/home/adam/markdown_projects/draehi/test-data/logseq-docs-graph';
const PAGES_DIR = path.join(TEST_REPO, 'pages');
const JOURNALS_DIR = path.join(TEST_REPO, 'journals');

async function diagnosePage(filePath: string, pageName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${pageName}`);
  console.log('='.repeat(60));

  const rawContent = await fs.readFile(filePath, 'utf-8');
  console.log(`\n📝 Raw Content (${rawContent.length} chars):`);
  console.log(rawContent.slice(0, 200));
  if (rawContent.length > 200) console.log('...');

  const parseResult = parseLogseqMarkdown(rawContent, pageName);

  console.log(`\n🔍 Parse Result:`);
  console.log(`   Blocks: ${parseResult.blocks.length}`);
  console.log(`   Properties: ${Object.keys(parseResult.properties).length}`);
  if (Object.keys(parseResult.properties).length > 0) {
    console.log(`   Property keys: ${Object.keys(parseResult.properties).join(', ')}`);
  }

  if (parseResult.blocks.length > 0) {
    console.log(`\n📦 Blocks:`);
    parseResult.blocks.forEach((block, i) => {
      console.log(`   [${i}] UUID: ${block.uuid || 'null'} | Content: ${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}`);
    });

    const blocksWithUuid = parseResult.blocks.filter(b => b.uuid !== null);
    console.log(`\n   ✓ Blocks with UUID: ${blocksWithUuid.length}/${parseResult.blocks.length} (${((blocksWithUuid.length / parseResult.blocks.length) * 100).toFixed(1)}%)`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Markdown Parser Diagnostics          ║');
  console.log('╚════════════════════════════════════════╝');

  // Test property-only page
  await diagnosePage(
    path.join(PAGES_DIR, 'Academic.md'),
    'Academic'
  );

  // Test empty page
  await diagnosePage(
    path.join(PAGES_DIR, 'favorites.md'),
    'favorites'
  );

  // Test normal page with blocks
  await diagnosePage(
    path.join(PAGES_DIR, 'Contents.md'),
    'Contents'
  );

  // Test journal entry
  const journalFiles = await fs.readdir(JOURNALS_DIR);
  if (journalFiles.length > 0) {
    const firstJournal = journalFiles[0];
    await diagnosePage(
      path.join(JOURNALS_DIR, firstJournal),
      firstJournal.replace('.md', '')
    );
  }

  // Count all pages and journals
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Directory Analysis');
  console.log('='.repeat(60));

  const pageFiles = await fs.readdir(PAGES_DIR);
  const journalFiles2 = await fs.readdir(JOURNALS_DIR);

  console.log(`\nPages directory: ${pageFiles.length} files`);
  console.log(`Journals directory: ${journalFiles2.length} files`);
  console.log(`Total: ${pageFiles.length + journalFiles2.length} markdown files`);

  // Sample file types
  console.log(`\nSample page files (first 5):`);
  pageFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));

  console.log(`\nSample journal files (first 5):`);
  journalFiles2.slice(0, 5).forEach(f => console.log(`   - ${f}`));
}

main().catch(console.error);
