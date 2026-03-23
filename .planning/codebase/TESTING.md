# Testing Patterns

**Analysis Date:** 2026-03-23

## Test Framework

**Runner:**
- Not configured; `demo-web/package.json` only defines `dev`, `editor`, `build`, `lint`, `preview`, `preview:editor`, and data-generation scripts, so there is no test runner entry.
- Config: Not present (no `demo-web/jest.config.*` or `demo-web/vitest.config.*` files exist).

**Assertion Library:**
- Not used; no assertion-related dependencies like `@testing-library/react`, `chai`, or `expect` appear in `demo-web/package.json`.

**Run Commands:**
```bash
# Not configured (no `test` script in `demo-web/package.json`)
# Not configured (no watch mode defined)
# Not configured (no coverage command defined)
```

## Test File Organization

**Location:**
- No test files exist under `demo-web/src`: `rg --files --iglob "*.test.*" --iglob "*.spec.*"` inside `demo-web` only returns files from `demo-web/node_modules`.

**Naming:**
- Not applicable; there are no `*.test.*` or `*.spec.*` files to follow a naming pattern yet.

**Structure:**
```
[No `demo-web/src/**/*.test.*` or `demo-web/src/**/*.spec.*` paths present]
```

## Test Structure

**Suite Organization:**
```typescript
// Not available; there are no test suites in `demo-web/src`
```

**Patterns:**
- Setup pattern: n/a.
- Teardown pattern: n/a.
- Assertion pattern: n/a.

## Mocking

**Framework:** Not used.

**Patterns:**
```typescript
// Not available; no mocking helper modules exist under `demo-web/src`
```

**What to Mock:**
- Not yet applicable until a test suite is created. UI interactions are handled directly in React components such as `demo-web/src/App.tsx`.

**What NOT to Mock:**
- Not applicable.

## Fixtures and Factories

**Test Data:**
```typescript
// Not defined; data currently comes from files under `demo-web/public/data` without fixtures.
```

**Location:**
- `demo-web/public/data` stores AIS, forecast, model config, and dataset catalog JSON, but no fixture wrappers exist.

## Coverage

**Requirements:** None enforced (no coverage scripts in `demo-web/package.json`).

**View Coverage:**
```bash
# Not available; coverage reporting is not configured.
```

## Test Types

**Unit Tests:**
- Not present (`demo-web/src` contains no unit test files or commands).

**Integration Tests:**
- Not present.

**E2E Tests:**
- Not used.

## Common Patterns

**Async Testing:**
```typescript
// Not available; no async test helpers defined.
```

**Error Testing:**
```typescript
// Not available; no error-focused suites exist yet.
```

---

*Testing analysis: 2026-03-23*
