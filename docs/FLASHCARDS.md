# Draehi Flashcard System - Technical Specification

**Version:** 1.0
**Date:** 2025-11-30
**Status:** Design Phase
**Algorithm:** FSRS-4.5 (Free Spaced Repetition Scheduler)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [FSRS Algorithm Implementation](#3-fsrs-algorithm-implementation)
4. [State Management](#4-state-management)
5. [Review History Compression](#5-review-history-compression)
6. [Graph Distance & Families](#6-graph-distance--families)
7. [Data Flow](#7-data-flow)
8. [Query Patterns](#8-query-patterns)
9. [Integration Points](#9-integration-points)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. System Overview

### 1.1 Design Principles

**Git as Source of Truth**
- Flashcard **content** comes from Logseq markdown (Git repo)
- Flashcard **review state** lives only in Draehi (SurrealDB)
- Zero sync back to Git - ignore Logseq's `card-*` properties
- Users have no CRUD control - only review existing cards

**Workspace-Scoped, User-Specific**
- Flashcards belong to workspaces (via Git content)
- Multiple users can review same workspace independently
- Each user has separate FSRS state per card

**FSRS-4.5 Algorithm**
- Free Spaced Repetition Scheduler (FSRS-4.5)
- Superior to SM-2/SM-5 (used by Anki/Logseq)
- Memory stability model with retrievability prediction
- Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

### 1.2 MVP Goals

**Core Functionality**
1. User reviews flashcards with FSRS scheduling
2. Cards grouped by "family" (graph proximity)
3. Priority queue based on FSRS retrievability
4. No manual card management - all automated

**Out of Scope (MVP)**
- Custom FSRS parameter tuning
- Review statistics/analytics
- Card editing UI
- Export/import features

---

## 2. Database Schema

### 2.1 Users Table Update

```sql
-- No changes to users table structure
-- Graph relation handles user→flashcard connection
```

### 2.2 Flashcards Table

**Design Decision: Match ts-fsrs Card Structure**

We use the exact [ts-fsrs Card type](https://github.com/open-spaced-repetition/ts-fsrs) to ensure compatibility with the library:

```sql
DEFINE TABLE flashcards SCHEMALESS;

-- Core relationships
DEFINE FIELD user ON flashcards TYPE record<users>;
DEFINE FIELD node ON flashcards TYPE record<nodes>;  -- The card node
-- Note: workspace derived via node.workspace (not stored)

-- ts-fsrs Card structure (exact match)
DEFINE FIELD due ON flashcards TYPE datetime DEFAULT time::now();
DEFINE FIELD stability ON flashcards TYPE number DEFAULT 0;
DEFINE FIELD difficulty ON flashcards TYPE number DEFAULT 0;
DEFINE FIELD elapsed_days ON flashcards TYPE number DEFAULT 0;
DEFINE FIELD scheduled_days ON flashcards TYPE number DEFAULT 0;
DEFINE FIELD reps ON flashcards TYPE number DEFAULT 0;
DEFINE FIELD lapses ON flashcards TYPE number DEFAULT 0;
DEFINE FIELD state ON flashcards TYPE string DEFAULT 'New';
-- States: 'New' | 'Learning' | 'Review' | 'Relearning' (ts-fsrs enum)
DEFINE FIELD last_review ON flashcards TYPE option<datetime>;

-- Compressed review history (gzipped ts-fsrs ReviewLog[])
DEFINE FIELD review_log ON flashcards TYPE option<bytes>;
-- Stores gzip-compressed array of ReviewLog objects

-- Metadata
DEFINE FIELD created_at ON flashcards TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON flashcards TYPE datetime DEFAULT time::now();

-- Indexes for query performance
DEFINE INDEX user_due ON flashcards COLUMNS user, due;
DEFINE INDEX user_node_unique ON flashcards COLUMNS user, node UNIQUE;
DEFINE INDEX node_idx ON flashcards COLUMNS node;
```

**TypeScript Interface (matches ts-fsrs):**

```typescript
import type { Card, ReviewLog, State } from 'ts-fsrs';

interface FlashcardRecord {
  user: string;           // record<users>
  node: string;           // record<nodes>

  // ts-fsrs Card fields (exact match)
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;           // 'New' | 'Learning' | 'Review' | 'Relearning'
  last_review?: Date;

  // Our additions
  review_log?: Uint8Array;  // gzipped ReviewLog[]
  created_at: Date;
  updated_at: Date;
}
```

### 2.3 User-Flashcard Relation

```sql
DEFINE TABLE reviews TYPE RELATION IN users OUT flashcards;
```

**Usage:**
```sql
-- Create relation when flashcard created
RELATE users:userId->reviews->flashcards:cardId;

-- Query user's flashcards
SELECT ->reviews->flashcards FROM users:userId;

-- Query flashcards due now
SELECT ->reviews->flashcards FROM users:userId
WHERE ->reviews->flashcards.due <= time::now();
```

---

## 3. FSRS Algorithm Implementation (ts-fsrs Library)

**Design Decision: Use ts-fsrs Instead of Manual Implementation**

We use the [ts-fsrs library](https://github.com/open-spaced-repetition/ts-fsrs) instead of implementing FSRS manually:
- ✅ Battle-tested, production-ready
- ✅ Handles all FSRS math (stability, difficulty, intervals)
- ✅ Automatic state transitions
- ✅ Built-in ReviewLog generation
- ✅ TypeScript native

### 3.1 Installation

```bash
npm install ts-fsrs
# or
pnpm add ts-fsrs
```

### 3.2 Basic Usage

```typescript
import { FSRS, createEmptyCard, Rating, generatorParameters } from 'ts-fsrs';

// Initialize FSRS with default or user-specific params
const params = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [0.4072, 1.1829, ...] // Default or optimized weights
});

const f = new FSRS(params);

// Create a new card
const card = createEmptyCard();

// User reviews the card
const now = new Date();
const schedulingCards = f.repeat(card, now);

// User rates "Good" (3)
const { card: updatedCard, log: reviewLog } = schedulingCards[Rating.Good];

// Save to database
await saveFlashcard(updatedCard, reviewLog);
```

### 3.3 Rating Enum

```typescript
enum Rating {
  Again = 1,  // Forgot completely
  Hard = 2,   // Difficult to recall
  Good = 3,   // Recalled with effort
  Easy = 4    // Instant recall
}
```

### 3.4 State Enum

```typescript
enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}
```

### 3.5 Review Processing with ts-fsrs

```typescript
async function processReview(
  flashcardId: string,
  rating: Rating,
  timestamp: Date
) {
  // Fetch current card state from database
  const flashcard = await db.select(`flashcards:${flashcardId}`);

  // Convert database record to ts-fsrs Card
  const card: Card = {
    due: flashcard.due,
    stability: flashcard.stability,
    difficulty: flashcard.difficulty,
    elapsed_days: flashcard.elapsed_days,
    scheduled_days: flashcard.scheduled_days,
    reps: flashcard.reps,
    lapses: flashcard.lapses,
    state: flashcard.state as State,
    last_review: flashcard.last_review
  };

  // Get user's FSRS parameters (default or optimized)
  const params = await getUserFSRSParams(flashcard.user);
  const f = new FSRS(params);

  // Calculate next state
  const schedulingCards = f.repeat(card, timestamp);
  const { card: nextCard, log: reviewLog } = schedulingCards[rating];

  // Decompress existing review history
  const existingLogs = await decompressReviewLog(flashcard.review_log);
  const allLogs = [...existingLogs, reviewLog];

  // Compress updated review history
  const compressedLogs = await compressReviewLog(allLogs);

  // Update database
  await db.query(`
    UPDATE flashcards:${flashcardId} SET
      due = $due,
      stability = $stability,
      difficulty = $difficulty,
      elapsed_days = $elapsed_days,
      scheduled_days = $scheduled_days,
      reps = $reps,
      lapses = $lapses,
      state = $state,
      last_review = $last_review,
      review_log = $review_log,
      updated_at = time::now()
  `, {
    ...nextCard,
    review_log: compressedLogs
  });

  return nextCard;
}
```

**Key Benefits:**
- ✅ No manual FSRS math
- ✅ Automatic state transitions
- ✅ Built-in ReviewLog generation
- ✅ Just call `repeat()` and save result

---

## 4. State Management (ts-fsrs Handles This)

### 4.1 State Definitions

ts-fsrs uses 4 states (no custom `uninitiated` state):

| State | ts-fsrs Value | Description | Typical Interval |
|-------|---------------|-------------|------------------|
| `New` | 0 | Never reviewed (lazy-created) | Immediate (now) |
| `Learning` | 1 | Short-term learning | 1-10 minutes |
| `Review` | 2 | Long-term retention | Days to months |
| `Relearning` | 3 | Failed review, relearning | 10 minutes → days |

**Design Decision:** All cards start as `state: 'New'` (no uninitiated). Lazy creation sets `state: 'New'` by default.

### 4.2 State Transitions (Automatic)

ts-fsrs handles all state transitions via the `repeat()` function:

```typescript
const schedulingCards = f.repeat(card, now);

// ts-fsrs returns 4 possible outcomes:
schedulingCards[Rating.Again]  // State may change to Relearning
schedulingCards[Rating.Hard]   // State progression
schedulingCards[Rating.Good]   // State progression
schedulingCards[Rating.Easy]   // State progression
```

**We don't manage state transitions** - ts-fsrs does it automatically based on:
- Current state
- User rating
- FSRS parameters
- Card history

### 4.3 Lapse Handling (Automatic)

ts-fsrs automatically:
- Increments `lapses` counter when rating < 3 in Review state
- Adjusts `stability` based on FSRS algorithm
- Transitions to `Relearning` state
- Applies appropriate intervals

**No manual lapse logic needed.**

---

## 5. Review History Compression (Gzip)

### 5.1 Compression Strategy

**Problem:** Storing full ts-fsrs ReviewLog objects for 10,000 cards × 100 reviews

**Solution:** Gzip compression of ReviewLog arrays

**Design Decision: Simplicity Over Custom Encoding**

We use **gzip** instead of custom delta encoding because:
- ✅ **Simple**: One function call (gzip/gunzip)
- ✅ **Standard**: Built-in Node.js compression
- ✅ **Effective**: ~70-80% compression on JSON
- ✅ **Compatible**: Works with ts-fsrs ReviewLog objects directly
- ✅ **Debuggable**: Decompress → inspect full objects

### 5.2 ReviewLog Structure (from ts-fsrs)

```typescript
type ReviewLog = {
  rating: Rating;      // 1-4
  state: State;        // 0-3
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  review: Date;
};
```

### 5.3 Compression Functions

```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { ReviewLog } from 'ts-fsrs';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Compress array of ReviewLog objects
 */
async function compressReviewLog(logs: ReviewLog[]): Promise<Uint8Array> {
  if (!logs || logs.length === 0) {
    return new Uint8Array(0);
  }

  const json = JSON.stringify(logs);
  const compressed = await gzipAsync(json);
  return new Uint8Array(compressed);
}

/**
 * Decompress to array of ReviewLog objects
 */
async function decompressReviewLog(compressed: Uint8Array): Promise<ReviewLog[]> {
  if (!compressed || compressed.length === 0) {
    return [];
  }

  const decompressed = await gunzipAsync(compressed);
  const json = decompressed.toString('utf-8');
  return JSON.parse(json);
}
```

### 5.4 Usage in Review Processing

```typescript
async function processReview(flashcardId: string, rating: Rating, timestamp: Date) {
  const flashcard = await db.select(`flashcards:${flashcardId}`);

  // ... ts-fsrs repeat() logic ...

  const { card: nextCard, log: newReviewLog } = schedulingCards[rating];

  // Decompress existing logs
  const existingLogs = await decompressReviewLog(flashcard.review_log);

  // Append new review
  const allLogs = [...existingLogs, newReviewLog];

  // Compress for storage
  const compressedLogs = await compressReviewLog(allLogs);

  // Save to database
  await db.update(`flashcards:${flashcardId}`, {
    ...nextCard,
    review_log: compressedLogs,
    updated_at: new Date()
  });
}
```

### 5.5 Compression Efficiency

**Example with 100 reviews:**

```javascript
// Uncompressed ReviewLog array (JSON)
const logs: ReviewLog[] = [ /* 100 reviews */ ];
const uncompressed = JSON.stringify(logs);
// Size: ~15KB (150 bytes per review × 100)

// Gzipped
const compressed = await gzipAsync(uncompressed);
// Size: ~3-4KB (70-75% compression)
```

**Comparison:**

| Approach | Bytes/Review | Implementation | Storage (100 reviews) |
|----------|--------------|----------------|----------------------|
| **Uncompressed JSON** | ~150 | Simple | 15KB |
| **Gzip (our choice)** | ~30-40 | Simple | 3-4KB |
| **Custom delta** | ~5 | Complex | 0.5KB |

**Why gzip wins for MVP:**
- Good enough compression (70-75%)
- Zero custom code (stdlib)
- Full ReviewLog objects preserved
- Easy debugging (decompress → inspect)
- Compatible with WASM optimizer export

---

## 6. Graph Distance & Families

### 6.1 Family Concept

**Definition:** Cards that are "related" via graph proximity (parent-child, siblings, backlinks)

**Purpose:** Group reviews by topic for cognitive coherence

**Example:**
```
Biology (page)
├─ Cell Structure #card (distance 1)
│  ├─ Mitochondria {{cloze ATP}} #card (distance 2)
│  └─ Nucleus {{cloze DNA}} #card (distance 2)
└─ Genetics #card (distance 1)
   └─ DNA Replication {{cloze helicase}} #card (distance 2)
```

Cards within same subtree = same family.

### 6.2 Required Query Interface

**Input:** `flashcard_node_ids[]` (array of N card nodes to find relationships between)

**Output:** List of related card nodes sorted by collective proximity to ALL input nodes

```javascript
// Hypothetical perfect query - takes MULTIPLE nodes as input
const relatedCards = await getRelatedCardNodes(
  nodeIds: ["nodes:abc", "nodes:def", "nodes:ghi"],
  maxDistance: 3
);

// Returns nodes sorted by how close they are to ALL input nodes collectively
// Distance = average/minimum distance to all input nodes
[
  { node_id: "nodes:xyz", avg_distance: 1.3, min_distance: 1 },
  { node_id: "nodes:uvw", avg_distance: 1.7, min_distance: 1 },
  { node_id: "nodes:rst", avg_distance: 2.0, min_distance: 2 }
]
```

**Query Requirements:**
- Traverse `parent` edges bidirectionally (up and down tree)
- Include backlinks (nodes that reference this node via `[[page]]`)
- Filter nodes with flashcard metadata only
- Calculate distance from candidate node to EACH input node
- Sort by proximity metric (avg or min distance to input set)
- This enables finding "common neighborhood" of multiple cards

### 6.3 Family Grouping Algorithm

```javascript
async function getFlashcardsByFamily(userId, workspaceId) {
  const dueCards = await getDueFlashcards(userId);
  const dueNodeIds = dueCards.map(card => card.node);

  // Find nodes that are collectively close to ALL due cards
  // This creates "clusters" of related flashcards
  const relatedNodes = await getRelatedCardNodes(dueNodeIds, maxDistance = 3);

  // Build adjacency graph from proximity data
  const graph = buildProximityGraph(relatedNodes);

  // Use graph clustering to identify families
  // Cards with avg_distance < 2.0 form tight clusters
  const families = clusterByProximity(graph, threshold = 2.0);

  // Map each due card to its family cluster
  const grouped = {};
  for (const card of dueCards) {
    const familyId = families.get(card.node) || card.node;
    if (!grouped[familyId]) grouped[familyId] = [];
    grouped[familyId].push(card);
  }

  return grouped;
}

function buildProximityGraph(relatedNodes) {
  // Build graph where edges = proximity score
  const graph = new Map();
  for (const node of relatedNodes) {
    graph.set(node.node_id, {
      avg_distance: node.avg_distance,
      min_distance: node.min_distance,
      neighbors: [] // populated based on shared proximity
    });
  }
  return graph;
}

function clusterByProximity(graph, threshold) {
  // Simple clustering: nodes with avg_distance < threshold are in same family
  // More sophisticated: use community detection algorithms (Louvain, etc.)
  const families = new Map();
  let familyCounter = 0;

  for (const [nodeId, data] of graph.entries()) {
    if (data.avg_distance < threshold) {
      if (!families.has(nodeId)) {
        families.set(nodeId, `family_${familyCounter++}`);
      }
    }
  }

  return families;
}
```

### 6.4 Family-Aware Priority Queue

```javascript
function buildPriorityQueue(familyGroups) {
  const queue = [];

  // For each family
  for (const [familyId, cards] of Object.entries(familyGroups)) {
    // Sort cards within family by retrievability (FSRS priority)
    const sorted = cards.sort((a, b) => {
      const rA = calculateRetrievability(a);
      const rB = calculateRetrievability(b);
      return rA - rB; // Lowest retrievability first
    });

    queue.push({
      family: familyId,
      cards: sorted,
      priority: Math.min(...sorted.map(calculateRetrievability))
    });
  }

  // Sort families by worst card retrievability
  return queue.sort((a, b) => a.priority - b.priority);
}

function calculateRetrievability(flashcard) {
  if (flashcard.stability === 0) return 0;
  const t = flashcard.elapsed_days;
  const S = flashcard.stability;
  return Math.exp(-t / S);
}
```

---

## 7. Data Flow

### 7.1 Initial Setup (Workspace Sync)

```
Git Push
  ↓
Webhook Trigger
  ↓
modules/git/sync.ts
  ↓
modules/logseq/ingest.ts
  ↓
Parse markdown for #card and {{cloze}}
  ↓
Store in nodes table (metadata.properties.card = true)
  ↓
NO flashcard records created yet (lazy creation)
```

### 7.2 First Flashcard Session

```
User → /workspace/flashcards
  ↓
GET /api/flashcards/init
  ↓
Query: SELECT * FROM nodes WHERE workspace = $id AND metadata.properties.card != NULL
  ↓
For each card node:
  Check if flashcards record exists for (user, node)
  If not: CREATE flashcard with state='uninitiated', due=now()
  ↓
RELATE users:id->reviews->flashcards:id
  ↓
Return all uninitiated cards (first review batch)
```

### 7.3 Review Submission

```
User submits rating (1-4) for flashcard
  ↓
POST /api/flashcards/:id/review { rating, timestamp }
  ↓
processReview(flashcardId, rating, timestamp)
  ↓
Calculate new FSRS state (S, D, interval, due date)
  ↓
Compress review history
  ↓
UPDATE flashcards:id SET ...
  ↓
Return next card from priority queue
```

### 7.4 Daily Review Routine

```
User → /workspace/flashcards
  ↓
GET /api/flashcards/due
  ↓
SELECT ->reviews->flashcards FROM users:id
WHERE ->reviews->flashcards.due <= time::now()
  ↓
Group by family (graph distance)
  ↓
Sort by FSRS priority (retrievability)
  ↓
Return priority queue
```

---

## 8. Query Patterns

### 8.1 Get Due Flashcards

```sql
-- All due cards for user
SELECT ->reviews->flashcards FROM users:$userId
WHERE ->reviews->flashcards.due <= time::now()
ORDER BY ->reviews->flashcards.due ASC;
```

### 8.2 Get Card Nodes for Workspace

```sql
-- All nodes that are flashcards
SELECT * FROM nodes
WHERE workspace = $workspaceId
AND (
  metadata.properties.card IS NOT NONE
  OR string::contains(metadata.tags, 'card')
);
```

### 8.3 Lazy Initialize Missing Cards

```javascript
// TypeScript/SurrealDB hybrid
const userCards = await db.query(`
  SELECT node FROM ->reviews->flashcards
  WHERE in = users:${userId}
`);

const existingNodeIds = userCards.map(c => c.node);

const allCardNodes = await db.query(`
  SELECT id FROM nodes
  WHERE workspace = workspaces:${workspaceId}
  AND metadata.properties.card IS NOT NONE
`);

const missingNodes = allCardNodes.filter(
  node => !existingNodeIds.includes(node.id)
);

for (const node of missingNodes) {
  const cardId = `flashcards:${generateId()}`;

  await db.create(cardId, {
    user: `users:${userId}`,
    node: node.id,
    state: 'uninitiated',
    stability: 0,
    difficulty: 5.0,
    reps: 0,
    lapses: 0,
    due: new Date(),
    created_at: new Date()
  });

  await db.query(`
    RELATE users:${userId}->reviews->${cardId}
  `);
}
```

### 8.4 Update After Review

```sql
UPDATE flashcards:$cardId SET
  state = $state,
  stability = $stability,
  difficulty = $difficulty,
  scheduled_days = $scheduled_days,
  elapsed_days = $elapsed_days,
  reps = reps + 1,
  lapses = lapses + $lapse_increment,
  last_review = $timestamp,
  due = $due_date,
  review_log = $compressed_log,
  updated_at = time::now()
;
```

### 8.5 Get Flashcard Stats

```sql
-- User's overall progress
SELECT
  count() AS total_cards,
  count(state = 'review') AS mastered,
  count(state = 'learning') AS learning,
  count(due <= time::now()) AS due_today,
  avg(stability) AS avg_stability
FROM ->reviews->flashcards
WHERE in = users:$userId;
```

---

## 9. Integration Points

### 9.1 Existing Draehi Modules

**modules/logseq/markdown-parser.ts**
- Already extracts `properties` from blocks
- Already detects `#card` tags
- Add: Flashcard detection helper

```typescript
export function isFlashcardNode(block: LogseqBlock): boolean {
  // Check for #card tag
  if (block.content.includes('#card')) return true;
  if (block.properties.card === 'true') return true;

  // Check for cloze syntax
  if (/\{\{cloze\s+[^}]+\}\}|\{\{c\d+\s+[^}]+\}\}/i.test(block.content)) {
    return true;
  }

  return false;
}
```

**modules/logseq/ingest.ts**
- Update `pageWithBlocksToNodes()` to set `metadata.flashcard = true`
- Ignore Logseq SRS properties (`card-last-reviewed::`, etc.)

```typescript
const blockNode: NewNode = {
  // ... existing fields
  metadata: {
    properties: block.properties,
    flashcard: isFlashcardNode(block) // NEW
  }
};
```

**modules/content/schema.ts**
- Add `flashcard?: boolean` to Node metadata type

```typescript
export interface Node {
  // ... existing fields
  metadata?: {
    tags?: string[];
    properties?: Record<string, unknown>;
    frontmatter?: Record<string, unknown>;
    heading?: { level: number; text: string };
    flashcard?: boolean; // NEW
  };
}
```

### 9.2 New Modules Required

**modules/flashcards/schema.ts**
- TypeScript types for flashcard state
- FSRS parameter constants

**modules/flashcards/queries.ts**
- `getDueFlashcards(userId)`
- `getFlashcard(cardId)`
- `initializeFlashcards(userId, workspaceId)`
- `getFlashcardStats(userId)`

**modules/flashcards/actions.ts**
- `submitReview(cardId, rating, timestamp)`
- Server action with validation

**modules/flashcards/fsrs.ts**
- FSRS algorithm implementation
- `processReview()`, `calculateRetrievability()`, etc.

**modules/flashcards/compression.ts**
- Review history compression/decompression

**modules/flashcards/family.ts**
- Graph distance calculation
- Family grouping logic

### 9.3 Frontend Components

**app/[workspaceSlug]/flashcards/page.tsx**
- Review UI route
- Server component fetches due cards

**components/flashcards/ReviewSession.tsx**
- Client component for card display
- Rating buttons (1-4)
- Progress indicator

**components/flashcards/FlashcardRenderer.tsx**
- Renders cloze syntax with click-to-reveal
- Handles Q&A card format

**components/flashcards/StatsPanel.tsx**
- Display user progress
- Cards due, mastered, etc.

### 9.4 API Routes

```
POST /api/flashcards/init
  → Initialize missing flashcards for user

GET /api/flashcards/due
  → Get cards due now, sorted by priority

POST /api/flashcards/:id/review
  → Submit review rating

GET /api/flashcards/stats
  → User statistics
```

---

## 10. Implementation Checklist (REVISED with ts-fsrs)

**Timeline: 2-3 weeks** (down from 6-8 weeks!)

### Phase 1: Core Integration (Week 1)

**Database & Schema:**
- [ ] Install ts-fsrs: `pnpm add ts-fsrs`
- [ ] Add flashcards table to `modules/db/schema.surql` (ts-fsrs Card structure)
- [ ] Add reviews RELATION table
- [ ] Create `modules/flashcards/schema.ts` (import from ts-fsrs)
- [ ] Run migrations on dev database

**Review Processing:**
- [ ] Create `modules/flashcards/queries.ts`
  - [ ] `initializeFlashcards()` - lazy creation with state='New'
  - [ ] `getDueFlashcards()` - query due cards
- [ ] Create `modules/flashcards/actions.ts`
  - [ ] `submitReview()` - calls ts-fsrs `repeat()`, saves result
- [ ] Implement gzip compression helpers (zlib)
- [ ] Add input validation (Zod schemas)

### Phase 2: Frontend UI (Week 2)

**Review Interface:**
- [ ] Create `/[workspaceSlug]/flashcards` route
- [ ] Build `ReviewSession` client component
  - [ ] Rating buttons (Again/Hard/Good/Easy)
  - [ ] Show question, hide answer
  - [ ] Progress indicator (X cards remaining)
- [ ] Build `FlashcardRenderer` component
  - [ ] Render cloze syntax with click-to-reveal
  - [ ] Handle Q&A format
- [ ] Mobile-responsive design (320px minimum)

**Cloze Processing:**
- [ ] Update `modules/logseq/process-references.ts`
- [ ] Parse `{{cloze text}}` → `<span class="cloze-hidden">`
- [ ] Parse `{{c1 text}}` → `<span class="cloze-1">`
- [ ] Add CSS for cloze reveal animations

### Phase 3: Testing & Polish (Week 3)

**Integration Testing:**
- [ ] Test lazy initialization with 1000+ cards
- [ ] Test ts-fsrs integration (correct state transitions)
- [ ] Test gzip compression/decompression
- [ ] Mobile device testing

**UI Polish:**
- [ ] Add loading states
- [ ] Add error handling
- [ ] Show stats (cards reviewed today, due tomorrow)
- [ ] Performance optimization

**Deployment:**
- [ ] Add CORS headers to `next.config.ts` (for Phase 4)
- [ ] Deploy to production
- [ ] Monitor performance

### Phase 4: Optimizer (Post-Launch - Optional)

**Client-Side WASM Optimizer:**
- [ ] Install `@open-spaced-repetition/binding`
- [ ] Add pnpm wasm32 architecture support
- [ ] Configure Next.js headers (COOP/COEP)
- [ ] Build `OptimizerModal` component
- [ ] Add "Optimize My Learning" button to dashboard
- [ ] Server action to save optimized weights
- [ ] Auto-suggest optimization at 100/200/400 reviews

**What We Skipped:**
- ❌ Manual FSRS implementation (4-5 days saved)
- ❌ State machine coding (2-3 days saved)
- ❌ Unit tests for FSRS math (1-2 days saved)
- ❌ Python optimizer setup (2-3 days saved)
- ❌ Custom delta encoding (1 day saved)

**Total time saved: ~2-3 weeks** by using ts-fsrs!

---

## 11. FSRS Weight Optimization (Client-Side WASM)

### 11.1 Why Optimize Weights?

**Default vs. Personalized Weights:**
- FSRS ships with default w1-w19 weights (population averages)
- These work for most users but are not personalized
- Each person has unique learning patterns (memory strength, retention curves)
- Optimized weights = algorithm tailored to YOUR brain

**Performance Gains:**
- Research shows improvement after as few as **16 reviews** ([Anki Issue #3094](https://github.com/ankitects/anki/issues/3094))
- Better interval predictions = fewer reviews needed for same retention
- Reduced study time (10-20% improvement typical)

### 11.2 The Optimization Process

**Design Decision: Client-Side WASM (not Python)**

We use [@open-spaced-repetition/binding](https://github.com/open-spaced-repetition/ts-fsrs/tree/main/examples/nextjs) (WASM) instead of Python optimizer:
- ✅ Runs in user's browser (no server compute)
- ✅ No Python dependency
- ✅ Follows Next.js example architecture
- ✅ Real-time progress updates
- ✅ Privacy-friendly (data stays client-side)

### 11.3 Installation

```bash
npm install @open-spaced-repetition/binding
# or
pnpm add @open-spaced-repetition/binding
```

**For pnpm users**, update `package.json`:
```json
{
  "pnpm": {
    "supportedArchitectures": {
      "cpu": ["current", "wasm32"]
    }
  }
}
```

### 11.4 Next.js Configuration (REQUIRED)

**`next.config.ts`:**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent bundling WASM binding on server
  serverExternalPackages: ['@open-spaced-repetition/binding'],

  // Enable SharedArrayBuffer for WASM
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Critical:** CORS headers are **required** for WASM SharedArrayBuffer support.

### 11.5 Database Schema Addition

```sql
-- Add to users table
DEFINE FIELD fsrs_weights ON users TYPE option<array>;
DEFINE FIELD last_optimization ON users TYPE option<datetime>;
DEFINE FIELD total_reviews ON users TYPE number DEFAULT 0;
```

### 11.6 Client-Side Optimizer Component

```typescript
// components/flashcards/OptimizerModal.tsx
'use client';

import { useState } from 'react';
import { formatDataForOptimizer } from '@open-spaced-repetition/binding';

export function OptimizerModal({ userId }: { userId: string }) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);

  async function runOptimization() {
    setIsOptimizing(true);

    // Fetch user's review history
    const flashcards = await fetch(`/api/flashcards/${userId}/all`).then(r => r.json());

    // Decompress review logs
    const reviewLogs = [];
    for (const card of flashcards) {
      const logs = await decompressReviewLog(card.review_log);
      for (const log of logs) {
        reviewLogs.push({
          card_id: card.node,
          review_time: log.review.getTime(),
          review_rating: log.rating,
          review_state: log.state,
          review_duration: 0
        });
      }
    }

    // Run WASM optimizer
    const { default: init, train } = await import('@open-spaced-repetition/binding');
    await init();

    const csvData = convertToCSV(reviewLogs);

    // Train with progress callback
    const result = await train(csvData, {
      onProgress: (percent) => setProgress(percent)
    });

    // Save optimized weights
    await fetch(`/api/users/${userId}/weights`, {
      method: 'POST',
      body: JSON.stringify({ weights: result.w })
    });

    setIsOptimizing(false);
  }

  return (
    <div>
      <button onClick={runOptimization} disabled={isOptimizing}>
        {isOptimizing ? `Optimizing... ${progress}%` : 'Optimize My Learning'}
      </button>
    </div>
  );
}
```

### 11.7 Server Action to Save Weights

```typescript
// modules/flashcards/actions.ts
'use server';

import { db } from '@/lib/surreal';

export async function saveOptimizedWeights(userId: string, weights: number[]) {
  if (weights.length !== 19) {
    throw new Error('Invalid weights: must be array of 19 numbers');
  }

  await db.query(`
    UPDATE users:${userId} SET
      fsrs_weights = $weights,
      last_optimization = time::now(),
      last_optimization_review_count = total_reviews
  `, { weights });

  return { success: true };
}
```

### 11.8 Use User-Specific Weights

```javascript
async function getFSRSParams(userId) {
  const user = await db.select(`users:${userId}`);

  // Use personalized weights if available
  if (user.fsrs_weights && user.fsrs_weights.length === 19) {
    return {
      w: user.fsrs_weights,
      request_retention: 0.9,
      maximum_interval: 36500,
      learning_steps: [1, 10],
      relearning_steps: [10]
    };
  }

  // Fall back to default weights
  return FSRS_PARAMS_DEFAULT;
}

// In processReview():
const params = await getFSRSParams(userId);
const w = params.w;  // Use these weights in FSRS calculations
```

### 11.7 Optimization Triggers

**Automatic Triggers:**
1. **Review count milestones:** 100, 200, 400, 800, 1600 reviews
2. **Monthly schedule:** If 30+ days since last optimization and 50+ new reviews
3. **Manual trigger:** User clicks "Optimize My Learning" button

**Background Job:**
```javascript
// cron job: daily at 3 AM
async function dailyOptimizationCheck() {
  const users = await db.query(`
    SELECT id, total_reviews, last_optimization
    FROM users
    WHERE total_reviews >= 100
  `);

  for (const user of users) {
    if (await shouldOptimizeWeights(user.id)) {
      // Queue optimization job (run async, don't block)
      await queueJob('optimize_weights', { userId: user.id });
    }
  }
}
```

### 11.8 Implementation Timeline

**Phase 1 (MVP):** Use default FSRS weights for all users

**Phase 2 (Post-Launch):**
- Add `fsrs_weights` field to users table
- Implement CSV export function
- Add Python optimizer script
- Background job for automatic optimization

**Phase 3 (Advanced):**
- UI dashboard showing optimization history
- A/B test: default vs optimized weights performance
- Parameter drift detection (re-optimize if learning patterns change)

### 11.9 Resources

- [FSRS Optimizer GitHub](https://github.com/open-spaced-repetition/fsrs-optimizer)
- [Anki FSRS FAQ](https://faqs.ankiweb.net/frequently-asked-questions-about-fsrs.html)
- [Optimization Discussion (Anki Forums)](https://forums.ankiweb.net/t/how-many-reviews-for-accurate-optimization/53320)
- [Minimum Review Research](https://github.com/ankitects/anki/issues/3094)

---

## Appendix A: FSRS Resources

- **Algorithm Wiki**: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
- **Reference Implementation**: https://github.com/open-spaced-repetition/fsrs.js
- **Research Paper**: https://www.nature.com/articles/s41539-024-00249-x
- **Parameter Optimization**: https://github.com/open-spaced-repetition/fsrs-optimizer

## Appendix B: Example Queries

See sections 8.1-8.5 for production queries.

## Appendix C: State Machine Diagram

```
┌─────────────┐
│ uninitiated │
└──────┬──────┘
       │ first review (any rating)
       ▼
   ┌───────┐
   │  new  │
   └───┬───┘
       │ second review
       ▼
 ┌──────────┐
 │ learning │◄───────────┐
 └────┬─────┘            │
      │                  │
      ├─ rating ≥3       │
      │                  │
      ▼                  │
  ┌────────┐         ┌────────────┐
  │ review │────────►│ relearning │
  └───┬────┘ rating<3└────┬───────┘
      │                   │
      │◄──────────────────┘
      │    rating ≥3
      │
      └─► (continues review cycle)
```

---

**End of Technical Specification**
