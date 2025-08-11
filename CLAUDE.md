Perfect—here’s a drop-in CLAUDE.md that turns your 1–7 upgrade list into concrete Claude Code instructions, while following Anthropic’s recommended structure (CLAUDE.md as the always-loaded project guide; allowed tools; slash commands; headless usage; workflow tips). ￼  ￼  ￼  ￼

# CLAUDE.md — IFRS Search/Functions/Formula Upgrades

This file tells Claude Code exactly how to implement and ship the next iteration of our CLI search (“ask”) with better citations, ranking, formula support, filters/facets, extractor nudges, and claims coverage.

---

## Bash commands

- bun run build: Build all packages
- bun test: Run unit tests
- bun apps/cli/src/index.ts ask "<query>" --units functions,formulas --cite=auto
- bun apps/cli/src/index.ts ask "profitability" --units formulas,functions --include-tags profitability,ratios --require-formula --min-inputs 1 --cite=auto
- bun db:migrate: Apply database migrations
- bun db:seed: Seed sample formulas/functions/claims

## Code style

- TypeScript (ESM). Prefer small, pure functions and explicit types.
- Keep SQL in `/apps/server/sql/*.sql` with tagged template literals in code.

## Workflow (YOU MUST)

- Think → plan → implement → verify → commit/PR. Do **not** write code until you’ve drafted a short plan and checklist for the task at hand (`docs/upgrade-checklist.md`). Use the checklist to track progress.
- For ranking and extractors, write tests first (snapshot + fixture JSON) before implementation.

## Allowed tools for this repo

Always allow: `Edit`, `Bash(bun *)`, `Bash(git *)`, `Bash(gh *)`. Ask before network or package manager changes.

---

# Tasks & Acceptance Criteria

## 1) Human-readable citations

**Goal**: Replace raw span UUIDs with `Title p.X–Y` (collapsing contiguous ranges).  
**DB helper (SQL):**
```sql
-- spans -> (title, page)
SELECT s.id AS span_id, d.title, COALESCE(s.page, 0) AS page
FROM spans s
JOIN documents d ON d.id = s.document_id
WHERE s.id = ANY($1::uuid[]);

Renderer rule:
	•	Group by (title, page); sort pages; collapse contiguous sequences to ranges.
	•	Output examples:
	•	Single page: “IFRS 15 Summary” p.12
	•	Multiple pages non-contiguous: “IFRS 15 Summary” p.12, p.14
	•	Range: “IFRS 15 Summary” p.12–14

CLI:
	•	Default --cite=auto (can be disabled by --no-cite).
	•	When --cite, print grouped, collapsed citations beneath each result.

Tests:
	•	Given spans [p12,p13,p14,p16] → p.12–14, p.16.

2) Improve ranking (prefer “how to calculate”)

Add features on each result:
	•	has_formula: boolean
	•	inputs_count: number (distinct named inputs)
	•	step_count: number (imperative steps)
	•	tags_overlap: number (Jaccard with query intent tags)
	•	explanatory_penalty: boolean if purpose starts with Describe/Explains

Score:

score = 0.45*semantic + 0.25*fts + 0.10*(has_formula?1:0)
      + 0.10*Math.min(inputs_count/3,1)
      + 0.10*Math.min(step_count/5,1)
      - 0.10*(explanatory_penalty?1:0);

Acceptance: “financial” ranks procedures (“compute…”, “divide…”) above managerial explainers.

3) Formula unit

Type:

type Formula = {
  id: string; documentId: string;
  name: string;                 // "Net Profit Margin"
  expression: string;           // "Net Income / Revenue"
  variables: { name: string; description: string }[];
  notes: string[];
  tags: string[];               // ["profitability","ratios"]
  span_ids: string[];
  confidence: number;
};

CLI:
	•	Support --units formulas,functions.
	•	If query contains profitability/ratio intent, boost has_formula.

Seeder:
	•	Add a few core formulas (Net Profit Margin, Gross Margin, ROA, ROE, Current Ratio) with span_ids.

4) Filters & facets

New flags:
	•	--include-tags tag1,tag2
	•	--exclude-tags tag1,tag2
	•	--min-inputs N
	•	--require-formula (filters to items with has_formula)

Facet helper (prompt line under results):

SELECT tag, COUNT(*)
FROM (SELECT UNNEST(tags) AS tag FROM functions) f
GROUP BY tag
ORDER BY COUNT(*) DESC
LIMIT 8;

Print: Narrow to: profitability • ratios • cash-flow • financing • …

5) Tighten the extractors (bias to calculations)

Prompt nudges (add to Functions & Formulas extractors):
	•	Prefer imperatives: “Compute… Divide… Return…”
	•	Inputs: Always extract financial line items (Revenue, Net Income, OpEx, COGS, Total Assets, Equity, Cash, Current Liabilities, etc.).
	•	Closed-form? If a closed-form exists, also emit a Formula unit sharing the same span_ids.
	•	Reject generic “Describes/Explains…” unless a concrete computation is present.

6) Claims coverage

Goal: Non-empty results for broad queries (“financial”).
Patterns: Extract definitional claims matching “X is…”, “X equals…”, “X consists of…”. Include qualifiers (period/scope/units).
From formulas → claims (automatic):
For each Formula(name, expression) emit:

Claim {
  subject: name,
  predicate: "equals",
  object: expression,
  span_ids,
  confidence: Math.min(0.9, formula.confidence)
}

7) Small polish
	•	Citations: --cite=auto by default.
	•	Renderer: Hide Inputs: None.
	•	Tags: Seed profitability, ratios, cash-flow, financing, org-ops.
	•	Dedup: Keep current gate; add test to prevent regressions.

⸻

Slash commands (stored in .claude/commands/)

Create these files so they appear in the / menu and can take $ARGUMENTS.

.claude/commands/upgrade-citations.md

Update citation renderer to “Title p.X–Y”; collapse contiguous pages; add --cite=auto.
Steps:
	1.	Read codepaths that format citations in CLI and web renderer.
	2.	Implement grouping/collapse + tests.
	3.	Wire default flag, document usage.
	4.	Run tests & demo on 3 sample queries.
	5.	Commit + PR.

.claude/commands/upgrade-ranking.md

Implement procedural-first scoring.
Steps: instrument features, add score function, add tests with canned fixtures, verify with snapshots, commit.

.claude/commands/seed-formulas.md

Add base profitability ratios (NPM, GM, ROA, ROE, Current Ratio) with span_ids; generate variables/notes; add tests; seed DB; commit.

(Use $ARGUMENTS as an optional filter, e.g., a specific formula name.)

⸻

Headless & CI

For non-interactive runs (CI or batch):

claude -p "Run /upgrade-ranking; when done, print OK if success, otherwise FAIL." \
  --allowedTools "Edit Bash(bun *) Bash(git *)" \
  --output-format stream-json

Use this for scripted migrations or nightly triage.

⸻

Multi-Claude & safety
	•	Split big tasks: one Claude writes extractor prompts/tests; another reviews/adjusts code.
	•	For mechanical refactors (lint fixes, boilerplate), you MAY use --dangerously-skip-permissions inside an isolated container. Keep internet off; commit in small batches.

⸻

Definition of Done (per PR)
	•	Tests passing (unit + snapshots).
	•	Demo transcript in PR description (input → output incl. citations).
	•	At least one example where “financial” yields procedures + formulas + claims.
	•	Docs: README updates for new flags, plus before/after examples.

---

### Why this shape?

- We stash project-specific guidance in `CLAUDE.md` so Claude auto-loads it in context every session. [oai_citation:4‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)
- We pre-approve the right tools (Edit, bun, git, gh) via the allowlist to reduce permission friction but keep things safe. [oai_citation:5‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)
- We use slash commands in `.claude/commands` with `$ARGUMENTS` so repeated workflows (like ranking/citation upgrades) are one keystroke away. [oai_citation:6‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)
- For CI or scripted runs, headless mode (`-p`, `--output-format stream-json`) is the official path. [oai_citation:7‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)
- The “plan before code”, “write tests first” workflow mirrors Anthropic’s recommended patterns for deeper tasks and verifiable changes. [oai_citation:8‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)  [oai_citation:9‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)
- Checklists/scratchpads (we point Claude at `docs/upgrade-checklist.md`) help it execute exhaustively on multi-step changes. [oai_citation:10‡claude-instructions.txt](file-service://file-BKRxqFfymBYong3RUXt3F3)

If you want, paste 1–2 span windows that mention margins/ROA/ROE and I’ll spit back polished `Function` + `Formula` JSON stubs (with inputs/steps) ready to seed—then `ask "profitability" --units formulas,functions --include-tags profitability --require-formula` will really pop.