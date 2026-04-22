import { Router } from 'express';
import { getIndicatorConfigs, saveIndicatorConfig } from '../../../data-layer/src/index.js';

export function createIndicatorRoutes() {
  const r = Router();

  r.get('/', (req, res) => {
    try {
      const configs = getIndicatorConfigs();
      res.json(configs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const config = req.body;
      saveIndicatorConfig(id, config);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
