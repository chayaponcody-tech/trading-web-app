import { db } from '../DatabaseManager.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// ─── Strategy Code File Storage ───────────────────────────────────────────────

const rootDir = process.cwd();
const CODE_DIR = path.join(rootDir, 'strategy_code');

function ensureCodeDir() {
  if (!fs.existsSync(CODE_DIR)) fs.mkdirSync(CODE_DIR, { recursive: true });
}

function saveCodeFile(id, code, strategyName) {
  ensureCodeDir();
  const filePath = path.join(CODE_DIR, `${id}.py`);
  // Prepend strategy name as comment so Python loader can use it as registry key
  const header = `# strategy_key: ${strategyName}\n`;
  fs.writeFileSync(filePath, header + code, 'utf8');
  return filePath;
}

function readCodeFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function deleteCodeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ─── Strategy Repository ──────────────────────────────────────────────────────

/**
 * Parse JSON fields on a raw strategy row from SQLite.
 */
function parseStrategy(row) {
  if (!row) return null;
  return {
    ...row,
    defaultParams: JSON.parse(row.defaultParams || '{}'),
    tags: JSON.parse(row.tags || '[]'),
    parameters: JSON.parse(row.parameters || '[]'),
    pythonCode: readCodeFile(row.pythonCodeFile) ?? undefined,
  };
}

/**
 * Create a new strategy definition.
 * @param {object} definition - { name, description?, engineType, defaultParams?, tags? }
 * @returns {object} created strategy
 */
export function createStrategy(definition) {
  const {
    name,
    description = '',
    engineType,
    defaultParams = {},
    tags = [],
    parameters = [],
    pythonCode,
    baseStrategy = null,
  } = definition;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  let pythonCodeFile = null;
  if (engineType === 'python' && pythonCode) {
    pythonCodeFile = saveCodeFile(id, pythonCode, name);
  }

  db.prepare(`
    INSERT INTO strategy_definitions (id, name, description, engineType, defaultParams, tags, parameters, pythonCodeFile, baseStrategy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    description,
    engineType,
    JSON.stringify(defaultParams),
    JSON.stringify(tags),
    JSON.stringify(parameters),
    pythonCodeFile,
    baseStrategy,
    now,
    now,
  );

  return getStrategyById(id);
}

/**
 * Get a strategy by id.
 * @param {string} id
 * @returns {object|null}
 */
export function getStrategyById(id) {
  const row = db.prepare(`
    SELECT * FROM strategy_definitions WHERE id = ?
  `).get(id);
  return parseStrategy(row);
}

export function getStrategyByName(name) {
  const row = db.prepare(`
    SELECT * FROM strategy_definitions WHERE LOWER(name) = LOWER(?)
  `).get(name);
  return parseStrategy(row);
}

/**
 * Get all strategies with optional filtering.
 * @param {{ engineType?: string, tags?: string[] }} [filter]
 * @returns {object[]} ordered by updatedAt DESC
 */
export function getAllStrategies(filter = {}) {
  const { engineType, tags } = filter;

  // Build query dynamically based on filters
  const conditions = [];
  const params = [];

  if (engineType) {
    conditions.push('engineType = ?');
    params.push(engineType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT * FROM strategy_definitions
    ${whereClause}
    ORDER BY updatedAt DESC
  `).all(...params);

  let results = rows.map(parseStrategy);

  // Filter by tags in JS (SQLite JSON array filtering is cumbersome)
  if (tags && tags.length > 0) {
    results = results.filter(strategy =>
      tags.every(tag => strategy.tags.includes(tag))
    );
  }

  return results;
}

/**
 * Update a strategy (partial update). Only provided fields are updated.
 * @param {string} id
 * @param {object} partial - fields to update
 * @returns {object|null} updated strategy or null if not found
 */
export function updateStrategy(id, partial) {
  const existing = getStrategyById(id);
  if (!existing) return null;

  const updatableFields = ['name', 'description', 'engineType', 'defaultParams', 'tags', 'parameters', 'baseStrategy'];
  const setClauses = [];
  const params = [];

  for (const field of updatableFields) {
    if (field in partial) {
      setClauses.push(`${field} = ?`);
      const value = partial[field];
      if (field === 'defaultParams' || field === 'tags' || field === 'parameters') {
        params.push(JSON.stringify(value));
      } else {
        params.push(value);
      }
    }
  }

  // Handle pythonCode file update
  if ('pythonCode' in partial) {
    const engineType = partial.engineType ?? existing.engineType;
    if (engineType === 'python' && partial.pythonCode) {
      // Reuse existing file path or create new one
      const filePath = existing.pythonCodeFile ?? saveCodeFile(id, partial.pythonCode);
      if (existing.pythonCodeFile) {
        fs.writeFileSync(existing.pythonCodeFile, partial.pythonCode, 'utf8');
      }
      setClauses.push('pythonCodeFile = ?');
      params.push(filePath);
    } else if (!partial.pythonCode && existing.pythonCodeFile) {
      // Code cleared — remove file
      deleteCodeFile(existing.pythonCodeFile);
      setClauses.push('pythonCodeFile = ?');
      params.push(null);
    }
  }

  if (setClauses.length === 0) return existing;

  // Always update updatedAt
  setClauses.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.prepare(`
    UPDATE strategy_definitions
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `).run(...params);

  return getStrategyById(id);
}

/**
 * Delete a strategy by id.
 * @param {string} id
 * @returns {boolean} true if deleted, false if not found
 */
export function deleteStrategy(id) {
  const existing = getStrategyById(id);
  if (existing?.pythonCodeFile) deleteCodeFile(existing.pythonCodeFile);
  const result = db.prepare(`DELETE FROM strategy_definitions WHERE id = ?`).run(id);
  return result.changes > 0;
}

/**
 * Check if a strategy name already exists.
 * @param {string} name
 * @param {string} [excludeId] - exclude this id (for update duplicate checks)
 * @returns {boolean}
 */
export function strategyNameExists(name, excludeId) {
  let row;
  if (excludeId) {
    row = db.prepare(`
      SELECT id FROM strategy_definitions WHERE name = ? AND id != ?
    `).get(name, excludeId);
  } else {
    row = db.prepare(`
      SELECT id FROM strategy_definitions WHERE name = ?
    `).get(name);
  }
  return row !== undefined;
}

/**
 * Save a strategy backtest result.
 * @param {object} result
 * @returns {boolean}
 */
export function saveStrategyBacktestResult(result) {
  try {
    const {
      backtestId,
      strategyId,
      backtestType,
      symbols,
      interval,
      config,
      summaryMetrics,
      assetResults,
      createdAt,
    } = result;

    db.prepare(`
      INSERT INTO strategy_backtest_results
        (backtestId, strategyId, backtestType, symbols, interval, config, summaryMetrics, assetResults, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      backtestId,
      strategyId,
      backtestType,
      JSON.stringify(symbols),
      interval,
      JSON.stringify(config),
      JSON.stringify(summaryMetrics),
      JSON.stringify(assetResults),
      createdAt,
    );

    return true;
  } catch (e) {
    console.warn('[StrategyRepo] saveStrategyBacktestResult error:', e.message);
    return false;
  }
}

/**
 * Get backtest history for a strategy.
 * @param {string} strategyId
 * @param {number} [limit=20]
 * @returns {object[]}
 */
export function getStrategyBacktestHistory(strategyId, limit = 20) {
  try {
    const rows = db.prepare(`
      SELECT backtestId, strategyId, backtestType, symbols, interval, config, summaryMetrics, createdAt
      FROM strategy_backtest_results
      WHERE strategyId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(strategyId, limit);

    return rows.map(row => ({
      ...row,
      symbols: JSON.parse(row.symbols),
      config: JSON.parse(row.config),
      summaryMetrics: JSON.parse(row.summaryMetrics),
    }));
  } catch (e) {
    console.warn('[StrategyRepo] getStrategyBacktestHistory error:', e.message);
    return [];
  }
}

/**
 * Get a full backtest result by backtestId.
 * @param {string} backtestId
 * @returns {object|null}
 */
export function getStrategyBacktestById(backtestId) {
  try {
    const row = db.prepare(`
      SELECT * FROM strategy_backtest_results WHERE backtestId = ?
    `).get(backtestId);

    if (!row) return null;

    return {
      ...row,
      symbols: JSON.parse(row.symbols),
      config: JSON.parse(row.config),
      summaryMetrics: JSON.parse(row.summaryMetrics),
      assetResults: JSON.parse(row.assetResults),
    };
  } catch (e) {
    console.warn('[StrategyRepo] getStrategyBacktestById error:', e.message);
    return null;
  }
}
