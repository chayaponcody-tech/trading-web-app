/**
 * TradeValidator (Hard Rules)
 * Enforces rigid constraints before any order is sent to the exchange.
 * Inspired by the "Pre-Trade Checklist" in the reference materials.
 */
export class TradeValidator {
  /**
   * @param {object} botManager - Reference to the BotManager instance
   */
  constructor(botManager) {
    this.botManager = botManager;
  }

  /**
   * Validate a potential trade signal.
   * @returns {{ approved: boolean, reason: string }}
   */
  validate(bot, signal, price) {
    if (this.botManager?.config?.tradeValidatorEnabled === false) {
      return { approved: true, reason: 'Trade Validator disabled in global config.' };
    }

    const bots = Array.from(this.botManager.bots.values());
    const activePositions = bots.reduce((sum, b) => sum + (b.openPositions?.length || 0), 0);
    
    // Rule 1: Max Portfolio Positions
    const MAX_POSITIONS = 6;
    if (activePositions >= MAX_POSITIONS && bot.openPositions.length === 0) {
      return {
        approved: false,
        reason: `HARD RULE: Max portfolio positions reached (${MAX_POSITIONS}). Entry blocked for portfolio safety.`
      };
    }

    // Rule 2: Max Allocation per Bot (Equity usage)
    // Avoid putting too much into one symbol
    const { positionSizeUSDT = 0 } = bot.config;
    const totalEquity = bot.equity || 100;
    const allocationPct = (positionSizeUSDT / totalEquity) * 100;

    if (allocationPct > 25) {
       return {
         approved: false,
         reason: `HARD RULE: Position size too large (${allocationPct.toFixed(1)}% of equity). Max 25% allowed per trade.`
       };
    }

    // Rule 3: Mandatory Risk Management (TP/SL)
    const { tpPercent, slPercent, trailingStopPct } = bot.config;
    const hasExitPlan = (tpPercent > 0 && slPercent > 0) || (trailingStopPct > 0);
    
    if (!hasExitPlan) {
      return {
        approved: false,
        reason: `HARD RULE: No exit plan defined (TP/SL or Trailing Stop must be set).`
      };
    }

    // Rule 4: Minimum Capital Check
    if (bot.equity < 10) {
       return {
         approved: false,
         reason: `HARD RULE: Insufficient bot equity (${bot.equity.toFixed(2)} USDT). Minimum 10 USDT required to trade.`
       };
    }

    return { approved: true, reason: 'Passed all Hard Rule checks.' };
  }
}
