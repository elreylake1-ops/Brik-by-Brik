# Phase 4D-4B Blocked Movement Message Notes

## Purpose
Manual QA notes for the Investor Shield blocked/review movement message display in the existing Pipeline Update area.

## Manual QA Steps
1. Open the app and select a saved deal.
2. Use the Pipeline Update control to request a protected stage.
3. Confirm the existing pipeline feedback area shows the Investor Shield blocked or review message when the route returns a protected movement response.
4. Confirm the blocked message shows the blocked title, body, blocking gates, missing evidence, next action, and the reminder that pipeline state did not change.
5. Confirm the review message shows the review title, body, caution gates, weak or missing evidence, and recommended next action or task.
6. Confirm any deterministic or governance error message still appears when that guard is the one that blocks movement.
7. Confirm success behavior still shows the existing success message when the move is allowed.
8. Confirm no upload, edit, waiver, or task creation controls appear in the feedback area.

## Expected Read-Only Behavior
- Blocked title: `Investor Shield blocked this movement`
- Blocked body: `This deal cannot move to the requested stage yet because required due diligence gates are not clear.`
- Review title: `Investor Shield review required`
- Review body: `This deal has caution or incomplete due diligence items that should be reviewed before moving forward.`
