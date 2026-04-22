import { db, useSqlite } from '../DatabaseManager.js';

/**
 * ─── Fleet Repository ──────────────────────────────────────────────────────────
 * Persists multiple AI-managed fleets and their isolated logs.
 */

export function getAllFleets() {
  if (!useSqlite) return [];
  try {
    const rows = db.prepare('SELECT * FROM fleets').all();
    return rows.map(r => ({
      ...r,
      config: JSON.parse(r.config || '{}'),
      isRunning: r.isRunning === 1
    }));
  } catch (e) {
    console.error('[FleetRepo] getAllFleets error:', e.message);
    return [];
  }
}

export function getFleetById(id) {
  if (!useSqlite) return null;
  try {
    const r = db.prepare('SELECT * FROM fleets WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...r,
      config: JSON.parse(r.config || '{}'),
      isRunning: r.isRunning === 1
    };
  } catch { return null; }
}

export function upsertFleet(fleet) {
  if (!useSqlite) return false;
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO fleets (id, name, config, isRunning, vaultBalance)
      VALUES (@id, @name, @config, @isRunning, @vaultBalance)
    `);
    insert.run({
      id: fleet.id,
      name: fleet.name,
      config: JSON.stringify(fleet.config || {}),
      isRunning: fleet.isRunning ? 1 : 0,
      vaultBalance: fleet.vaultBalance || 0
    });
    return true;
  } catch (e) {
    console.error('[FleetRepo] upsertFleet error:', e.message);
    return false;
  }
}

export function addToFleetVault(id, amount) {
  if (!useSqlite) return false;
  try {
    db.prepare('UPDATE fleets SET vaultBalance = vaultBalance + ? WHERE id = ?').run(amount, id);
    return true;
  } catch (e) {
    console.error('[FleetRepo] addToFleetVault error:', e.message);
    return false;
  }
}

export function deleteFleet(id) {
  if (!useSqlite) return false;
  try {
    const trx = db.transaction(() => {
      db.prepare('DELETE FROM fleets WHERE id = ?').run(id);
      db.prepare('DELETE FROM fleet_logs WHERE fleetId = ?').run(id);
      // Optional: Stop/Delete bots associated with this fleet? 
      // User should probably handle bot lifecycle separately or we tag them.
    });
    trx();
    return true;
  } catch { return false; }
}

// ─── Fleet Logs ──────────────────────────────────────────────────────────────

export function addFleetLog(fleetId, message, type = 'info') {
  if (!useSqlite) return false;
  try {
    db.prepare('INSERT INTO fleet_logs (fleetId, message, type) VALUES (?, ?, ?)')
      .run(fleetId, message, type);
    return true;
  } catch (e) {
    console.error('[FleetRepo] addFleetLog error:', e.message);
    return false;
  }
}

export function getFleetLogs(fleetId, limit = 50) {
  if (!useSqlite) return [];
  try {
    return db.prepare('SELECT * FROM fleet_logs WHERE fleetId = ? ORDER BY timestamp DESC LIMIT ?')
      .all(fleetId, limit);
  } catch { return []; }
}

export function saveGlobalAiReport(report_md) {
  if (!useSqlite) return false;
  try {
    db.prepare('INSERT INTO global_ai_reports (report_md) VALUES (?)').run(report_md);
    return true;
  } catch (e) {
    console.error('[FleetRepo] saveGlobalAiReport error:', e.message);
    return false;
  }
}

export function getGlobalAiReports(limit = 10) {
  if (!useSqlite) return [];
  try {
    return db.prepare('SELECT * FROM global_ai_reports ORDER BY timestamp DESC LIMIT ?').all(limit);
  } catch { return []; }
}

