/** User-requested (2026-09-08): "allow users to directly enter basic math
 * in the input boxes like a sheet rather than needing an external calc."
 * A small, hand-rolled recursive-descent parser/evaluator for `+ - * /`
 * and parentheses — deliberately NEVER `eval()`/`new Function()` on user
 * input, even though this only ever runs against numeric-amount fields the
 * user themselves typed into, since those are exactly the fields most
 * likely to someday carry pasted or imported text. Returns `null` (never
 * throws) on anything it can't parse, so a caller can fall back to
 * treating the input as a plain number.
 *
 * Supports: integers/decimals, unary +/-, `+ - * /`, parentheses, and
 * whitespace anywhere. Deliberately does NOT support `^`/exponents,
 * functions, or variables — "basic math... like a sheet" was the ask, not
 * a full formula language. */

type Token = { type: 'num'; value: number } | { type: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch as '+' | '-' | '*' | '/' | '(' | ')' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const numStr = input.slice(i, j);
      const value = Number(numStr);
      if (Number.isNaN(value)) return null;
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }
    return null; // unrecognized character — not a math expression this parser handles
  }
  return tokens;
}

/** Recursive-descent parser: expr := term (('+'|'-') term)*,
 * term := factor (('*'|'/') factor)*, factor := ('+'|'-') factor | '(' expr ')' | num. */
function parse(tokens: Token[]): number | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseFactor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      next();
      const inner = parseFactor();
      if (inner === null) return null;
      return t.value === '-' ? -inner : inner;
    }
    if (t.type === 'op' && t.value === '(') {
      next();
      const inner = parseExpr();
      if (inner === null) return null;
      const closing = peek();
      if (!closing || closing.type !== 'op' || closing.value !== ')') return null;
      next();
      return inner;
    }
    if (t.type === 'num') {
      next();
      return t.value;
    }
    return null;
  }

  function parseTerm(): number | null {
    let value = parseFactor();
    if (value === null) return null;
    for (;;) {
      const t = peek();
      if (!t || t.type !== 'op' || (t.value !== '*' && t.value !== '/')) break;
      next();
      const rhs = parseFactor();
      if (rhs === null) return null;
      if (t.value === '/' && rhs === 0) return null; // division by zero — not a valid result
      value = t.value === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseExpr(): number | null {
    let value = parseTerm();
    if (value === null) return null;
    for (;;) {
      const t = peek();
      if (!t || t.type !== 'op' || (t.value !== '+' && t.value !== '-')) break;
      next();
      const rhs = parseTerm();
      if (rhs === null) return null;
      value = t.value === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  const result = parseExpr();
  if (result === null || pos !== tokens.length) return null; // trailing garbage = invalid
  return result;
}

/** Evaluates a typed expression like `"10.5+5"` or `"200/3"` to a plain
 * number, or returns `null` if it isn't a valid expression this parser
 * handles (including a bare, already-plain number — callers should try
 * `Number(input)` first and only fall back to this for anything that
 * isn't already a clean number). */
export function evalMathExpression(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = tokenize(trimmed);
  if (!tokens || !tokens.length) return null;
  const result = parse(tokens);
  return result !== null && Number.isFinite(result) ? result : null;
}

/** Convenience: resolves a typed field value to a number, trying a plain
 * numeric parse first (the common case — no math-eval overhead) and only
 * falling back to expression evaluation when that fails. Returns `null`
 * for empty/invalid input either way. */
export function resolveNumericInput(input: string): number | null {
  if (input.trim() === '') return null;
  const plain = Number(input);
  if (!Number.isNaN(plain)) return plain;
  return evalMathExpression(input);
}
