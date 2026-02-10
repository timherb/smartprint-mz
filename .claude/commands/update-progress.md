Update the project progress documentation based on this session's work.

## Your Task

Update progress tracking files for the Smart Print project.

### Step 1: Gather Information

- Review the conversation - What tasks were done, decisions made, files changed
- Get branch name: `git branch --show-current`
- Check git status: `git status`
- Check git diff: `git diff` (or `git diff --staged`)
- Read progress.md from project root (CLAUDE.md is already loaded)

### Step 2: Update progress.md (ALWAYS)

Add a new session entry at the TOP of the file (after the header).

Format:

```
================================================================================
## YYYY-MM-DD Session (Brief Title)
================================================================================

### Tasks Completed
- [x] Task that was completed
- [x] Another completed task
- [ ] Task started but not finished

### Key Decisions
- Chose X over Y because [reason]
- [Decision and reasoning - the "why" is valuable for future context]

### Summary
Brief paragraph summarizing what was accomplished.

### Files Modified
- path/to/file.ext - What was changed
- path/to/another.ext - What was changed

### Outstanding Items
- [ ] Task for future session

### Next Session
- Where to resume work
- Key context needed to continue
```

Conventions:
- Date: YYYY-MM-DD (e.g., 2025-02-09)
- Brief title describes the main focus
- Checkboxes: `- [x]` completed, `- [ ]` incomplete
- Key Decisions capture reasoning, not just facts
- Keep entries concise

### Step 3: Update features_list.json (IF APPLICABLE)

Only if features were worked on.

Mutable fields:
- `status`: pending | in_progress | implemented | needs_verification | blocked
- `tested`: true | false
- `test_results`: Description of test outcome
- `implementation_date`: YYYY-MM-DD
- `files_modified`: Array of file paths
- `blocked_reason`: Required when status is "blocked"

**Never change:** id, name, description, priority, testing_steps, depends_on

### Step 4: Update CLAUDE.md (IF APPLICABLE)

Only for significant changes:
- Component status changed
- New API boundaries added
- Architecture changed
- New known issues or workarounds
- Current priorities shifted

Update the relevant section in place - don't append history.

### Step 5: Report Summary

After updates, tell the user:
- What was added to progress.md
- What was updated in features_list.json (if anything)
- What was updated in CLAUDE.md (if anything)
- Remind them to review and commit when ready

## Important Notes

- Do NOT auto-commit - Leave changes for user review
- CLAUDE.md is already loaded - Don't re-read it
- Be accurate - Only document what was actually done
- Be concise - Keep entries informative but not verbose
- Capture the "why" - Key Decisions are valuable future context
