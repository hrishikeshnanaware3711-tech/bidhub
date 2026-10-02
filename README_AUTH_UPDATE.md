# OneMap CivicWatch — Front Page + Real Accounts Update

This update keeps the existing citizen/admin issue workflow intact while replacing the old demo-only login with:

- full-screen OneMap landing page
- username + password sign-in
- citizen / administrator workspace selection
- account creation for citizen or administrator
- password confirmation and show/hide controls
- PBKDF2 password hashing in the FastAPI backend
- backwards-compatible SQLite migration for older `users` tables
- preserved demo accounts for presentations

## Demo accounts

Citizen:
- username: `demo.citizen`
- password: `Citizen@123`

Administrator:
- username: `admin.demo`
- password: `Admin@123`

These are demo credentials only. Production should use a proper identity/authentication system and stronger administrator provisioning.
