---
applyTo: "**"
---

# Coding Conventions

## Naming

- Use `snake_case` for all variable names, function names, and parameters.
- Use `SCREAMING_SNAKE_CASE` (all-caps `SNAKE_CASE`) for constants.
- Never use `camelCase` or `PascalCase` except for class names (e.g. `Course`, `Item`).

## Quotes

- Use double quotes `""` by default for all strings.
- Use single quotes `''` only when the string itself contains a double quote, to avoid escaping.

## Comments

Write code that is self-explanatory through good naming. Comments should be rare.

- Only add a comment above a function when the **why** is not obvious from reading the signature and body alone.
- Never add inline comments, section-header comments (`// -- Section --`), or comments that just restate what the code does.
- No redundant comments like `// Fetch courses` above a function called `fetch_courses()`.
- A single short comment above a function is the maximum - do not write multi-line comment blocks unless the logic is genuinely complex and cannot be simplified.

## No Magic Numbers or Strings

Never use numeric literals or opaque coded strings inline in logic. The goal is that anyone reading the code later can immediately understand what a value represents without needing external context.

**This rule applies to values that carry no inherent meaning on their own** - numbers, single-character codes, status codes, API version strings, etc. It does NOT apply to self-descriptive string literals where the string itself already communicates intent (e.g. `"fetchCourses"`, `"click"`, `"DOMContentLoaded"`).

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

This rule applies to all file types in the project - JavaScript, CSS (e.g. z-index values, breakpoints), JSON config values referenced in code, etc.

## Test Files

Test files follow all the same conventions above. Additional rules:

- **Named constants for fixture values**: any constant, enum, or typed value used in a test that originates in the source file **must be exported from the source file and imported in the test**. Never duplicate a value. Parity between a file and its test is critical - if the value changes in the source, the test must automatically reflect that without any manual edits.

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
