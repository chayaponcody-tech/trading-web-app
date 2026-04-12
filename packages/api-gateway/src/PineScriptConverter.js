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
        Returns: {"name": str, "description": str, "params": dict}
        """
        raise NotImplementedError
`.trim();

const EXAMPLE_STRATEGY = `
from base_strategy import BaseStrategy
import numpy as np

class EMACrossStrategy(BaseStrategy):
    def compute_signal(self, closes, highs, lows, volumes, params):
        fast = params.get("fast_period", 20)
        slow = params.get("slow_period", 50)
        if len(closes) < slow:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}
        ema_fast = np.mean(closes[-fast:])
        ema_slow = np.mean(closes[-slow:])
        prev_fast = np.mean(closes[-fast-1:-1])
        prev_slow = np.mean(closes[-slow-1:-1])
        if prev_fast <= prev_slow and ema_fast > ema_slow:
            return {"signal": "LONG", "stoploss": closes[-1] * 0.98, "metadata": {"ema_fast": ema_fast}}
        if prev_fast >= prev_slow and ema_fast < ema_slow:
            return {"signal": "SHORT", "stoploss": closes[-1] * 1.02, "metadata": {"ema_fast": ema_fast}}
        return {"signal": "NONE", "stoploss": None, "metadata": {}}

    def get_metadata(self):
        return {"name": "EMA Cross", "description": "EMA crossover strategy", "params": {"fast_period": 20, "slow_period": 50}}
`.trim();

export class PineScriptConverter {
  /**
   * Build the prompt sent to OpenRouter.
   * @param {string} pineScript
   * @returns {string}
   */
  buildPrompt(pineScript) {
    return `You are an expert Python quant developer. Convert the given Pine Script to a Python class.

REQUIREMENTS:
1. The class MUST extend BaseStrategy
2. MUST implement compute_signal(closes, highs, lows, volumes, params) -> dict
3. MUST implement get_metadata() -> dict
4. compute_signal MUST return: {"signal": "LONG"|"SHORT"|"NONE", "stoploss": float|None, "metadata": dict}
5. Use numpy for calculations
6. Return ONLY the Python code block, no explanation

CRITICAL SAFETY RULES (MUST follow to avoid runtime errors):
- ALWAYS check array length before slicing or calling np.max/np.min/np.mean on any window
- If len(closes) < required_period, return {"signal": "NONE", "stoploss": None, "metadata": {}}
- NEVER call np.max() or np.min() on an empty array — always guard with: if len(arr) == 0: return ...
- For pivot_high/pivot_low patterns, always check that the slice has enough elements before reducing

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
   * @returns {Promise<{ pythonCode: string, className: string }>}
   */
  async convert(pineScript) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
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
