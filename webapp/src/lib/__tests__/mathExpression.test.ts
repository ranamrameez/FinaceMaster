import { describe, expect, it } from 'vitest';
import { evalMathExpression, resolveNumericInput } from '../mathExpression';

describe('evalMathExpression', () => {
  it('evaluates simple addition', () => {
    expect(evalMathExpression('10.5+5')).toBe(15.5);
  });

  it('evaluates simple subtraction', () => {
    expect(evalMathExpression('20-8')).toBe(12);
  });

  it('evaluates multiplication and division', () => {
    expect(evalMathExpression('4*5')).toBe(20);
    expect(evalMathExpression('200/4')).toBe(50);
  });

  it('respects operator precedence', () => {
    expect(evalMathExpression('2+3*4')).toBe(14);
    expect(evalMathExpression('(2+3)*4')).toBe(20);
  });

  it('handles nested parentheses', () => {
    expect(evalMathExpression('((1+2)*(3+4))')).toBe(21);
  });

  it('handles unary minus', () => {
    expect(evalMathExpression('-5+10')).toBe(5);
    expect(evalMathExpression('10*-2')).toBe(-20);
  });

  it('ignores whitespace', () => {
    expect(evalMathExpression('  10  +  5  ')).toBe(15);
  });

  it('handles decimals throughout', () => {
    expect(evalMathExpression('0.1+0.2')).toBeCloseTo(0.3);
  });

  it('returns null for empty input', () => {
    expect(evalMathExpression('')).toBeNull();
    expect(evalMathExpression('   ')).toBeNull();
  });

  it('returns null for invalid expressions', () => {
    expect(evalMathExpression('10++')).toBeNull();
    expect(evalMathExpression('10+')).toBeNull();
    expect(evalMathExpression('(10+5')).toBeNull();
    expect(evalMathExpression('10 5')).toBeNull();
    expect(evalMathExpression('abc')).toBeNull();
  });

  it('returns null for division by zero rather than Infinity', () => {
    expect(evalMathExpression('10/0')).toBeNull();
  });

  it('never uses eval/Function on malicious-looking input', () => {
    // A string containing JS that would execute if this ever used eval()
    // must safely fail to parse instead of running anything.
    expect(evalMathExpression('(() => { throw new Error("pwned") })()')).toBeNull();
  });
});

describe('resolveNumericInput', () => {
  it('parses a plain number without going through the expression evaluator', () => {
    expect(resolveNumericInput('42')).toBe(42);
    expect(resolveNumericInput('-3.5')).toBe(-3.5);
  });

  it('falls back to expression evaluation for a typed expression', () => {
    expect(resolveNumericInput('10+5')).toBe(15);
  });

  it('returns null for empty or invalid input', () => {
    expect(resolveNumericInput('')).toBeNull();
    expect(resolveNumericInput('abc')).toBeNull();
  });
});
