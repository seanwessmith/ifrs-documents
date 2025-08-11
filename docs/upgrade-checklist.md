# IFRS Upgrade Checklist

## Task: Implement CLAUDE.md improvements for search, citations, ranking, formulas, and filters

### 1. Human-readable citations ✅
- [x] Create citation renderer with title p.X-Y format
- [x] Implement page range collapsing (p.12-14, p.16)
- [x] Add --cite=auto as default flag
- [x] Write tests for citation grouping/collapsing
- [x] Update CLI output formatting

### 2. Improve ranking (prefer "how to calculate") ⏳
- [ ] Add ranking features: has_formula, inputs_count, step_count, tags_overlap, explanatory_penalty
- [ ] Implement new scoring algorithm: 0.45*semantic + 0.25*fts + feature bonuses
- [ ] Write tests with fixtures for ranking
- [ ] Verify "financial" ranks procedures above explanatory content

### 3. Formula unit support ⏳
- [ ] Ensure Formula type is properly integrated
- [ ] Add --units formulas,functions support
- [ ] Implement formula search and ranking
- [ ] Create seeder for core formulas (NPM, GM, ROA, ROE, Current Ratio)

### 4. Filters & facets ⏳
- [ ] Add CLI flags: --include-tags, --exclude-tags, --min-inputs, --require-formula
- [ ] Implement facet helper query for tag suggestions
- [ ] Add "Narrow to:" suggestions in CLI output

### 5. Tighten extractors (bias to calculations) ⏳
- [ ] Update extraction prompts with imperative bias
- [ ] Add financial line items preference
- [ ] Implement closed-form formula detection
- [ ] Reject generic "Describes/Explains" without computation

### 6. Claims coverage ⏳
- [ ] Enhance claims extraction patterns
- [ ] Implement automatic formula → claims conversion
- [ ] Ensure broad queries return non-empty results

### 7. Small polish ⏳
- [ ] Set --cite=auto as default
- [ ] Hide "Inputs: None" in renderer
- [ ] Add comprehensive tag seeding
- [ ] Add deduplication regression tests

## Acceptance Criteria
- [ ] "financial" yields procedures + formulas + claims
- [ ] Citations show "Title p.X-Y" format with ranges
- [ ] Ranking prefers calculation procedures
- [ ] All new CLI flags working
- [ ] Tests passing
- [ ] Demo transcript ready

## Definition of Done
- [ ] Tests passing (unit + snapshots)
- [ ] Demo transcript in PR description
- [ ] At least one example where "financial" yields procedures + formulas + claims
- [ ] README updates for new flags with before/after examples