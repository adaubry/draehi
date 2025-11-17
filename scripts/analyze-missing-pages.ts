#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { exportLogseqNotes } from '../modules/logseq/export';
import { parseLogseqDirectory } from '../modules/logseq/markdown-parser';
import { parseLogseqOutput } from '../modules/logseq/parse';

const REPO_PATH = '/home/adam/markdown_projects/draehi/test-data/logseq-docs-graph';

async function analyzeMissingPages() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Missing Pages Analysis                ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 1. Parse markdown files
  console.log('📄 Parsing markdown files...');
  const pagesDir = path.join(REPO_PATH, 'pages');
  const markdownPages = await parseLogseqDirectory(pagesDir);
  console.log(`   Found ${markdownPages.length} markdown pages\n`);

  // 2. Export with Rust tool
  console.log('🔧 Running export tool...');
  const exportResult = await exportLogseqNotes(REPO_PATH);
  if (!exportResult.success || !exportResult.outputDir) {
    console.error('Export failed:', exportResult.error);
    return;
  }
  console.log(`   Export successful\n`);

  // 3. Parse HTML output
  console.log('📦 Parsing HTML output...');
  const parseResult = await parseLogseqOutput(exportResult.outputDir);
  if (!parseResult.success || !parseResult.pages) {
    console.error('Parse failed:', parseResult.error);
    return;
  }
  console.log(`   Found ${parseResult.pages.length} HTML pages\n`);

  // 4. Analyze matches
  console.log('🔍 Analyzing matches...\n');

  const matched: string[] = [];
  const notMatched: string[] = [];

  for (const mdPage of markdownPages) {
    // Apply same normalization as ingest function
    let normalizedMdName = mdPage.pageName;
    try {
      normalizedMdName = decodeURIComponent(normalizedMdName);
    } catch {
      // ignore
    }
    normalizedMdName = normalizedMdName
      .replace(/[?!\/\\:*"<>|]/g, "")
      .replace(/[\s\-]+/g, "_")
      .toLowerCase();

    const htmlPage = parseResult.pages.find((p) => p.name.toLowerCase() === normalizedMdName);

    if (htmlPage) {
      matched.push(mdPage.pageName);
    } else {
      notMatched.push(mdPage.pageName);
    }
  }

  console.log(`✅ Matched: ${matched.length}/${markdownPages.length} (${((matched.length / markdownPages.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Not matched: ${notMatched.length}\n`);

  if (notMatched.length > 0) {
    console.log('📋 Pages without matching HTML (first 20):');
    notMatched.slice(0, 20).forEach((page, i) => {
      const normalized = page
        .replace(/[?!\/\\:*"<>|]/g, "")
        .replace(/[\s\-]+/g, "_")
        .toLowerCase();
      console.log(`   ${i + 1}. ${page}`);
      console.log(`      → normalized: ${normalized}`);
    });

    if (notMatched.length > 20) {
      console.log(`      ... and ${notMatched.length - 20} more`);
    }
  }

  // Find HTML files not matched to markdown
  console.log('\n🔍 HTML files without markdown source (first 10):');
  const htmlNames = parseResult.pages.map(p => p.name);
  const unmatched = htmlNames.filter(htmlName => {
    return !markdownPages.some(md => {
      let normalized = md.pageName
        .replace(/[?!\/\\:*"<>|]/g, "")
        .replace(/[\s\-]+/g, "_")
        .toLowerCase();
      try {
        normalized = decodeURIComponent(normalized);
      } catch {}
      return htmlName.toLowerCase() === normalized;
    });
  });

  unmatched.slice(0, 10).forEach((name, i) => {
    console.log(`   ${i + 1}. ${name}`);
  });
  if (unmatched.length > 10) {
    console.log(`      ... and ${unmatched.length - 10} more`);
  }
}

analyzeMissingPages().catch(console.error);
