import https from 'https';

const OPENROUTER_HOST = 'openrouter.ai';
const OPENROUTER_PATH = '/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct';
const TIMEOUT_MS = 60_000;

const BASE_STRATEGY_INTERFACE = `
class BaseStrategy:
    def compute_signal(self, closes, highs, lows, volumes, params) -> dict:
        """
        Returns: {"signal": "LONG"|"SHORT"|"NONE", "stoploss": float|None, "metadata": dict}
        """
        raise NotImplementedError

    def get_metadata(self) -> dict:
        """
        Returns: {"name": str, "description": str, "version": str}
        """
        raise NotImplementedError
`.trim();

const EXAMPLE_STRATEGY = `
import pandas as pd
import ta
from base_strategy import BaseStrategy

class EMACrossStrategy(BaseStrategy):
    def compute_signal(self, closes, highs, lows, volumes, params=None):
        p = params or {}
        fast_p = int(p.get("fastPeriod", 20))
        slow_p = int(p.get("slowPeriod", 50))
        if len(closes) < slow_p + 1:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}
        close_series = pd.Series(closes, dtype=float)
        fast = ta.trend.ema_indicator(close_series, window=fast_p)
        slow = ta.trend.ema_indicator(close_series, window=slow_p)
        prev_fast, curr_fast = fast.iloc[-2], fast.iloc[-1]
        prev_slow, curr_slow = slow.iloc[-2], slow.iloc[-1]
        if prev_fast <= prev_slow and curr_fast > curr_slow:
            return {"signal": "LONG", "stoploss": None, "metadata": {"ema_fast": round(float(curr_fast), 4)}}
        if prev_fast >= prev_slow and curr_fast < curr_slow:
            return {"signal": "SHORT", "stoploss": None, "metadata": {"ema_fast": round(float(curr_fast), 4)}}
        return {"signal": "NONE", "stoploss": None, "metadata": {}}

    def get_metadata(self):
        return {"name": "EMACrossStrategy", "description": "EMA crossover strategy", "version": "1.0.0"}
`.trim();

export class PineScriptConverter {
  /**
   * Build the prompt sent to OpenRouter.
   * @param {string} pineScript
   * @returns {string}
   */
  buildPrompt(pineScript) {
    return `You are an expert Python quant developer. Convert the given Pine Script to a Python strategy class.

REQUIREMENTS:
1. The class MUST extend BaseStrategy
2. MUST implement compute_signal(closes, highs, lows, volumes, params) -> dict
3. MUST implement get_metadata() -> dict
4. compute_signal MUST return: {"signal": "LONG"|"SHORT"|"NONE", "stoploss": float|None, "metadata": dict}
5. Use pandas and the "ta" library (import ta) for indicator calculations — NOT pandas_ta, NOT numpy manually
6. Available ta functions: ta.trend.ema_indicator(), ta.trend.sma_indicator(), ta.momentum.rsi(), ta.volatility.BollingerBands(), ta.momentum.StochRSIIndicator(), ta.trend.macd()
7. Return ONLY the Python code block, no explanation

CRITICAL SAFETY RULES:
- ALWAYS check array length before calculations: if len(closes) < required_period: return {"signal": "NONE", ...}
- Use pd.Series(closes, dtype=float) to convert closes to pandas Series
- Always use .iloc[-1] and .iloc[-2] to get last values
- Guard against NaN: if pd.isna(value): return {"signal": "NONE", ...}

BASE CLASS INTERFACE:
${BASE_STRATEGY_INTERFACE}

EXAMPLE STRATEGY:
${EXAMPLE_STRATEGY}

PINE SCRIPT TO CONVERT:
${pineScript}`;
  }

  /**
   * Extract Python code from an OpenRouter response.
   * Handles 3 formats: markdown python block, plain code block, raw text.
   * @param {string} response
   * @returns {string}
   */
  extractPythonCode(response) {
    // 1. ```python ... ```
    const mdMatch = response.match(/```python\n([\s\S]+?)\n```/);
    if (mdMatch) return mdMatch[1].trim();

    // 2. ``` ... ```
    const codeMatch = response.match(/```\n([\s\S]+?)\n```/);
    if (codeMatch) return codeMatch[1].trim();

    // 3. Raw text that looks like Python
    if (response.includes('class ') && response.includes('def ')) return response.trim();

    throw new Error('ไม่พบ Python code ใน response');
  }

  /**
   * Validate that the Python code has the required BaseStrategy structure.
   * @param {string} code
   * @returns {boolean}
   */
  validatePythonStructure(code) {
    const hasBaseStrategy = /class\s+\w+\s*\(\s*BaseStrategy\s*\)/.test(code);
    const hasComputeSignal = /def\s+compute_signal\s*\(/.test(code);
    const hasGetMetadata = /def\s+get_metadata\s*\(/.test(code);
    return hasBaseStrategy && hasComputeSignal && hasGetMetadata;
  }

  /**
   * Extract the class name from Python code.
   * @param {string} code
   * @returns {string}
   */
  _extractClassName(code) {
    const match = code.match(/class\s+(\w+)\s*\(/);
    return match ? match[1] : 'ConvertedStrategy';
  }

  /**
   * Call OpenRouter API and convert Pine Script to Python BaseStrategy.
   * @param {string} pineScript
   * @param {string} [modelOverride]
   * @returns {Promise<{ pythonCode: string, className: string }>}
   */
  async convert(pineScript, modelOverride) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = modelOverride || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const prompt = this.buildPrompt(pineScript);

    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const rawResponse = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: OPENROUTER_HOST,
          path: OPENROUTER_PATH,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: TIMEOUT_MS,
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) {
              return reject(new Error(`OpenRouter [${res.statusCode}]: ${raw}`));
            }
            try {
              const parsed = JSON.parse(raw);
              const content = parsed.choices?.[0]?.message?.content ?? '';
              resolve(content);
            } catch (e) {
              reject(new Error(`OpenRouter parse error: ${e.message}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('การแปลงหมดเวลา กรุณาลองใหม่'));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });

    const pythonCode = this.extractPythonCode(rawResponse);

    if (!this.validatePythonStructure(pythonCode)) {
      throw new Error('ไม่สามารถแปลงได้ กรุณาตรวจสอบ Pine Script');
    }

    const className = this._extractClassName(pythonCode);
    return { pythonCode, className };
  }
}
