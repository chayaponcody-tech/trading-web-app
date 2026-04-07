import { Router } from 'express';
import { 
  getAllFleets, upsertFleet, deleteFleet, getFleetById, getFleetLogs 
} from '../../../data-layer/src/index.js';

/**
 * @param {Map<string, PortfolioManager>} portfolioManagers 
 * @param {Object} options - additional context (botManager, exchange)
 */
export function createPortfolioRoutes(portfolioManagers, { botManager, exchange }) {
  const r = Router();

  /** 🛒 List all fleets from DB */
  r.get('/fleets', (req, res) => {
    try {
      const fleets = getAllFleets();
      // Enrich with runtime status
      const enriched = fleets.map(f => {
        const pm = portfolioManagers.get(f.id);
        return {
          ...f,
          isRunning: pm ? pm.isRunning : false,
          currentAction: pm ? pm.currentAction : 'Inactive'
        };
      });
      res.json(enriched);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** ➕ Create new fleet */
  r.post('/fleets', async (req, res) => {
    try {
      const { name, config } = req.body;
      const id = 'fleet_' + Math.random().toString(36).substr(2, 9);
      const newFleet = {
        id,
        name: name || 'New Fleet',
        config: config || {
            isAutonomous: false,
            totalBudget: 1000,
            maxDailyLossPct: 5,
            targetBotCount: 3,
            riskMode: 'confident'
        },
        isRunning: 0
      };
      
      upsertFleet(newFleet);
      
      // We don't automatically start the runtime Manager here, 
      // the orchestrator in server.js or a specific /start endpoint should do it.
      // For simplicity, let's suggest a restart or implement dynamic start.
      res.json({ message: 'Fleet created. Please restart or toggle to activate.', fleet: newFleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** 📊 Get specific fleet status */
  r.get('/fleets/:id/status', (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    const fleet = getFleetById(id);
    
    if (!fleet) return res.status(404).json({ error: 'Fleet not found' });

    res.json({
      id: fleet.id,
      name: fleet.name,
      isRunning: pm ? pm.isRunning : false,
      currentAction: pm ? pm.currentAction : 'Off',
      config: pm ? pm.config : fleet.config,
      logs: pm ? pm.logs : getFleetLogs(id, 50)
    });
  });

  /** ⚙️ Update fleet settings */
  r.post('/fleets/:id/settings', async (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    
    try {
      if (pm) {
        const updated = await pm.updateConfig(req.body);
        res.json({ message: 'Fleet settings updated', config: updated });
      } else {
        const fleet = getFleetById(id);
        if (!fleet) return res.status(404).json({ error: 'Fleet not found' });
        
        if (req.body.name) {
          fleet.name = req.body.name;
          delete req.body.name;
        }

        fleet.config = { ...fleet.config, ...req.body };
        upsertFleet(fleet);
        res.json({ message: 'Fleet settings updated (persisted only)', config: fleet.config, name: fleet.name });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** ⏯️ Toggle fleet */
  r.post('/fleets/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const { active } = req.body;
    let pm = portfolioManagers.get(id);
    
    if (!pm && active) {
        // Dynamic instantiation if not running
        const { PortfolioManager } = await import('../../bot-engine/src/PortfolioManager.js');
        const fleet = getFleetById(id);
        if (!fleet) return res.status(404).json({ error: 'Fleet not found' });
        
        pm = new PortfolioManager(botManager, exchange, { 
            managerId: fleet.id, 
            name: fleet.name,
            config: fleet.config
        });
        await pm.init();
        portfolioManagers.set(id, pm);
    }

    if (pm) {
        if (active) pm.start();
        else pm.stop();
        res.json({ isRunning: pm.isRunning });
    } else {
        res.status(404).json({ error: 'Manager not available' });
    }
  });

  /** 🗑️ Delete fleet */
  r.delete('/fleets/:id', (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    if (pm) pm.stop();
    portfolioManagers.delete(id);
    deleteFleet(id);
    res.json({ success: true, message: 'Fleet deleted' });
  });

  // --- Legacy Compatibility (Targets default fleet) ---
  const getDefaultPM = () => Array.from(portfolioManagers.values())[0];

  r.get('/status', (req, res) => {
    const pm = getDefaultPM();
    if (!pm) return res.status(404).json({ error: 'No fleet active' });
    res.json({
      isRunning: pm.isRunning,
      currentAction: pm.currentAction,
      config: pm.config,
      logs: pm.logs
    });
  });

  r.post('/settings', async (req, res) => {
    const pm = getDefaultPM();
    if (!pm) return res.status(404).json({ error: 'No fleet active' });
    const updated = await pm.updateConfig(req.body);
    res.json({ message: 'Portfolio settings updated', config: updated });
  });

  r.post('/toggle', (req, res) => {
    const pm = getDefaultPM();
    if (!pm) return res.status(404).json({ error: 'No fleet active' });
    const { active } = req.body;
    if (active) pm.start();
    else pm.stop();
    res.json({ isRunning: pm.isRunning });
  });

  return r;
}
