import https from 'https';

export async function callOpenRouter(prompt, apiKey, model = 'google/gemini-2.0-flash-exp:free', options = {}) {
    return new Promise((resolve, reject) => {
        const apiBody = JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: options.max_tokens || 4000,
            temperature: options.temperature || 0.1,
            response_format: options.response_format || { type: "json_object" }
        });

        const apiReq = https.request({
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: options.timeout || 40000
        }, (res) => {
            let resData = '';
            res.on('data', d => resData += d);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        throw new Error(`AI Provider status ${res.statusCode}: ${resData}`);
                    }
                    const result = JSON.parse(resData);
                    let aiText = result.choices?.[0]?.message?.content || '{}';
                    
                    // Extract JSON cleanup
                    const jsonStart = aiText.indexOf('{');
                    const jsonEnd = aiText.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        aiText = aiText.substring(jsonStart, jsonEnd + 1);
                    }
                    
                    resolve(JSON.parse(aiText));
                } catch (e) {
                    reject(e);
                }
            });
        });

        apiReq.on('timeout', () => {
            apiReq.destroy();
            reject(new Error('AI Request timed out'));
        });

        apiReq.on('error', e => reject(e));
        apiReq.write(apiBody);
        apiReq.end();
    });
}

export async function getBotRecommendations(context, count, aiType, apiKey, model, symbol) {
    let promptDesc = "BEST for 5m Scalping (AI_SCOUTER)";
    let expectedStrategy = "AI_SCOUTER";
    let expectedInterval = "5m";
    
    if (aiType === 'confident') {
        promptDesc = "BEST for 15m Trend following / High Winrate (EMA_RSI)";
        expectedStrategy = "EMA_RSI";
        expectedInterval = "15m";
    } else if (aiType === 'grid') {
        promptDesc = "BEST for 1h Grid Trading boundary mapping (GRID). Identify clear support and resistance levels for upper/lower grid bounds.";
        expectedStrategy = "AI_GRID";
        expectedInterval = "1h";
    }

    const prompt = `You are a QUANT SCANNER. Review these top performers on Binance:
    ${JSON.stringify(context)}

    TASK:
    1. Suggest EXACTLY ONE recommendation for the ${symbol} coin using the ${promptDesc} approach.
    2. RESPONSE FORMAT MUST BE THIS EXACT JSON:
    {
      "symbol": "${symbol}",
      "strategy": "${expectedStrategy}",
      "interval": "${expectedInterval}",
      "tp": 0.8,
      "sl": 0.5,
      "leverage": 15,
      "expected_duration_min": 60,
      "ai_check_interval": 30,
      "reason": "Explain in THAI why this coin is perfect for this strategy right now.",
      "grid_upper": 70000, 
      "grid_lower": 65000
    }
    No wrappers, no arrays. Just the object. Do NOT include any markdown or commentary. If NOT grid mode, set grid_upper/lower to null.`;

    try {
        const raw = await callOpenRouter(prompt, apiKey, model);
        console.log(`[AI Recommend] Raw Response for ${symbol}:`, JSON.stringify(raw));

        // Robust parsing and defaults
        const result = {
            symbol: raw.symbol || symbol || 'BTCUSDT',
            strategy: raw.strategy || expectedStrategy,
            interval: raw.interval || expectedInterval,
            tp: parseFloat(raw.tp) || 1.5,
            sl: parseFloat(raw.sl) || 0.5,
            leverage: parseInt(raw.leverage) || 10,
            expected_duration_min: parseInt(raw.expected_duration_min) || 240,
            ai_check_interval: parseInt(raw.ai_check_interval) || 30,
            reason: raw.reason || "วิเคราะห์ตามเทรนปัจจุบันที่เหมาะสม",
            grid_upper: raw.grid_upper ? parseFloat(raw.grid_upper) : null,
            grid_lower: raw.grid_lower ? parseFloat(raw.grid_lower) : null
        };

        // Final sanity check for NaN
        if (isNaN(result.tp)) result.tp = 1.5;
        if (isNaN(result.sl)) result.sl = 0.5;
        if (isNaN(result.leverage)) result.leverage = 10;
        
        return result;
    } catch (e) {
        console.error('[AI Recommend] Parsing Error:', e.message);
        throw e;
    }
}

export async function getFleetProposal(context, count, capital, durationMins, instructions, apiKey, model) {
    const prompt = `You are an EXPERT CRYPTO QUANT. Plan a FLEET of exactly ${count} bot(s).
    Capital: $${capital} USDT | Duration: ${durationMins} mins
    Goal: "${instructions}"

    Top Selection List (24h stats):
    ${JSON.stringify(context.slice(0, 30))}

    STRATEGY TYPES:
    1. "EMA_RSI": Trend following, interval 15m.
    2. "AI_SCOUTER": Aggressive scalping, interval 5m.
    3. "AI_GRID": Range trading. Suggest for coins in consolidation. REQUIRE "grid_upper" and "grid_lower" (numbers) based on 24h High/Low context.

    RESPONSE FORMAT (STRICT VALID JSON ONLY, NO CONVERSATION):
    {
      "confident": {
        "name": "🛡️ Confident Fleet",
        "description": "Thai rationale..",
        "coins": [ { "symbol": "BTCUSDT", "strategy": "EMA_RSI", "interval": "15m", "tp": 2.0, "sl": 1.0, "leverage": 10 } ]
      },
      "scout": {
        "name": "🏹 Scouting Fleet",
        "description": "Thai rationale..",
        "coins": [ { "symbol": "DOGEUSDT", "strategy": "AI_SCOUTER", "interval": "5m", "tp": 1.5, "sl": 0.5, "leverage": 20 } ]
      }
    }
    Rules: 
    1. "coins" arrays MUST have exactly ${count} objects.
    2. If using "AI_GRID", you MUST include "grid_upper" and "grid_lower" (numbers) for that coin.
    3. NO MARKDOWN.`;

    return callOpenRouter(prompt, apiKey, model);
}
