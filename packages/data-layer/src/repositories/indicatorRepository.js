import { db } from '../DatabaseManager.js';

/**
 * Repository for managing chart indicator configurations.
 */
export function getIndicatorConfigs() {
  if (!db) return [];
  const rows = db.prepare('SELECT id, config_json FROM indicator_configs').all();
  return rows.map(r => ({
    id: r.id,
    ...JSON.parse(r.config_json)
  }));
}

export function saveIndicatorConfig(id, config) {
  if (!db) return;
  const json = JSON.stringify(config);
  db.prepare(`
    INSERT INTO indicator_configs (id, config_json)
    VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json
  `).run(id, json);
}
