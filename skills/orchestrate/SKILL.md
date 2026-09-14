---
name: orchestrate
description: Use when a user wants to make changes to a codebase, this skill shows you how to manage the implement, verify, review cycle
---

# Orchestrate

Use this skill to handle the implement, verify, review cycle of software development.

Use this skill when a user requests a change or to plan some work.

**Never** supply an agent with max turns, this could cut off valuable exploration, verification or review findings.

**Never** run verification (tests, lint, build, formatting etc.) within the main agent, always use a wayfinder agent.

**Always** ensure all agents are completed before synethsising responses and presenting findings/questions to the user.

**Never** present questions or findings whilst agents are still running.

**Always** prefer codebase-memory mcp for tracing the codebase and code usage.

## 1. Exploration

Launch as many parallel wayfinder agents as necessary to explore the codebase.

Give each wayfinder agent a scope of what to find and an expected output so that you have enough context to plan the implementation.

## 2. Context gathering

Once you have sufficent context from the source code, use the brainstorm skill to gather as much context about the change requirements as necessary.

Continue until you have a shared understanding of what is required with the user.

If you require to re-examine any part of the codebase, re-launch wayfinder agents.

Before proceeding, ensure the user has confirmed the shared understanding.

## 3. Planning

Plan the code changes that are required, if you need to re-examine any part of the codebase, dispatch a wayfinder agent (or re-use one if one has already explored this specific area) to gather that context.

Present an implementation plan to the user for approval.

## 4. Implementation

Once the plan is approved, implement the plan.

Keep code changes small and simple, do not alter unaffected areas with regards to style.

Do not overengineer.

Do not introduce scope-creep.

## 5. Verify

Launch a wayfinder agent to run any verification commands (test, lint, build) necessary to ensure the changes build and operate correctly.

Tell the wayfinder agent to respond with a summary, and that if the verification has failed that the summary has enough information for you to fix the errors:

If the verification commands succeed:

```
Status: PASS
```

If the verification commands fails, then a summary of the failures should be presented:

```
Status: FAIL
Command: build|test|lint|etc.
Summary:
    [failed test cases, build errors, linting errors etc.]
```

## 6. Review

After validation passes, start a focused, read-only warden.
Reuse the same warden only for remediation re-reviews or closely related
follow-up review rounds. Give it the approved requirements and plan, review
scope, relevant changed-file paths, and validation result. Instruct it to
inspect the repository's current files and obtain the working-tree and index
diffs itself with appropriate `git diff` commands; do not paste or require the
parent to provide the full diff. Require review of the actual current files and
diff, not an implementation report.

Request this verdict contract:

```text
VERDICT: CLEAN
```

or:

```text
VERDICT: FAIL
FINDINGS:
- severity: <severity>
  location: <file and line>
  problem: <concrete actionable defect>
  fix: <practical fix>
```

`CLEAN` means no actionable correctness, security, or maintainability findings
remain. Stylistic preferences alone are not failures.

Maintain a failed-review counter starting at zero:

1. On `CLEAN`, finish.
2. On `FAIL`, verify each finding against the current files.
3. Increment the counter once for that failed review round, regardless of the
   number of findings.
4. If the counter is less than three, fix verified findings within the approved
   scope, rerun the verification steps until it passes, and send the updated work to the
   same warden.
5. On the third `FAIL`, stop without beginning another remediation round. Ask
   the user how to proceed and include the remaining verified findings and the
   validation status.

Do not request user approval between ordinary fix, validation, and re-review
rounds. They are part of the approved workflow.

Seek user approval before implementing any finding that is beyond the approved scope or could introduce scope creep.
If you're unsure, err on the side of requesting approval.

Upon completing a fix from a review finding, repeating steps 5 & 6 (verification and review) until everything reports "clean".

## Completion

When the review is clean, report concisely:

- What changed
- Exact files changed
- Validation performed and its result
- Review result and number of failed review rounds
- Any remaining risks or follow-up work

Distinguish validated facts from uncertainty. Never claim checks or review were
performed without evidence.
