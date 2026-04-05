import express from 'express';
import { getWallet, updateWallet, getGoldWallet, updateGoldWallet } from '../../../data-layer/src/index.js';

export function createWalletRoutes() {
  const router = express.Router();

  // Crypto Wallet
  router.get('/', (req, res) => {
    res.json(getWallet());
  });

  router.post('/', (req, res) => {
    const newState = req.body;
    updateWallet(newState);
    res.json({ success: true, wallet: newState });
  });

  // Gold Wallet
  router.get('/gold', (req, res) => {
    res.json(getGoldWallet());
  });

  router.post('/gold', (req, res) => {
    const newState = req.body;
    updateGoldWallet(newState);
    res.json({ success: true, wallet: newState });
  });

  return router;
}
