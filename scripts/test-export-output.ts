#!/usr/bin/env tsx

import { exportLogseqNotes } from '../modules/logseq/export';
import fs from 'fs/promises';

async function testExport() {
  const result = await exportLogseqNotes('/home/adam/markdown_projects/draehi/test-data/logseq-docs-graph');

  if (result.success && result.outputDir) {
    const files = await fs.readdir(result.outputDir);
    console.log(`Total HTML files: ${files.length}`);
    console.log(`\nSample files (first 10):`);
    files.slice(0, 10).forEach(f => console.log(`  - ${f}`));

    const builtin = files.filter(f => f.includes('built'));
    console.log(`\nFiles containing 'built': ${builtin.length}`);
    builtin.forEach(f => console.log(`  - ${f}`));

    const properties = files.filter(f => f.toLowerCase().includes('properties'));
    console.log(`\nFiles containing 'properties': ${properties.length}`);
    properties.forEach(f => console.log(`  - ${f}`));
  } else {
    console.error('Export failed:', result.error);
  }
}

testExport();
