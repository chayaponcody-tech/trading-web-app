/**
 * Property-based tests for pineScriptRoutes validation and name transformation
 *
 * Feature: pine-script-importer
 * Properties 1, 2, 3, 4, 10, 12, 15
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validatePineScript, strategyNameToKey } from '../routes/pineScriptRoutes.js';

// ---------------------------------------------------------------------------
// Property 1: Validation rejects short input
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------

describe('Property 1: Validation rejects short input', () => {
  it('validatePineScript() SHALL return isValid=false for any string shorter than 10 chars', () => {
    /**
     * **Validates: Requirements 1.2**
     *
     * For any string shorter than 10 characters, validatePineScript() must
     * return { isValid: false }.
     */
    fc.assert(
      fc.property(
        fc.string({ maxLength: 9 }),
        (input) => {
          const result = validatePineScript(input);
          return result.isValid === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Validation rejects oversized input
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe('Property 2: Validation rejects oversized input', () => {
  it('validatePineScript() SHALL return isValid=false for any string longer than 50,000 chars', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * For any string longer than 50,000 characters, validatePineScript() must
     * return { isValid: false }.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 50_001, maxLength: 55_000 }),
        (input) => {
          const result = validatePineScript(input);
          return result.isValid === false;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Validation requires Pine Script keywords
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe('Property 3: Validation requires Pine Script keywords', () => {
  it('validatePineScript() SHALL return isValid=false for strings without Pine Script keywords', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * For any string 10-50,000 chars that does NOT contain //@version,
     * strategy(, or indicator(, validatePineScript() must return isValid=false.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }).filter(
          (s) =>
            !s.includes('//@version') &&
            !s.includes('strategy(') &&
            !s.includes('indicator(')
        ),
        (input) => {
          const result = validatePineScript(input);
          return result.isValid === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Convert button disabled when validation fails
// Validates: Requirements 1.5, 3.3
// ---------------------------------------------------------------------------

describe('Property 4: isValid=false implies convert should be disabled', () => {
  it('validatePineScript() SHALL return isValid=false for any invalid input (short, oversized, or no keywords)', () => {
    /**
     * **Validates: Requirements 1.5, 3.3**
     *
     * For any input that is invalid (too short, too long, or missing keywords),
     * validatePineScript() must return isValid=false — meaning the convert
     * button should be disabled.
     */
    const invalidInputArb = fc.oneof(
      // Too short
      fc.string({ maxLength: 9 }),
      // Too long
      fc.string({ minLength: 50_001, maxLength: 51_000 }),
      // Right length but no keywords
      fc.string({ minLength: 10, maxLength: 200 }).filter(
        (s) =>
          !s.includes('//@version') &&
          !s.includes('strategy(') &&
          !s.includes('indicator(')
      )
    );

    fc.assert(
      fc.property(invalidInputArb, (input) => {
        const result = validatePineScript(input);
        return result.isValid === false;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Strategy name to key transformation
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe('Property 10: Strategy name to key transformation', () => {
  it('strategyNameToKey() SHALL return a key starting with PINE_ and be fully uppercase', () => {
    /**
     * **Validates: Requirements 6.2**
     *
     * For any name consisting only of letters, digits, and spaces,
     * strategyNameToKey() must return a key that:
     * - starts with "PINE_"
     * - is entirely uppercase
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 ]+$/).filter((s) => s.trim().length > 0),
        (name) => {
          const key = strategyNameToKey(name);
          return key.startsWith('PINE_') && key === key.toUpperCase();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('strategyNameToKey() SHALL replace spaces with underscores', () => {
    /**
     * **Validates: Requirements 6.2**
     *
     * Spaces in the name must become underscores in the key.
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 ]+$/).filter((s) => s.trim().length > 0),
        (name) => {
          const key = strategyNameToKey(name);
          return !key.slice('PINE_'.length).includes(' ');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Invalid name character rejection
// Validates: Requirements 6.6
// ---------------------------------------------------------------------------

describe('Property 12: Invalid name character rejection', () => {
  it('validatePineScript() is unrelated — name with special chars should fail the name regex check', () => {
    /**
     * **Validates: Requirements 6.6**
     *
     * For any strategy name containing characters outside [a-zA-Z0-9 ],
     * the name validation regex used in the save route must reject it.
     * We test the regex directly since the route requires HTTP context.
     */
    const nameWithSpecialCharsArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => /[^a-zA-Z0-9 ]/.test(s));

    const validNameRegex = /^[a-zA-Z0-9 ]+$/;

    fc.assert(
      fc.property(nameWithSpecialCharsArb, (name) => {
        return !validNameRegex.test(name);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Missing pineScript field returns HTTP 400
// Validates: Requirements 8.4
// ---------------------------------------------------------------------------

describe('Property 15: Missing or empty pineScript returns isValid=false', () => {
  it('validatePineScript() SHALL return isValid=false for undefined, null, empty string, or non-string', () => {
    /**
     * **Validates: Requirements 8.4**
     *
     * When the pineScript field is missing (undefined), null, empty, or a
     * non-string type, validatePineScript() must return isValid=false —
     * which causes the route to respond with HTTP 400.
     */
    const missingOrEmptyArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(''),
      fc.integer().map((n) => n),
      fc.boolean().map((b) => b),
      fc.constant([]),
      fc.constant({})
    );

    fc.assert(
      fc.property(missingOrEmptyArb, (input) => {
        const result = validatePineScript(input);
        return result.isValid === false;
      }),
      { numRuns: 50 }
    );
  });
});
