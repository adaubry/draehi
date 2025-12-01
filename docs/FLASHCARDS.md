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

```sql
DEFINE TABLE flashcards SCHEMALESS;

-- Core relationships
DEFINE FIELD user ON flashcards TYPE record<users>;
DEFINE FIELD node ON flashcards TYPE record<nodes>;  -- The card node
-- Note: workspace derived via node.workspace (not stored)

-- FSRS state variables
DEFINE FIELD stability ON flashcards TYPE number DEFAULT 0;        -- Memory stability (S) in days
DEFINE FIELD difficulty ON flashcards TYPE number DEFAULT 5.0;     -- Card difficulty (D) 0-10
DEFINE FIELD elapsed_days ON flashcards TYPE number DEFAULT 0;     -- Days since last review
DEFINE FIELD scheduled_days ON flashcards TYPE number DEFAULT 0;   -- Current interval length
DEFINE FIELD reps ON flashcards TYPE number DEFAULT 0;             -- Total review count
DEFINE FIELD lapses ON flashcards TYPE number DEFAULT 0;           -- Number of lapses (forgettings)

-- State machine
DEFINE FIELD state ON flashcards TYPE string DEFAULT 'uninitiated';
-- States: 'uninitiated' | 'new' | 'learning' | 'review' | 'relearning'

-- Timestamps
DEFINE FIELD last_review ON flashcards TYPE option<datetime>;      -- Last review timestamp
DEFINE FIELD due ON flashcards TYPE datetime DEFAULT time::now();  -- Next review due date

-- Compressed review history
DEFINE FIELD review_log ON flashcards TYPE option<object>;
-- Structure: { base: timestamp, deltas: [int], ratings: [int] }

-- Metadata
DEFINE FIELD created_at ON flashcards TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON flashcards TYPE datetime DEFAULT time::now();

-- Indexes for query performance
DEFINE INDEX user_due ON flashcards COLUMNS user, due;
DEFINE INDEX user_node_unique ON flashcards COLUMNS user, node UNIQUE;
DEFINE INDEX node_idx ON flashcards COLUMNS node;
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

## 3. FSRS Algorithm Implementation

### 3.1 FSRS Core Formula

**Retrievability (R)** - Probability of recall:
```
R(t, S) = e^(-t/S)

where:
  t = elapsed_days (time since last review)
  S = stability (memory strength in days)
```

**Next Interval Calculation:**
```
I = S × (desired_retention^(1/decay) - 1)

where:
  S = current stability
  desired_retention = 0.9 (target 90% recall)
  decay = -0.5 (FSRS constant)
```

### 3.2 State Transitions

```
uninitiated  →  [first review]  →  new
                                    ↓
new          →  [rating 1-4]    →  learning
                                    ↓
learning     →  [rating ≥3]     →  review
             →  [rating <3]     →  relearning
                                    ↓
review       →  [rating ≥3]     →  review (longer interval)
             →  [rating <3]     →  relearning
                                    ↓
relearning   →  [rating ≥3]     →  review
             →  [rating <3]     →  relearning (increment lapses)
```

### 3.3 FSRS Parameters (w1-w19)

**Default FSRS-4.5 weights** (global for all users):

```javascript
const FSRS_PARAMS = {
  w: [
    0.4072,  // w1  - initial difficulty decay
    1.1829,  // w2  - difficulty coefficient
    3.1262,  // w3  - difficulty constant
    15.4722, // w4  - initial stability for rating 1 (Again)
    7.2102,  // w5  - initial stability for rating 2 (Hard)
    0.5316,  // w6  - initial stability for rating 3 (Good)
    1.0651,  // w7  - initial stability for rating 4 (Easy)
    0.0234,  // w8  - stability decay
    0.6657,  // w9  - stability growth for rating 1
    0.1944,  // w10 - stability growth for rating 2
    1.4722,  // w11 - stability growth for rating 3
    2.9296,  // w12 - stability growth for rating 4
    0.1517,  // w13 - difficulty coefficient
    0.1104,  // w14 - difficulty decay
    0.0721,  // w15 - difficulty growth
    2.1492,  // w16 - lapse threshold
    0.0158,  // w17 - lapse multiplier
    0.0062,  // w18 - retrievability multiplier
    0.2092   // w19 - retrievability threshold
  ],
  request_retention: 0.9,     // Target 90% recall
  maximum_interval: 36500,    // 100 years (effectively infinite)
  learning_steps: [1, 10],    // 1min, 10min for learning state
  relearning_steps: [10]      // 10min for relearning
};
```

### 3.4 Core FSRS Functions

**Calculate Initial Stability** (for new cards):
```javascript
function init_stability(rating) {
  // rating: 1=Again, 2=Hard, 3=Good, 4=Easy
  return w[rating + 3]; // w4, w5, w6, w7
}
```

**Calculate Initial Difficulty**:
```javascript
function init_difficulty(rating) {
  return Math.max(1, Math.min(10,
    w[2] - w[1] * (rating - 3)
  ));
}
```

**Update Stability after review**:
```javascript
function next_stability(current_stability, current_difficulty, rating, retrievability) {
  const hard_penalty = (rating === 2) ? w[13] : 1;
  const easy_bonus = (rating === 4) ? w[14] : 1;

  return current_stability * (
    1 + Math.exp(w[6]) *
    (11 - current_difficulty) *
    Math.pow(current_stability, w[7]) *
    (Math.exp((1 - retrievability) * w[8]) - 1) *
    hard_penalty *
    easy_bonus
  );
}
```

**Update Difficulty**:
```javascript
function next_difficulty(current_difficulty, rating) {
  const difficulty_delta = w[4] - (rating - 3);
  return Math.max(1, Math.min(10,
    current_difficulty + difficulty_delta
  ));
}
```

**Calculate Next Interval**:
```javascript
function next_interval(stability) {
  const new_interval = stability * 9; // For 90% retention
  return Math.min(new_interval, FSRS_PARAMS.maximum_interval);
}
```

### 3.5 Review Processing Algorithm

```javascript
async function processReview(flashcardId, rating, timestamp) {
  const card = await db.select(`flashcards:${flashcardId}`);

  // Calculate elapsed time
  const elapsed_days = card.last_review
    ? (timestamp - card.last_review) / 86400000  // ms to days
    : 0;

  // Calculate retrievability
  const retrievability = card.stability > 0
    ? Math.exp(-elapsed_days / card.stability)
    : 0;

  let new_state, new_stability, new_difficulty, new_interval;

  switch (card.state) {
    case 'uninitiated':
      // First ever review
      new_state = 'new';
      new_stability = init_stability(rating);
      new_difficulty = init_difficulty(rating);
      new_interval = next_interval(new_stability);
      break;

    case 'new':
      new_state = 'learning';
      new_stability = init_stability(rating);
      new_difficulty = init_difficulty(rating);
      new_interval = FSRS_PARAMS.learning_steps[0]; // 1 minute
      break;

    case 'learning':
      if (rating >= 3) {
        new_state = 'review';
        new_stability = next_stability(card.stability, card.difficulty, rating, retrievability);
        new_difficulty = next_difficulty(card.difficulty, rating);
        new_interval = next_interval(new_stability);
      } else {
        new_state = 'relearning';
        new_stability = card.stability * 0.5; // Halve stability on failure
        new_difficulty = next_difficulty(card.difficulty, rating);
        new_interval = FSRS_PARAMS.relearning_steps[0]; // 10 minutes
      }
      break;

    case 'review':
      if (rating >= 3) {
        new_state = 'review';
        new_stability = next_stability(card.stability, card.difficulty, rating, retrievability);
        new_difficulty = next_difficulty(card.difficulty, rating);
        new_interval = next_interval(new_stability);
      } else {
        new_state = 'relearning';
        new_stability = card.stability * 0.5;
        new_difficulty = next_difficulty(card.difficulty, rating);
        new_interval = FSRS_PARAMS.relearning_steps[0];
        // Increment lapses
      }
      break;

    case 'relearning':
      if (rating >= 3) {
        new_state = 'review';
        new_stability = next_stability(card.stability, card.difficulty, rating, retrievability);
        new_difficulty = next_difficulty(card.difficulty, rating);
        new_interval = next_interval(new_stability);
      } else {
        new_state = 'relearning';
        new_stability = card.stability * 0.5;
        new_difficulty = next_difficulty(card.difficulty, rating);
        new_interval = FSRS_PARAMS.relearning_steps[0];
      }
      break;
  }

  // Update flashcard
  await db.query(`
    UPDATE flashcards:${flashcardId} SET
      state = $state,
      stability = $stability,
      difficulty = $difficulty,
      scheduled_days = $scheduled_days,
      elapsed_days = $elapsed_days,
      reps = reps + 1,
      lapses = lapses + $lapse_increment,
      last_review = $timestamp,
      due = $due,
      review_log = $review_log,
      updated_at = time::now()
  `, {
    state: new_state,
    stability: new_stability,
    difficulty: new_difficulty,
    scheduled_days: new_interval,
    elapsed_days: elapsed_days,
    lapse_increment: (rating < 3) ? 1 : 0,
    timestamp: timestamp,
    due: new Date(timestamp.getTime() + new_interval * 86400000), // days to ms
    review_log: compressReviewLog(card.review_log, timestamp, rating)
  });
}
```

---

## 4. State Management

### 4.1 State Definitions

| State | Description | FSRS Use | Due Interval |
|-------|-------------|----------|--------------|
| `uninitiated` | Never reviewed, lazy-created | Pre-FSRS | Immediate (now) |
| `new` | First review completed | Initial learning | 1 minute |
| `learning` | Short-term learning phase | Active learning | 1-10 minutes |
| `review` | Long-term retention | Graduated card | Days to months |
| `relearning` | Failed review, relearning | Recovery | 10 minutes → days |

### 4.2 State Transition Rules

**uninitiated → new**
- Trigger: First review submitted (any rating)
- FSRS: Calculate initial S and D

**new → learning**
- Trigger: Second review submitted
- FSRS: Apply learning_steps intervals

**learning → review**
- Trigger: Rating ≥ 3 (Good/Easy)
- FSRS: Graduate to long intervals

**learning → relearning**
- Trigger: Rating < 3 (Again/Hard)
- FSRS: Apply relearning_steps, increment lapses

**review → review**
- Trigger: Rating ≥ 3
- FSRS: Increase interval based on stability

**review → relearning**
- Trigger: Rating < 3
- FSRS: Halve stability, increment lapses

**relearning → review**
- Trigger: Rating ≥ 3
- FSRS: Return to graduated intervals

**relearning → relearning**
- Trigger: Rating < 3
- FSRS: Continue relearning steps

### 4.3 Lapse Handling

**Definition:** Lapse = forgetting a card (rating < 3 in review/relearning state)

**Effects:**
- Increment `lapses` counter
- Halve `stability` (S = S × 0.5)
- Reset to `relearning` state
- Apply short relearning interval

---

## 5. Review History Compression

### 5.1 Compression Strategy

**Problem:** Storing full review history for 10,000 cards × 100 reviews = 1M records

**Solution:** Compressed object storage using:
1. **Aliases** - Short property names
2. **Delta Encoding** - Store timestamp diffs, not absolutes
3. **Run-Length Encoding** - Compress repeated ratings (optional)

### 5.2 Compressed Format

```javascript
{
  b: 1703001600000,        // base timestamp (ms since epoch)
  d: [0, 86400, 172800],   // deltas in seconds
  r: [3, 3, 4]             // ratings (1-4)
}
```

**Example:**
```javascript
// Original reviews
[
  { timestamp: 1703001600000, rating: 3 }, // Dec 20, 2024 00:00:00
  { timestamp: 1703088000000, rating: 3 }, // Dec 21, 2024 00:00:00
  { timestamp: 1703174400000, rating: 4 }  // Dec 22, 2024 00:00:00
]

// Compressed
{
  b: 1703001600000,
  d: [0, 86400000, 172800000],  // ms deltas
  r: [3, 3, 4]
}

// Space saved: ~60% (120 bytes → 48 bytes per review set)
```

### 5.3 Compression Functions

```javascript
function compressReviewLog(existingLog, newTimestamp, newRating) {
  if (!existingLog) {
    return {
      b: newTimestamp,
      d: [0],
      r: [newRating]
    };
  }

  const delta = newTimestamp - existingLog.b;

  return {
    b: existingLog.b,
    d: [...existingLog.d, delta],
    r: [...existingLog.r, newRating]
  };
}

function decompressReviewLog(compressedLog) {
  if (!compressedLog) return [];

  return compressedLog.d.map((delta, i) => ({
    timestamp: compressedLog.b + delta,
    rating: compressedLog.r[i]
  }));
}
```

### 5.4 Optional: RLE Enhancement

For users with consistent ratings (many 3's in a row):

```javascript
{
  b: 1703001600000,
  d: [0, 86400, 172800, 259200, 345600],
  r: [3, 3, 3, 3, 4]
}

// With RLE
{
  b: 1703001600000,
  d: [0, 86400, 172800, 259200, 345600],
  rle: [[3, 4], [4, 1]]  // [value, count]
}
```

**Decision:** Implement RLE later if storage becomes issue.

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

## 10. Implementation Checklist

### Phase 1: Database & Schema (Week 1)
- [ ] Add flashcards table to `modules/db/schema.surql`
- [ ] Add reviews RELATION table
- [ ] Update TypeScript types in `modules/content/schema.ts`
- [ ] Create `modules/flashcards/schema.ts` with FSRS types
- [ ] Run migrations on dev database

### Phase 2: FSRS Algorithm (Week 2)
- [ ] Create `modules/flashcards/fsrs.ts`
- [ ] Implement FSRS core functions (stability, difficulty, interval)
- [ ] Implement state machine transitions
- [ ] Add unit tests for FSRS calculations
- [ ] Implement review history compression

### Phase 3: Backend Queries (Week 2-3)
- [ ] Create `modules/flashcards/queries.ts`
- [ ] Implement `initializeFlashcards()` lazy creation
- [ ] Implement `getDueFlashcards()` with priority sorting
- [ ] Create `modules/flashcards/actions.ts`
- [ ] Implement `submitReview()` server action
- [ ] Add input validation (Zod schemas)

### Phase 4: Graph Distance (Week 3)
- [ ] Research SurrealDB graph traversal for parent edges
- [ ] Implement `getRelatedCardNodes()` query
- [ ] Create `modules/flashcards/family.ts`
- [ ] Implement family grouping algorithm
- [ ] Test with sample workspace data

### Phase 5: Frontend UI (Week 4)
- [ ] Create `/[workspaceSlug]/flashcards` route
- [ ] Build `ReviewSession` client component
- [ ] Build `FlashcardRenderer` with cloze support
- [ ] Add rating buttons (1-4 difficulty scale)
- [ ] Show progress (X cards remaining)
- [ ] Mobile-responsive design

### Phase 6: Cloze Rendering (Week 4-5)
- [ ] Update `modules/logseq/process-references.ts`
- [ ] Add `processCloze()` function
- [ ] Parse `{{cloze text}}` and `{{c1 text}}` syntax
- [ ] Render as clickable spans with hidden content
- [ ] Add CSS for reveal animations

### Phase 7: Integration Testing (Week 5)
- [ ] Test lazy initialization with large workspace
- [ ] Test FSRS calculations across state transitions
- [ ] Test review history compression/decompression
- [ ] Test family grouping with real graph data
- [ ] Mobile device testing

### Phase 8: Polish & Launch (Week 6)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add stats dashboard
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Deploy to production

---

## 11. FSRS Weight Optimization (Advanced)

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

**Tool:** [fsrs-optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer) (Python library)

**Input Data Format:**
```csv
card_id,review_time,review_rating,review_state,review_duration
abc123,1703001600000,3,2,5000
abc123,1703088000000,4,2,3000
def456,1703001700000,2,1,8000
```

**Required Columns:**
- `card_id` - Flashcard identifier (string or int)
- `review_time` - Timestamp in milliseconds (UTC)
- `review_rating` - Rating as 1-4 (1=Again, 2=Hard, 3=Good, 4=Easy)

**Optional Columns:**
- `review_state` - State as 0-3 (0=New, 1=Learning, 2=Review, 3=Relearning)
- `review_duration` - Time spent reviewing in milliseconds

**Output:**
```json
{
  "w": [0.4072, 1.1829, 3.1262, ...],  // Optimized 19 weights
  "request_retention": 0.9
}
```

### 11.3 Integration into Draehi

**Database Schema Addition:**

```sql
-- Add to users table
DEFINE FIELD fsrs_weights ON users TYPE option<array>;
DEFINE FIELD last_optimization ON users TYPE option<datetime>;
DEFINE FIELD total_reviews ON users TYPE number DEFAULT 0;
```

**Optimization Workflow:**

```javascript
async function shouldOptimizeWeights(userId) {
  const user = await db.select(`users:${userId}`);

  // Minimum threshold: 100 reviews (conservative, research shows 16 works)
  if (user.total_reviews < 100) return false;

  // Optimize when reviews double: 100, 200, 400, 800, etc.
  const lastOptAt = user.last_optimization_review_count || 0;
  if (user.total_reviews >= lastOptAt * 2) return true;

  // Or monthly if active
  const daysSinceOpt = user.last_optimization
    ? (Date.now() - user.last_optimization) / 86400000
    : 999;
  if (daysSinceOpt >= 30 && user.total_reviews > lastOptAt + 50) return true;

  return false;
}
```

### 11.4 Export Review Logs for Optimization

```javascript
async function exportReviewLogsCSV(userId) {
  const flashcards = await db.query(`
    SELECT * FROM ->reviews->flashcards WHERE in = users:${userId}
  `);

  const rows = [];

  for (const card of flashcards) {
    // Decompress review history
    const reviews = decompressReviewLog(card.review_log);

    for (const review of reviews) {
      rows.push({
        card_id: card.node,
        review_time: review.timestamp,
        review_rating: review.rating,
        review_state: stateToInt(card.state),  // 0-3 mapping
        review_duration: 0  // Optional: track if needed
      });
    }
  }

  return rows; // Convert to CSV format
}

function stateToInt(state) {
  const mapping = {
    'new': 0,
    'learning': 1,
    'review': 2,
    'relearning': 3,
    'uninitiated': 0  // Treat as new
  };
  return mapping[state] || 0;
}
```

### 11.5 Run Optimizer (Server-Side Python)

```python
# scripts/optimize-fsrs-weights.py
from fsrs_optimizer import Optimizer
import sys
import json

def optimize_weights(csv_path):
    optimizer = Optimizer()
    optimizer.define_model()

    # Load review data
    optimizer.load_data(csv_path)

    # Train model
    optimizer.train()

    # Get optimized parameters
    params = optimizer.get_parameters()

    return params

if __name__ == "__main__":
    csv_path = sys.argv[1]
    result = optimize_weights(csv_path)
    print(json.dumps(result))
```

**Node.js Wrapper:**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';

const execAsync = promisify(exec);

async function optimizeUserWeights(userId: string) {
  // Export review logs to CSV
  const reviews = await exportReviewLogsCSV(userId);
  const csvPath = `/tmp/reviews_${userId}.csv`;
  await writeFile(csvPath, toCSV(reviews));

  // Run Python optimizer
  const { stdout } = await execAsync(
    `python3 scripts/optimize-fsrs-weights.py ${csvPath}`
  );

  const optimized = JSON.parse(stdout);

  // Store optimized weights in database
  await db.query(`
    UPDATE users:${userId} SET
      fsrs_weights = $weights,
      last_optimization = time::now(),
      last_optimization_review_count = total_reviews
  `, {
    weights: optimized.w
  });

  return optimized;
}
```

### 11.6 Use User-Specific Weights

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
