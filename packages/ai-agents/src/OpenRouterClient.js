import https from 'https';

// ─── OpenRouter HTTP Client ───────────────────────────────────────────────────
// Single HTTP wrapper for all AI calls.
// Handles auth, timeouts, JSON extraction, and error propagation.

let globalUsageLogger = null;
export function setUsageLogger(fn) {
  globalUsageLogger = fn;
}

const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
const OPENROUTER_HOST = 'openrouter.ai';
const OPENROUTER_PATH = '/api/v1/chat/completions';

/**
 * @param {string} prompt
 * @param {string} apiKey
 * @param {string} [model]
 * @param {object} [opts]
 * @param {boolean} [opts.jsonMode] - Force JSON object response (default: true)
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @param {number} [opts.timeout]  - ms
 * @param {number} [opts.retries]  - number of retries for 429
 * @returns {Promise<object|string>} Parsed JSON object or raw string
 */
export async function callOpenRouter(prompt, apiKey, model = DEFAULT_MODEL, opts = {}) {
  const {
    jsonMode = true,
    maxTokens = 1000,
    temperature = 0.1,
    timeout = 45000,
    retries = 2,
  } = opts;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
      ...(jsonMode && { response_format: { type: 'json_object' } }),
    });

    const req = https.request(
      {
        hostname: OPENROUTER_HOST,
        path: OPENROUTER_PATH,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/chayaponcody-tech/trading-web-app',
          'X-Title': 'AI Trading App',
        },
        timeout,
      },
      (res) => {
        let raw = '';
        res.on('data', (d) => (raw += d));
        res.on('end', () => {
          try {
            if (res.statusCode === 429 && retries > 0) {
              console.warn(`[OpenRouter] ⚠️ Rate limited (429). Retrying in 5s... (${retries} left)`);
              return setTimeout(() => {
                 resolve(callOpenRouter(prompt, apiKey, model, { ...opts, retries: retries - 1 }));
              }, 5000);
            }

            if (res.statusCode !== 200) {
              return reject(new Error(`OpenRouter [${res.statusCode}]: ${raw}`));
            }
            const result = JSON.parse(raw);
            
            // LOG USAGE FOR COST TRACKING
            if (result.usage) {
               const { prompt_tokens, completion_tokens, total_tokens } = result.usage;
               console.log(`[AI-COST] Model: ${model} | Tokens: ${prompt_tokens}p + ${completion_tokens}c = ${total_tokens} total`);
               
               const usageData = { ...result.usage, model, feature: opts.feature || 'unknown' };
               if (opts.onUsage) opts.onUsage(usageData);
               if (globalUsageLogger) globalUsageLogger(usageData);
            }

            let content = result.choices?.[0]?.message?.content;

            if (!content) {
               return resolve(jsonMode ? {} : '');
            }

            if (jsonMode) {
              try {
                return resolve(JSON.parse(content));
              } catch (e) {
                let start = content.indexOf('{');
                let end = content.lastIndexOf('}');
                
                const arrayStart = content.indexOf('[');
                const arrayEnd = content.lastIndexOf(']');
                
                if (arrayStart !== -1 && (start === -1 || arrayStart < start)) {
                  start = arrayStart;
                  end = arrayEnd;
                }

                if (start !== -1 && end !== -1) {
                  const cleaned = content.substring(start, end + 1)
                    .replace(/\/\/.*$/gm, '')           
                    .replace(/\/\*[\s\S]*?\*\//g, '')  
                    .trim();
                  try {
                    return resolve(JSON.parse(cleaned));
                  } catch (e2) {
                    const fixed = cleaned.replace(/,(\s*[\]}])/g, '$1');
                    return resolve(JSON.parse(fixed));
                  }
                }
                throw e;
              }
            } else {
              resolve(content);
            }
          } catch (e) {
            reject(new Error(`OpenRouter parse error: ${e.message}. Raw: ${raw.slice(0, 300)}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OpenRouter request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
