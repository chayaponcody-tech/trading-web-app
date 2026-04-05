
/**
 * Simple Notification Service for Telegram alerts.
 */
import { saveTelegramLog, getAllTradesFromBots } from '../../data-layer/src/index.js';

export class NotificationService {
    constructor(config = {}) {
        // Support both naming variations for stability
        this.token = config.telegramToken || config.telegramBotToken || '';
        this.chatId = config.telegramChatId || '';
        this.enabled = !!(this.token && this.chatId);
        
        if (this.enabled) {
            console.log('✅ [NotificationService] Telegram initialized with Chat ID:', this.chatId);
        } else {
            console.warn('⚠️ [NotificationService] Telegram credentials missing or incomplete.');
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

            // Save OUTGOING log
            saveTelegramLog('OUT', this.chatId, message);

            if (!response.ok) {
                // If it's a 403 or 401, the bot might be blocked or token invalid
            }
        } catch (e) {}
    }

    /** 
     * Start the Telegram command listener (Polling Mode)
     * @param {BotManager} botManager - to control bots via commands
     * @param {PortfolioManager} portfolioManager - to control portfolio via commands
     */
    async startPolling(botManager, portfolioManager) {
        if (!this.enabled) return;
        
        console.log('[NotificationService] Telegram Listener (Polling) Started');
        this.botManager = botManager;
        this.portfolioManager = portfolioManager;
        this.lastUpdateId = 0;
        
        // Loop for polling
        const poll = async () => {
            try {
                const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`;
                const response = await fetch(url);
                if (!response.ok) return;
                
                const data = await response.json();
                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        this.lastUpdateId = update.update_id;
                        if (update.message && update.message.text) {
                            // Save INCOMING log
                            try { saveTelegramLog('IN', update.message.chat.id, update.message.text); } catch {}
                            await this.handleCommand(update.message);
                        }
                    }
                }
            } catch (e) {}
            setTimeout(poll, 3000); 
        };
        
        poll();
    }

    async handleCommand(msg) {
        const text = msg.text.trim();
        const chatId = msg.chat.id.toString();

        if (chatId !== this.chatId) return;

        // 1. Direct Commands (Fast Response)
        if (text === '/start' || text === '/help') {
            await this.send('*👋 บอทผู้ช่วยเทรดส่วนตัวพร้อมแล้ว!*\n\n*คำสั่งพื้นฐาน (Monitoring):*\n/status - ดูสถานะบอทที่รันอยู่\n/profit - สรุปกำไรปัจจุบัน\n/history [date] - ประวัติการเทรด (เช่น /history 2024-04-04)\n\n*คำสั่งจัดการ (Management):*\n/start_portfolio - เปิดใช้ Auto-Pilot\n/stop_portfolio - ปิดระบบจัดการพอร์ต\n/start_bot <symbol> <strategy> - เปิดบอทคู่ใหม่\n/delete_bot <id> - ลบบอท (ใส่ 4 ตัวท้ายของ ID)');
            return;
        }

        // 2. Command Processing Logic
        if (text === '/start_portfolio') {
             if (this.portfolioManager) {
                 await this.portfolioManager.updateConfig({ isAutonomous: true });
                 await this.send('🚀 *Auto-Pilot Enabled:* ระบบเริ่มเฝ้าระวังและเปิดพอร์ตอัตโนมัติแล้วค่ะ');
                 return;
             }
        }
        if (text === '/stop_portfolio') {
             if (this.portfolioManager) {
                 await this.portfolioManager.updateConfig({ isAutonomous: false });
                 await this.send('🛑 *Auto-Pilot Disabled:* ปิดระบบวิเคราะห์พอร์ตอัตโนมัติแล้ว');
                 return;
             }
        }

        // START BOT: /start_bot BTCUSDT AI_GRID_SCALP
        if (text.startsWith('/start_bot')) {
            const parts = text.split(' ');
            if (parts.length < 3) {
                await this.send('⚠️ *รูปแบบไม่ถูกต้อง:* กรุณาพิมพ์ `/start_bot [SYMBOL] [STRATEGY]`\nเช่น `/start_bot BTCUSDT AI_GRID_SCALP`');
                return;
            }
            const symbol = parts[1].toUpperCase();
            const strategy = parts[2].toUpperCase();
            try {
                const config = {
                    symbol,
                    strategy,
                    interval: '15m',
                    positionSizeUSDT: 100,
                    leverage: 10,
                    exchange: 'binance_testnet'
                };
                const id = await this.botManager.startBot(config);
                await this.send(`✅ *Success:* เปิดบอท \`${symbol}\` ด้วยกลยุทธ์ \`${strategy}\` เรียบร้อยแล้ว (ID: \`${id.slice(-6)}\`)`);
            } catch (e) {
                await this.send(`❌ *Error:* ${e.message}`);
            }
            return;
        }

        // DELETE BOT: /delete_bot a1b2
        if (text.startsWith('/delete_bot')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await this.send('⚠️ *รูปแบบไม่ถูกต้อง:* กรุณาพิมพ์ `/delete_bot [ID_4_CHARS]`');
                return;
            }
            const partialId = parts[1].toLowerCase();
            const bots = Array.from(this.botManager.bots.values());
            const target = bots.find(b => b.id.toLowerCase().endsWith(partialId));
            
            if (!target) {
                await this.send(`❓ *ไม่พบบอทที่มี ID ลงท้ายด้วย:* \`${partialId}\``);
                return;
            }
            
            try {
                this.botManager.deleteBot(target.id);
                await this.send(`🗑️ *Deleted:* ลบบอท \`${target.config.symbol}\` (${target.id.slice(-4)}) เรียบร้อยแล้ว`);
            } catch (e) {
                await this.send(`❌ *Error:* ${e.message}`);
            }
            return;
        }

        // HISTORY: /history OR /history 2024-03-24
        if (text.startsWith('/history')) {
            const parts = text.split(' ');
            const targetDateStr = parts[1]; // undefined if only /history
            
            // Calculate today's date in Asia/Bangkok
            const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).split(' ')[0];
            const dateToFilter = targetDateStr || today;
            
            const allTrades = getAllTradesFromBots(this.botManager.bots);
            const filtered = allTrades.filter(t => {
                // From SQLite or JSON: exitTime is often ISO string or simple date string
                const exitTime = t.exitTime || '';
                return exitTime.startsWith(dateToFilter);
            });

            if (filtered.length === 0) {
                await this.send(`📭 *ไม่พบประวัติการเทรดสำหรับวันที่:* \`${dateToFilter}\` (ใช้รูปแบบ YYYY-MM-DD)`);
                return;
            }

            let totalPnL = filtered.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
            let res = `*📅 ประวัติการเทรด [${dateToFilter}]*\n`;
            res += `----------------------------\n`;
            filtered.forEach(t => {
                const pnl = parseFloat(t.pnl) || 0;
                const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
                const timeStr = t.exitTime ? new Date(t.exitTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                
                res += `${pnlEmoji} *${t.symbol}* (\`${t.strategy || 'N/A'}\`)\n`;
                res += `   ⌚ ${timeStr} | PnL: \`${pnl.toFixed(2)} USDT\`\n`;
                res += `   Entry: ${t.entryPrice?.toFixed(4)} → Exit: ${t.exitPrice?.toFixed(4)}\n\n`;
            });
            res += `----------------------------\n`;
            res += `*💰 สรุปรวม PNL ของวัน:* \`${totalPnL.toFixed(2)} USDT\``;
            await this.send(res);
            return;
        }

        const bots = Array.from(this.botManager.bots.values());

        if (text === '/status') {
             if (bots.length === 0) {
                 await this.send('📭 *ไม่มีบอทที่กำลังรันอยู่ในขณะนี้*');
                 return;
             }
             let res = `*📊 สถานะบอท (${bots.length} ตัว)*\n`;
             bots.forEach(b => res += `${b.isRunning ? '🟢' : '⚪'} *${b.config.symbol}*: \`${b.netPnl.toFixed(2)} USDT\` (\`${b.config.strategy}\`)\n`);
             await this.send(res);
             return;
        }

        if (text === '/profit') {
            let total = bots.reduce((sum, b) => sum + (b.netPnl || 0), 0);
            let realized = bots.reduce((sum, b) => sum + (b.realizedPnl || 0), 0);
            await this.send(`*💰 สรุปกำไร:* \`${total.toFixed(2)} USDT\` (ปิดไม้แล้ว: ${realized.toFixed(2)})`);
            return;
        }

        // 3. Natural Language Processing (via OpenRouter AI)
        const orKey = this.botManager.config.openRouterKey;
        const orModel = this.botManager.config.openRouterModel || 'google/gemini-2.0-flash-exp:free';

        if (!orKey) {
            await this.send('⚠️ *กรุณาตั้งค่า OpenRouter Key ในหน้า Config ก่อนใช้งาน AI Assistant นะคะ*');
            return;
        }

        try {
            const totalRealized = bots.reduce((sum, b) => sum + (b.realizedPnl || 0), 0);
            const totalUnrealized = bots.reduce((sum, b) => sum + (b.unrealizedPnl || 0), 0);

            const systemContext = {
                currentTime: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
                portfolioStatus: this.portfolioManager?.config.isAutonomous ? 'AUTO-PILOT ACTIVE' : 'MANUAL MODE',
                activeBots: bots.map(b => ({
                    id: b.id.slice(-4),
                    symbol: b.config.symbol,
                    strategy: b.config.strategy,
                    isRunning: b.isRunning,
                    pnl: b.netPnl.toFixed(2),
                    trades: b.totalTrades || 0,
                    lastSignal: b.lastSignal,
                    currentPrice: b.currentPrice
                })),
                totalProfit: {
                    realized: totalRealized.toFixed(2),
                    unrealized: totalUnrealized.toFixed(2),
                    net: (totalRealized + totalUnrealized).toFixed(2)
                }
            };

            const prompt = `
คุณคือ "Trading System Monitor" (บอทเฝ้าระวังระบบเทรด)
ตอบคำถามผู้ใช้งานโดยใช้ "SYSTEM CONTEXT" ด้านล่างนี้เท่านั้น

*กฎเหล็ก:*
1. ห้ามใช้ข้อมูลภายนอก ใช้แค่ SYSTEM CONTEXT
2. MONITOR และ REPORT เท่านั้น
3. หากผู้ใช้สั่งการที่ระบบไม่รองรับ ให้แจ้งว่า "ปัจจุบันฉันทำได้เพียงรายงานสถานะหรือทำตามเมนูช่วยเหลือเท่านั้น"
4. ต่อสั้น กระชับ ใช้ภาษาไทยแบบมืออาชีพปนเป็นกันเอง

---
SYSTEM CONTEXT:
${JSON.stringify(systemContext, null, 2)}
---

คำถาม: "${text}"
`.trim();

            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${orKey}`,
                    'HTTP-Referer': 'https://github.com/antigravity-trading',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: orModel,
                    messages: [
                        { role: 'system', content: 'You are a Thai trading bot assistant.' },
                        { role: 'user', content: prompt }
                    ]
                })
            });

            const data = await res.json();
            const reply = data.choices && data.choices[0] ? data.choices[0].message.content : 'ขออภัยค่ะ ฉันไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้';
            await this.send(reply);
        } catch (e) {
            await this.send(`❌ *Error:* ${e.message}`);
        }
    }

    /** Format and send position open alerts */
    async notifyOpen(bot, pos) {
        const symbol = bot.config.symbol.toUpperCase();
        const typeStr = pos.type === 'LONG' ? '🚀 LONG' : '📉 SHORT';
        
        const msg = `
*🔔 Position Opened: ${symbol}*
----------------------------
*Bot ID:* \`${bot.id.slice(-6)}\`
*Type:* ${typeStr}
*Price:* ${pos.entryPrice.toFixed(4)}
*Qty:* ${pos.quantity}
*Reason:* \`${pos.entryReason}\`
----------------------------
        `.trim();
        
        await this.send(msg);
    }

    /** Format and send trade exit alerts */
    async notifyTrade(bot, trade) {
        const symbol = trade.symbol.toUpperCase();
        const typeStr = trade.type === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
        const pnlStr = trade.pnl >= 0 ? `+${trade.pnl.toFixed(2)}` : `${trade.pnl.toFixed(2)}`;
        const pnlEmoji = trade.pnl >= 0 ? '💰' : '📉';

        const msg = `
*${pnlEmoji} Trade Closed: ${symbol}*
----------------------------
*Bot ID:* \`${bot.id.slice(-6)}\`
*Strategy:* \`${trade.strategy}\`
*Profit/Loss:* \`${pnlStr} USDT\`
*Entry:* ${trade.entryPrice.toFixed(4)}
*Exit:* ${trade.exitPrice.toFixed(4)}
*Reason:* \`${trade.reason}\`
----------------------------
*Net PnL:* \`${bot.netPnl?.toFixed(2) || '0'} USDT\`
        `.trim();

        await this.send(msg);
    }
}
