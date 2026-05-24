# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in this repo (the MCP server, the OpenAPI spec generator, the skill, or any documentation that could lead a user to leak credentials), please report it privately:

- **Email**: <support@ghostswap.io> with subject prefix `[security] ghostswap-agents:`
- **Encrypted**: PGP key available on request

**Please do not** file public GitHub issues for security reports. We aim to respond within 72 hours and to ship a fix within 14 days for confirmed vulnerabilities.

## What's in scope

| In scope | Out of scope |
|---|---|
| MCP server: command injection, prompt injection that leaks credentials, dependency vulnerabilities | The GhostSwap Partners API itself (report at <support@ghostswap.io>) |
| Documentation that suggests insecure patterns (e.g. embedding the bearer token in client code) | LLM hallucinations when using the skill |
| OpenAPI spec: schemas that misrepresent auth or permissions | Third-party MCP clients' vulnerabilities |
| GitHub Actions workflows: secret exposure, injection | Bugs in the underlying `@modelcontextprotocol/sdk` package |

## Supported versions

Only the latest minor of `v1.x` receives security fixes. Older minors are end-of-life.

## Disclosure

After a fix ships, we may publish a CVE-style advisory via [GitHub Security Advisories](https://github.com/ghostswap1/ghostswap-agents/security/advisories). Reporters will be credited unless they opt out.

## Hall of Fame

Researchers who responsibly disclose valid issues will be acknowledged here (with their permission).

_None yet — be the first!_
