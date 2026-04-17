/**
 * Property-based tests for strategyRepository
 *
 * Feature: strategy-management-backtest, Property 1: Strategy Definition Round-Trip
 * Feature: strategy-management-backtest, Property 2: Duplicate Name Rejection
 * Feature: strategy-management-backtest, Property 3: Partial Update Preserves Unchanged Fields
 * Feature: strategy-management-backtest, Property 4: Strategy List Ordering
 * Feature: strategy-management-backtest, Property 5: Filter Returns Only Matching Strategies
 * Feature: strategy-management-backtest, Property 6: Non-Existent Strategy Returns null
 */

import Database from 'better-sqlite3';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// ─── In-memory SQLite setup (must happen before importing repository) ─────────

const testDb = new Database(':memory:');

testDb.exec(`
  CREATE TABLE IF NOT EXISTS strategy_definitions (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    description   TEXT NOT NULL DEFAULT '',
    engineType    TEXT NOT NULL,
    defaultParams TEXT NOT NULL DEFAULT '{}',
    tags          TEXT NOT NULL DEFAULT '[]',
    parameters    TEXT NOT NULL DEFAULT '[]',
    pythonCodeFile TEXT,
    baseStrategy  TEXT,
    createdAt     TEXT NOT NULL,
    updatedAt     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_strategy_definitions_engineType ON strategy_definitions(engineType);
  CREATE INDEX IF NOT EXISTS idx_strategy_definitions_updatedAt ON strategy_definitions(updatedAt DESC);
`);

vi.mock('../DatabaseManager.js', () => ({ db: testDb }));

// Import AFTER mock is set up
const {
  createStrategy,
  getStrategyById,
  getAllStrategies,
  updateStrategy,
  deleteStrategy,
  strategyNameExists,
} = await import('../repositories/strategyRepository.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearTable() {
  testDb.exec('DELETE FROM strategy_definitions;');
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const engineTypeArb = fc.constantFrom('js', 'python');

const nameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

const tagsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  { maxLength: 5 }
);

const defaultParamsArb = fc.record({
  tpPercent: fc.float({ min: 0.5, max: 5, noNaN: true }),
  slPercent: fc.float({ min: 0.5, max: 3, noNaN: true }),
});

const strategyDefArb = fc.record({
  name: nameArb,
  description: fc.string({ maxLength: 200 }),
  engineType: engineTypeArb,
  defaultParams: defaultParamsArb,
  tags: tagsArb,
  parameters: fc.array(fc.record({ key: fc.string(), label: fc.string(), type: fc.constantFrom('number', 'text'), default: fc.integer() }), { maxLength: 3 }),
});

// ─── Property 1: Strategy Definition Round-Trip ───────────────────────────────
// Validates: Requirements 1.1, 2.1

describe('Property 1: Strategy Definition Round-Trip', () => {
  beforeEach(() => clearTable());

  it('fetching by id returns all fields identical to the created strategy', async () => {
    await fc.assert(
      fc.asyncProperty(strategyDefArb, async (def) => {
        clearTable();

        const created = createStrategy(def);
        expect(created).not.toBeNull();

        const loaded = getStrategyById(created.id);
        expect(loaded).not.toBeNull();

        // Identity
        expect(loaded.id).toBe(created.id);
        expect(loaded.name).toBe(created.name);
        expect(loaded.description).toBe(created.description);
        expect(loaded.engineType).toBe(created.engineType);
        expect(loaded.createdAt).toBe(created.createdAt);
        expect(loaded.updatedAt).toBe(created.updatedAt);

        // JSON fields round-trip
        expect(loaded.defaultParams).toEqual(created.defaultParams);
        expect(loaded.tags).toEqual(created.tags);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Duplicate Name Rejection ────────────────────────────────────
// Validates: Requirements 1.2

describe('Property 2: Duplicate Name Rejection', () => {
  beforeEach(() => clearTable());

  it('creating a strategy with an existing name must always throw or fail', async () => {
    await fc.assert(
      fc.asyncProperty(nameArb, engineTypeArb, engineTypeArb, async (name, engineType1, engineType2) => {
        clearTable();

        // Create the first strategy successfully
        const first = createStrategy({ name, engineType: engineType1 });
        expect(first).not.toBeNull();

        // Attempt to create a second strategy with the same name — must throw
        expect(() => {
          createStrategy({ name, engineType: engineType2, description: 'duplicate attempt' });
        }).toThrow();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Partial Update Preserves Unchanged Fields ───────────────────
// Validates: Requirements 1.4

describe('Property 3: Partial Update Preserves Unchanged Fields', () => {
  beforeEach(() => clearTable());

  it('updating only description leaves name, engineType, tags, defaultParams unchanged and updatedAt >= original', async () => {
    await fc.assert(
      fc.asyncProperty(
        strategyDefArb,
        fc.string({ maxLength: 200 }),
        async (def, newDescription) => {
          clearTable();

          const created = createStrategy(def);

          // Small delay to ensure updatedAt can differ (ISO strings have ms precision)
          // better-sqlite3 is sync so we just proceed — updatedAt >= createdAt is guaranteed
          const updated = updateStrategy(created.id, { description: newDescription });
          expect(updated).not.toBeNull();

          // Unchanged fields
          expect(updated.id).toBe(created.id);
          expect(updated.name).toBe(created.name);
          expect(updated.engineType).toBe(created.engineType);
          expect(updated.tags).toEqual(created.tags);
          expect(updated.defaultParams).toEqual(created.defaultParams);
          expect(updated.createdAt).toBe(created.createdAt);

          // Changed field
          expect(updated.description).toBe(newDescription);

          // updatedAt must be >= original updatedAt
          expect(updated.updatedAt >= created.updatedAt).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Strategy List Ordering ──────────────────────────────────────
// Validates: Requirements 1.7

describe('Property 4: Strategy List Ordering', () => {
  beforeEach(() => clearTable());

  it('getAllStrategies returns strategies ordered by updatedAt descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(strategyDefArb, { minLength: 2, maxLength: 6 }),
        async (defs) => {
          clearTable();

          // Deduplicate names to avoid UNIQUE constraint errors
          const seen = new Set();
          const unique = defs.filter(d => {
            if (seen.has(d.name)) return false;
            seen.add(d.name);
            return true;
          });

          if (unique.length < 2) return; // skip if not enough unique names

          for (const def of unique) {
            createStrategy(def);
          }

          const strategies = getAllStrategies();
          expect(strategies.length).toBeGreaterThanOrEqual(unique.length);

          // Verify descending order by updatedAt
          for (let i = 0; i < strategies.length - 1; i++) {
            expect(strategies[i].updatedAt >= strategies[i + 1].updatedAt).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Filter Returns Only Matching Strategies ─────────────────────
// Validates: Requirements 1.8

describe('Property 5: Filter Returns Only Matching Strategies', () => {
  beforeEach(() => clearTable());

  it('filtering by engineType returns only strategies with that engineType', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(strategyDefArb, { minLength: 2, maxLength: 8 }),
        engineTypeArb,
        async (defs, filterEngineType) => {
          clearTable();

          // Deduplicate names
          const seen = new Set();
          const unique = defs.filter(d => {
            if (seen.has(d.name)) return false;
            seen.add(d.name);
            return true;
          });

          for (const def of unique) {
            createStrategy(def);
          }

          const filtered = getAllStrategies({ engineType: filterEngineType });

          // Every returned strategy must match the filter
          for (const s of filtered) {
            expect(s.engineType).toBe(filterEngineType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtering by tag returns only strategies that include that tag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
        fc.array(strategyDefArb, { minLength: 2, maxLength: 6 }),
        async (filterTag, defs) => {
          clearTable();

          // Deduplicate names
          const seen = new Set();
          const unique = defs.filter(d => {
            if (seen.has(d.name)) return false;
            seen.add(d.name);
            return true;
          });

          for (const def of unique) {
            createStrategy(def);
          }

          const filtered = getAllStrategies({ tags: [filterTag] });

          // Every returned strategy must include the filter tag
          for (const s of filtered) {
            expect(s.tags).toContain(filterTag);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Non-Existent Strategy Returns null ──────────────────────────
// Validates: Requirements 2.5

describe('Property 6: Non-Existent Strategy Returns null', () => {
  beforeEach(() => clearTable());

  it('getStrategyById with a UUID that does not exist returns null', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (randomId) => {
        clearTable();

        const result = getStrategyById(randomId);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
