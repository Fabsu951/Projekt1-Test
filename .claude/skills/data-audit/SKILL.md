---
name: data-audit
description: Audit a tabular dataset (CSV, Excel, DataFrame) for decision readiness before modeling or deployment - profiling, duplicates, invalid and sentinel values, missingness by group, leakage, selection bias, label quality and deployment mismatch - and write the result as a Fix/Learn/Limit readiness table. Use when the user asks to audit, check, profile or quality-review data, asks whether a model or dataset is fit for a decision, or works in Data_Audit_Sandbox_EN_v2.ipynb.
---

# Data audit

Goal: tell the user whether the data can support **the decision**, not just whether the file is tidy. Separate *observation* (a number from the file), *inference* (what it suggests) and *unknown* (what the file cannot tell).

## 0. Pin down the decision first
Before touching data, write down (ask the user only if it cannot be inferred):
- Decision and who it applies to (target population).
- Prediction time: what is known at that moment.
- Target: exact definition and outcome window.
- Data contract: meaning, unit and valid range of each column. Treat a missing contract as a finding.

## 1. Technical profile (facts about the file)
Run the helper on the raw file before any cleaning:

```bash
python3 .claude/skills/data-audit/scripts/profile.py data.csv --target <target> --group <segment>
```

It reports dtype / missing / unique per column, exact duplicate rows, duplicate IDs, sentinel candidates (-999, 999, 9999, -1, 0 in positive-only fields, literal `unknown`/`NA` strings), class balance and missingness per group. Use it as a starting point; it does not know the data contract.

## 2. Cleaning rules
- Fix only what the data contract says is invalid (e.g. negative income -> missing). Keep valid extremes.
- Remove duplicates only when they are known copies of the same event. Repeated real events need other handling.
- Sentinels are not numbers: `pdays = 999` means "never contacted". Recode to missing plus an indicator, or a separate category, before scaling or distance-based models.
- **Never drop incomplete rows without first comparing group shares before vs. after.** If missingness differs by group, dropping rows changes who the model is about.
- Log every cleaning step with the row count before and after.

## 3. Modeling hygiene (if a model is involved)
- Split before fitting anything that learns (imputation, scaling, encoding). Fit on train only; put it in a pipeline.
- Validation chooses the model; the test set is used once. A rerun with a new seed is a sensitivity check, not a new test.
- Always compare with a majority baseline. Report accuracy **and** balanced accuracy and minority-class recall.

## 4. Decision-readiness checks
For each, give one concrete number, field definition or policy fact:

| Dimension | Question |
|---|---|
| Representativeness | Are all groups in the target population present in the training data, and in what share? A random split preserves an absence. |
| Selection mechanism | Which rule decided who got a label (approval, who was called)? Missing label = unobserved, not "good outcome". |
| Leakage | Is every feature available at prediction time? Fields recorded after the outcome (collection flags, call duration) are invalid however good the score. |
| Label quality | Can the recorded label differ from the true outcome (missed defaults, delayed reporting)? |
| Deployment mismatch | Does the future population differ from the training population (group shares, ranges, missingness)? |

Dropping a sensitive or group column from the predictors does **not** create evidence about that group.

## 5. Report
End with:
1. The readiness table: `Dimension | Evidence | Decision consequence | Response (Fix / Learn / Limit) and next action`. Fix = change the process, Learn = gather better evidence, Limit = narrow the decision.
2. A recommendation: **Deploy / Do not deploy / Deploy with conditions**, with its scope (for whom), one model result and two data facts as evidence, the evidence gap, and a next action with owner. A condition like "monitor" needs a metric, an owner and a trigger.

Do not overclaim: simulated or oracle outcomes exist only in simulations; real data has no answer vault.
