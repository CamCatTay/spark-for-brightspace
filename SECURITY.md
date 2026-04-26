# Security Policy

## Supported Versions

Only the latest published version of Spark for Brightspace receives security fixes.

| Version | Supported |
|---------|-----------|
| Latest  | ✅         |
| Older   | ❌         |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability, email the maintainers directly or use [GitHub's private vulnerability reporting](https://github.com/camcattay/spark-for-brightspace/security/advisories/new).

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (or a proof-of-concept if applicable)
- The version(s) affected

You can expect an acknowledgement within 7 days. If confirmed, we will work on a fix and coordinate a disclosure timeline with you before publishing anything publicly.

## Scope

This project is a browser extension. The primary attack surfaces of interest are:

- Unauthorized data access via the extension's Brightspace API calls
- Cross-site scripting or content injection via the side panel DOM
- Privilege escalation via the `chrome.scripting` or `chrome.storage` APIs
- Supply chain issues in build dependencies

Issues in third-party libraries should be reported to those projects directly, though we appreciate a heads-up.
