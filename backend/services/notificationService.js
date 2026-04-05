
export class NotificationService {
    constructor(config = {}) {
        this.token = config.telegramToken || '';
        this.chatId = config.telegramChatId || '';
        this.enabled = !!(this.token && this.chatId);

        if (this.enabled) {
            console.log('✅ Telegram Notification Service Initialized');
        } else {
            console.warn('⚠️ Telegram credentials missing. Notifications disabled.');
        }
    }

    async send(message, parseMode = 'Markdown') {
        if (!this.enabled) return;

        const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: parseMode
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('[NotificationService] Telegram Error:', error);
            }
        } catch (e) {
            console.error('[NotificationService] Failed to send message:', e.message);
        }
    }

    // Helper for formatted trade alerts
    async notifyTrade(bot, trade) {
        const symbol = trade.symbol.toUpperCase();
        const type = trade.type === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
        const pnl = trade.pnl >= 0 ? `+${trade.pnl.toFixed(2)}` : `${trade.pnl.toFixed(2)}`;
        const pnlEmoji = trade.pnl >= 0 ? '💰' : '📉';

        const message = `
*${pnlEmoji} Trade Closed: ${symbol}*
----------------------------
*Bot ID:* \`${bot.id.slice(-6)}\`
*Strategy:* \`${trade.strategy}\`
*Type:* ${type}
*Entry:* ${trade.entryPrice.toFixed(2)}
*Exit:* ${trade.exitPrice.toFixed(2)}
*PnL:* \`${pnl} USDT\`
*Reason:* \`${trade.reason}\`
----------------------------
*Net PnL:* \`${bot.netPnl?.toFixed(2) || '0'} USDT\`
        `.trim();

        await this.send(message);
    }

    async notifyOpen(bot, pos) {
        const symbol = bot.config.symbol.toUpperCase();
        const type = pos.type === 'LONG' ? '🚀 LONG' : '📉 SHORT';

        const message = `
*🔔 Position Opened: ${symbol}*
----------------------------
*Bot ID:* \`${bot.id.slice(-6)}\`
*Type:* ${type}
*Price:* ${pos.entryPrice.toFixed(2)}
*Qty:* ${pos.quantity}
*Reason:* \`${pos.entryReason}\`
----------------------------
        `.trim();

        await this.send(message);
    }
}
