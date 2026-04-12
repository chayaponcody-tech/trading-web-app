/**
 * Property-based tests for PineScriptConverter
 *
 * Feature: pine-script-importer
 * Properties 5, 6, 7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PineScriptConverter } from '../PineScriptConverter.js';

const converter = new PineScriptConverter();

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a plausible Pine Script string (contains required keywords) */
const validPineScriptArb = fc.record({
  version: fc.constantFrom('//@version=4', '//@version=5'),
  body: fc.string({ minLength: 5, maxLength: 200 }),
}).map(({ version, body }) => `${version}\nstrategy("Test")\n${body}`);

/** Generate a Python class body that extends BaseStrategy with required methods */
function makePythonCode(className = 'MyStrategy') {
  return `from base_strategy import BaseStrategy
import numpy as np

class ${className}(BaseStrategy):
    def compute_signal(self, closes, highs, lows, volumes, params):
        return {"signal": "NONE", "stoploss": None, "metadata": {}}

    def get_metadata(self):
        return {"name": "${className}", "description": "test", "params": {}}
`;
}

/** Arbitrary for valid Python code with BaseStrategy structure */
const validPythonCodeArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9]{0,19}$/)
  .map((name) => makePythonCode(name));

/** Arbitrary for Python code wrapped in a markdown python block */
const markdownPythonResponseArb = validPythonCodeArb.map(
  (code) => `Here is the converted code:\n\`\`\`python\n${code}\n\`\`\`\nHope this helps!`
);

/** Arbitrary for Python code wrapped in a plain code block */
const plainCodeBlockResponseArb = validPythonCodeArb.map(
  (code) => `\`\`\`\n${code}\n\`\`\``
);

/** Arbitrary for raw Python text (no fences) */
const rawPythonResponseArb = validPythonCodeArb;

// ---------------------------------------------------------------------------
// Property 5: Prompt contains all required components
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Property 5: Prompt contains all required components', () => {
  it('buildPrompt() SHALL contain Pine Script code, BaseStrategy interface, and example strategy', () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any valid Pine Script input, the prompt built by buildPrompt() must
     * include all three required sections: the Pine Script itself, the
     * BaseStrategy interface definition, and an example strategy.
     */
    fc.assert(
      fc.property(validPineScriptArb, (pineScript) => {
        const prompt = converter.buildPrompt(pineScript);

        // Must contain the Pine Script code verbatim
        expect(prompt).toContain(pineScript);

        // Must contain BaseStrategy interface definition
        expect(prompt).toContain('BaseStrategy');
        expect(prompt).toContain('compute_signal');
        expect(prompt).toContain('get_metadata');

        // Must contain example strategy code
        expect(prompt).toContain('EMACrossStrategy');
        expect(prompt).toContain('EXAMPLE STRATEGY');
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Python code extraction from any response format
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------

describe('Property 6: Python code extraction from any response format', () => {
  it('extractPythonCode() extracts code from markdown python blocks', () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * For any response containing a ```python ... ``` block,
     * extractPythonCode() must return code containing `class` and `def`.
     */
    fc.assert(
      fc.property(markdownPythonResponseArb, (response) => {
        const code = converter.extractPythonCode(response);
        expect(code).toContain('class');
        expect(code).toContain('def');
      }),
      { numRuns: 100 }
    );
  });

  it('extractPythonCode() extracts code from plain code blocks', () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * For any response containing a plain ``` ... ``` block with Python code,
     * extractPythonCode() must return code containing `class` and `def`.
     */
    fc.assert(
      fc.property(plainCodeBlockResponseArb, (response) => {
        const code = converter.extractPythonCode(response);
        expect(code).toContain('class');
        expect(code).toContain('def');
      }),
      { numRuns: 100 }
    );
  });

  it('extractPythonCode() extracts code from raw Python text', () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * For any raw Python text containing `class` and `def`,
     * extractPythonCode() must return code containing both keywords.
     */
    fc.assert(
      fc.property(rawPythonResponseArb, (response) => {
        const code = converter.extractPythonCode(response);
        expect(code).toContain('class');
        expect(code).toContain('def');
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Python structure validation
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 7: Python structure validation', () => {
  it('validatePythonStructure() returns true only when all three components are present', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * validatePythonStructure() SHALL return true only when code has:
     * - a class extending BaseStrategy
     * - compute_signal method
     * - get_metadata method
     */
    fc.assert(
      fc.property(validPythonCodeArb, (code) => {
        expect(converter.validatePythonStructure(code)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('validatePythonStructure() returns false when class does not extend BaseStrategy', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * Code missing the BaseStrategy inheritance must return false.
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,19}$/),
        (name) => {
          const code = `class ${name}:
    def compute_signal(self, closes, highs, lows, volumes, params):
        return {}
    def get_metadata(self):
        return {}
`;
          expect(converter.validatePythonStructure(code)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validatePythonStructure() returns false when compute_signal is missing', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * Code missing compute_signal must return false.
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,19}$/),
        (name) => {
          const code = `class ${name}(BaseStrategy):
    def get_metadata(self):
        return {}
`;
          expect(converter.validatePythonStructure(code)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validatePythonStructure() returns false when get_metadata is missing', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * Code missing get_metadata must return false.
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,19}$/),
        (name) => {
          const code = `class ${name}(BaseStrategy):
    def compute_signal(self, closes, highs, lows, volumes, params):
        return {}
`;
          expect(converter.validatePythonStructure(code)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
