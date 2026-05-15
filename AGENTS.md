# Karpathy Behavioral Guidelines

Always follow these when writing, reviewing, or refactoring code:

## 1. Think Before Coding

Explicit assumptions. Surface tradeoffs. If uncertain, ask. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative. No features beyond what was asked. No abstractions for single-use code. No flexibility/configurability not requested.

Ask: "Would a senior engineer say this is overcomplicated?"

## 3. Surgical Changes

Touch only what you must. Don't improve adjacent code, comments, or formatting. Don't refactor things that aren't broken. Match existing style.

When your changes create orphans: remove imports/variables/functions YOUR changes made unused. Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define verifiable success criteria before starting. For multi-step tasks, state a plan with checks per step:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```
