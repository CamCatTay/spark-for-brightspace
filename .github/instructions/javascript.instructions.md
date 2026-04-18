---
applyTo: "**"
---

# Coding Conventions

## Naming

- Use `snake_case` for all variable names, function names, and parameters.
- Use `SCREAMING_SNAKE_CASE` (all-caps `SNAKE_CASE`) for constants.
- Never use `camelCase` or `PascalCase` except for class names (e.g. `Course`, `Item`).

## File Header

Every file must begin with a short comment block describing what the script does:

```js
// filename.js
// Brief description of what this file does and what it provides.
```

## Section Separators

In large files, separate logical sections of code with a full-width banner comment:

```js
// ============================================================
// Section Name
// ============================================================
```

Inside functions, or in small files with few lines, use a compact inline separator instead:

```js
// -- Section Name --
```

Do not mix styles within the same scope level.

## Function Comments

Every function must have a brief comment directly above it describing:
- What it returns (always required)
- Any complex or non-obvious parameters (e.g. what a parameter is expected to contain, or what a helper function returns)

Use JSDoc (`@param`, `@returns`) for public or exported functions. A single-line `//` comment is sufficient for private helpers.

```js
// Returns the base URL (protocol + host) extracted from a full URL string.
async function get_base_url(tab_url) { ... }

/**
 * Fetches all pages of a paginated Brightspace endpoint and returns the combined results.
 * @param {string} url - The full API URL to fetch (may be paginated)
 * @returns {Promise<Array>} Flat array of all result objects across pages
 */
async function get_brightspace_data(url) { ... }
```

## No Magic Numbers or Strings

Never use numeric literals or opaque coded strings inline in logic. The goal is that anyone reading the code later can immediately understand what a value represents without needing external context.

**This rule applies to values that carry no inherent meaning on their own** — numbers, single-character codes, status codes, API version strings, etc. It does NOT apply to self-descriptive string literals where the string itself already communicates intent (e.g. `"fetchCourses"`, `"click"`, `"DOMContentLoaded"`).

Always assign bare values to a named constant or include them in an `Object.freeze` enum (JavaScript) or equivalent named constant group in other languages.

**Wrong:**
```js
if (item.type === 3) { ... }         // 3 is meaningless without context
if (status === 'db') { ... }         // 'db' is an opaque abbreviation
const url = base + "/d2l/api/lp/1.49/...";  // version string buried in a URL
```

**Right:**
```js
const ActivityType = Object.freeze({
    DROPBOX: 3,
    QUIZ: 4,
    DISCUSSION: 5
});

if (item.type === ActivityType.DROPBOX) { ... }
```

Use `Object.freeze` in JavaScript whenever a value belongs to a logical group (types, states, HTTP codes, API versions, limits, etc.). Even a single opaque value with no related siblings must be assigned to a named `const`.

This rule applies to all file types in the project — JavaScript, CSS (e.g. z-index values, breakpoints), JSON config values referenced in code, etc.

## Test Files

Test files follow all the same conventions above. Additional rules:

- **File header**: same short comment block describing what is being tested and any key setup notes (e.g. how the module is loaded).
- **Section banners**: one full-width `// ===...===` banner per `describe` block. The banner label matches the function or feature name exactly.
- **Mock Helpers section**: group all mock/factory helper functions (`mock_json`, `make_tab`, etc.) under a `// Mock Helpers` banner near the top. Each helper gets a brief comment.
- **Setup section**: `beforeEach`/`afterEach` blocks live under a `// Setup` banner, between Mock Helpers and the first describe block.
- **Named constants for fixture values**: any constant, enum, or typed value used in a test that originates in the source file **must be exported from the source file and imported in the test**. Never duplicate a value. Parity between a file and its test is critical — if the value changes in the source, the test must automatically reflect that without any manual edits.

  Add a `module.exports` compat block to any source file whose test needs its constants:

  ```js
  // At the bottom of the source file
  if (typeof module !== 'undefined' && module.exports) {
      module.exports = { MY_CONSTANT, MyEnum };
  }
  ```

  Then in the test file, destructure from the required module:

  ```js
  const { MY_CONSTANT, MyEnum } = require('../src/my-file.js');
  ```

  Only use a locally-defined constant in a test for values that have no corresponding definition in the source (e.g. API shape fields like `OrgUnit.Type.Id` that are never defined in JS).
