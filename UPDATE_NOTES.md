# OneMap / CivicWatch update

## Login
- Added a startup login screen with Citizen and Administrator modes.
- Login uses seeded demo accounts and persists the selected account in localStorage.
- Backend validates that the selected account exists and that its stored role matches the selected role.
- This is prototype authentication, not production authentication. Production should use password/SSO/JWT/OAuth.

## Resolved incident deletion / archive behavior
- Once an administrator moves an incident to RESOLVED, it disappears from the administrator's active queue/map on refresh.
- The incident remains in the database so the citizen can still see the final status.
- A citizen can delete only their own RESOLVED incident.
- An administrator can delete any RESOLVED incident through the DELETE API.
- Deleting an incident clears duplicate references that pointed to it and removes its stored photo when possible.

## New Ollama task
The AI analysis endpoint already performs:
- Photo + text incident classification (with Gemma 3 vision when a photo is attached)
- Flag classification
- Category suggestion
- Priority suggestion
- Department suggestion
- Emergency-risk suggestion
- Summary and reason

The update also adds an on-demand AI response brief:
- Risk level suggestion
- High-level response actions
- Citizen-facing update message
- Admin note
- Tags

The response brief is generated only when an administrator clicks `Generate response brief`.

## New API routes
- POST /api/auth/login
- GET /api/admin/issues?admin_user_id=...
- GET /api/issues/{issue_id}/ai-brief
- DELETE /api/issues/{issue_id}?requester_id=...

## Changed admin write routes
- PUT /api/issues/{issue_id}/assign?admin_user_id=...
- PUT /api/issues/{issue_id}/status?admin_user_id=...

## Database migration
No new Issue columns were introduced in this update, so an existing SQLite database can continue to be used without a schema migration. New demo users are seeded if their IDs do not already exist.

## Front Page + Account System Update (October 2026)

The public entry screen was redesigned as a full-screen OneMap/CivicWatch landing experience. The old seeded-user dropdown login was removed from the main UI.

Authentication now supports:
- Sign in with username + password.
- Create account for Citizen or Administrator.
- Password confirmation and show/hide controls.
- Local PBKDF2 password hashing in the backend.
- Backwards-compatible SQLite addition of `username` and `password_hash` fields for an older `users` table.
- Demo credentials for presentations.

Demo credentials:
- Citizen: `demo.citizen` / `Citizen@123`
- Administrator: `admin.demo` / `Admin@123`

The rest of the issue reporting, map, AI/Ollama, admin workflow and resolved-archive functionality is preserved.
