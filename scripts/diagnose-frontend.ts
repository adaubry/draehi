#!/usr/bin/env tsx

/**
 * Diagnose frontend rendering issues
 * Checks why blocks don't display even though data exists
 */

import { db } from '../lib/db';
import { getWorkspaceBySlug } from '../modules/workspace/queries';
import { getNodeByPath, getAllBlocksForPage } from '../modules/content/queries';

const WORKSPACE_SLUG = 'test';
const PAGE_PATH = ['contents'];

async function diagnose() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Frontend Rendering Diagnostics        ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Step 1: Check workspace
  console.log('1️⃣  Checking workspace...');
  const workspace = await getWorkspaceBySlug(WORKSPACE_SLUG);
  if (!workspace) {
    console.error('❌ Workspace not found:', WORKSPACE_SLUG);
    return;
  }
  console.log(`✅ Workspace found: ${workspace.slug} (ID: ${workspace.id})\n`);

  // Step 2: Check node by path
  console.log('2️⃣  Checking node by path...');
  const node = await getNodeByPath(workspace.id, PAGE_PATH);
  if (!node) {
    console.error('❌ Node not found for path:', PAGE_PATH);
    console.log('   This means getNodeByPath() query is failing');
    return;
  }
  console.log(`✅ Node found: ${node.title} (ID: ${node.id})`);
  console.log(`   - pageName: ${node.pageName}`);
  console.log(`   - slug: ${node.slug}`);
  console.log(`   - namespace: ${node.namespace}`);
  console.log(`   - nodeType: ${node.nodeType}\n`);

  // Step 3: Check blocks query
  console.log('3️⃣  Checking getAllBlocksForPage...');
  console.log(`   Query: workspace_id=${workspace.id}, pageName="${node.pageName}"`);

  const blocks = await getAllBlocksForPage(workspace.id, node.pageName);
  console.log(`   Result: ${blocks.length} nodes returned\n`);

  if (blocks.length === 0) {
    console.error('❌ getAllBlocksForPage returned 0 blocks');
    console.log('   Possible causes:');
    console.log('   1. No blocks in database for this page');
    console.log('   2. Query uses wrong workspace_id');
    console.log('   3. Query uses wrong pageName');
    console.log('   4. React cache returning stale empty data\n');

    // Direct DB query to verify
    console.log('4️⃣  Direct database check...');
    const directBlocks = await db.query.nodes.findMany({
      where: (nodes, { eq, and }) => and(
        eq(nodes.workspaceId, workspace.id),
        eq(nodes.pageName, node.pageName),
        eq(nodes.nodeType, 'block')
      ),
    });
    console.log(`   Direct query result: ${directBlocks.length} blocks`);

    if (directBlocks.length > 0) {
      console.log('✅ Blocks exist in database!');
      console.log('   Issue: React cache is stale or query function has bug');
      console.log(`   Sample block: ${directBlocks[0].html?.slice(0, 100)}...`);
    } else {
      console.log('❌ No blocks in database for this page');
      console.log('   Issue: Ingestion didn\'t create block nodes');
    }
  } else {
    console.log(`✅ getAllBlocksForPage returned ${blocks.length} nodes`);
    console.log(`   - Pages: ${blocks.filter(b => b.nodeType === 'page').length}`);
    console.log(`   - Blocks: ${blocks.filter(b => b.nodeType === 'block').length}`);

    const pageNode = blocks.find(b => b.nodeType === 'page');
    const blockNodes = blocks.filter(b => b.nodeType === 'block');

    if (pageNode) {
      console.log(`\n   Page node (ID: ${pageNode.id})`);
    }

    if (blockNodes.length > 0) {
      console.log(`\n   Sample blocks:`);
      blockNodes.slice(0, 3).forEach((b, i) => {
        console.log(`   ${i + 1}. Block ${b.id}: ${b.html?.slice(0, 60)}...`);
        console.log(`      parentId: ${b.parentId}, order: ${b.order}`);
      });
    }
  }

  // Step 5: Check if issue is frontend component
  console.log('\n5️⃣  Frontend component check...');
  console.log('   File: app/[workspaceSlug]/[...path]/page.tsx');
  console.log('   Line 72: checks if blocks.length > 0');
  console.log('   Line 79: shows "No blocks yet" if blocks.length === 0');
  console.log('   ');
  console.log('   Diagnosis:');
  if (blocks.length === 0) {
    console.log('   ❌ Frontend showing "No blocks yet" is CORRECT');
    console.log('      Backend query returning empty array');
  } else {
    console.log('   ❌ Frontend showing "No blocks yet" is WRONG');
    console.log('      Backend has blocks but frontend not receiving them');
    console.log('      Possible React Suspense/cache issue');
  }
}

diagnose().catch(console.error);
