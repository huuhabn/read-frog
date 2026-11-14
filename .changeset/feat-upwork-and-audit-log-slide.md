---
"workmate-ai": minor
---

feat(upwork): add Upwork Cover Letter assistant, settings page, and slide modal for audit logs

- Update Audit Log detail modal to use right-side slide Sheet instead of Dialog
- Add Upwork settings section in Options (profile facts, target word count, tone, rules, examples, and DOM selectors)
- Add Upwork Cover Letter and job analysis quick prompts in sidepanel, active exclusively on Upwork job detail pages
- Support strictly using profile facts without hallucination and answering client screening questions
- Add auto-fill Cover Letter button to write proposals directly into the Upwork form
- Add unified language translation settings and provider selection in handleSend with original/translated toggle
- Fix horizontal scrolling issues in the sidepanel chat frame
- Add full i18n support in English and Vietnamese for Upwork features
