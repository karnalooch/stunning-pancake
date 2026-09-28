# AI-assisted development — 4VELO

| | |
|--|--|
| **Status** | Active — engineering governance |
| **Date** | 2026-09-28 |
| **Owner role** | Product / Engineering / Security |
| **lang** | en |
| **translation** | [Polski](../../compliance/AI_ASSISTED_DEVELOPMENT.md) |
| **canonical_path** | docs/en/compliance/AI_ASSISTED_DEVELOPMENT.md |

4VELO may use ChatGPT, Codex and other generative AI tools for planning,
implementation, tests, documentation and review. AI output is a proposal that
requires verification, not evidence of correctness.

Rules:

- a human defines scope and acceptance criteria;
- diffs receive normal review;
- AI must not weaken or bypass tests, security gates or release gates;
- external or recognizably borrowed code receives normal license/provenance review;
- production user data, credentials and unredacted logs should not be sent to
  personal AI tooling;
- confidential or production-data use requires an approved environment and
  appropriate processing terms;
- user-impacting decisions, including anti-cheat rules affecting prizes, bans or
  exclusions, remain human-approved.

Current OpenAI Codex terms note that generated code may be subject to third-party
licenses:
https://openai.com/policies/service-terms/

Article 4 AI Act requires measures supporting sufficient AI literacy:
https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689
