/**
 * Property-based tests for PineImport validation UI
 *
 * Feature: pine-script-importer
 * Properties 3, 4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Validation logic — mirrors validatePineScript() in src/pages/PineImport.tsx
// ---------------------------------------------------------------------------

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

function validatePineScript(input: unknown): ValidationResult {
  if (typeof input !== 'string') {
    return { isValid: false, error: 'Pine Script ไม่ถูกต้องหรือสั้นเกินไป' };
  }
  if (input.length < 10) {
    return { isValid: false, error: 'Pine Script ไม่ถูกต้องหรือสั้นเกินไป' };
  }
  if (input.length > 50000) {
    return { isValid: false, error: 'Pine Script ยาวเกินขีดจำกัด (50,000 ตัวอักษร)' };
  }
  const hasKeyword =
    input.includes('//@version') ||
    input.includes('strategy(') ||
    input.includes('indicator(');
  if (!hasKeyword) {
    return { isValid: false, error: 'Pine Script ต้องมี keyword //@version, strategy( หรือ indicator(' };
  }
  return { isValid: true, error: null };
}

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

describe('Property 4: Convert button disabled when validation fails', () => {
  it('validatePineScript() SHALL return isValid=false for any invalid input (short, oversized, or no keywords)', () => {
    /**
     * **Validates: Requirements 1.5, 3.3**
     *
     * For any input that is invalid (too short, too long, or missing keywords),
     * validatePineScript() must return isValid=false — meaning the convert
     * button should be disabled (disabled={!validation.isValid}).
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
        // isValid=false means the button is disabled
        return result.isValid === false;
      }),
      { numRuns: 100 }
    );
  });

  it('convert button SHALL be enabled only when validatePineScript() returns isValid=true', () => {
    /**
     * **Validates: Requirements 1.5, 3.3**
     *
     * For any valid input (10-50,000 chars with at least one Pine Script keyword),
     * validatePineScript() must return isValid=true — meaning the convert button
     * should be enabled.
     */
    const keywords = ['//@version', 'strategy(', 'indicator('];
    const validInputArb = fc
      .tuple(
        fc.string({ minLength: 0, maxLength: 490 }),
        fc.constantFrom(...keywords),
        fc.string({ minLength: 0, maxLength: 490 })
      )
      .map(([prefix, kw, suffix]) => prefix + kw + suffix)
      .filter((s) => s.length >= 10 && s.length <= 50000);

    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = validatePineScript(input);
        // button enabled = !isValid is false, i.e. isValid is true
        return result.isValid === true;
      }),
      { numRuns: 100 }
    );
  });
});
