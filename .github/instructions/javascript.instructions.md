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

Never use literal numbers (or opaque strings) inline in logic. The goal is that anyone reading the code later can immediately understand what a value represents without needing external context.

Always assign bare values to a named constant or include them in an `Object.freeze` enum (JavaScript) or equivalent named constant group in other languages.

**Wrong:**
```js
if (item.type === 3) { ... }
if (status === 'db') { ... }
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

Use `Object.freeze` in JavaScript whenever a value belongs to a logical group (types, states, HTTP codes, API versions, limits, etc.). Even a single "magic" value with no related siblings must be assigned to a named `const`.

This rule applies to all file types in the project — JavaScript, CSS (e.g. z-index values, breakpoints), JSON config values referenced in code, etc.
