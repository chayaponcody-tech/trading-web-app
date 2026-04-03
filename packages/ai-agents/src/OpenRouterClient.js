import https from 'https';

// ─── OpenRouter HTTP Client ───────────────────────────────────────────────────
// Single HTTP wrapper for all AI calls.
// Handles auth, timeouts, JSON extraction, and error propagation.

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
 * @returns {Promise<object|string>} Parsed JSON object or raw string
 */
export async function callOpenRouter(prompt, apiKey, model = DEFAULT_MODEL, opts = {}) {
  const {
    jsonMode = true,
    maxTokens = 4000,
    temperature = 0.1,
    timeout = 45000,
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
        },
        timeout,
      },
      (res) => {
        let raw = '';
        res.on('data', (d) => (raw += d));
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              return reject(new Error(`OpenRouter [${res.statusCode}]: ${raw}`));
            }
            const result = JSON.parse(raw);
            let content = result.choices?.[0]?.message?.content;

            if (!content) {
               // Fallback if structured standard not found
               return resolve(jsonMode ? {} : '');
            }

            if (jsonMode) {
              try {
                // 1. Try direct parse
                return resolve(JSON.parse(content));
              } catch (e) {
                // 2. Extract JSON block if wrapped in markdown or extra text
                const start = content.indexOf('{');
                const end = content.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                  const cleaned = content.substring(start, end + 1)
                    .replace(/\/\/.*$/gm, '')           // Strip // comments
                    .replace(/\/\*[\s\S]*?\*\//g, '')  // Strip /* */ comments
                    .trim();
                  try {
                    return resolve(JSON.parse(cleaned));
                  } catch (e2) {
                    // 3. Final attempt: basic trailing comma fix
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
