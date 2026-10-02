# OneMap / CivicWatch — Manual Update V2

This update is designed to be applied to the **existing OneMap project**. Do not recreate the project and do not rebuild the Python or Node environment.

## Files to REPLACE

1. `backend/app/schemas.py`
2. `backend/app/services/ai.py`
3. `backend/app/routers/issues.py`
4. `backend/app/routers/admin.py`
5. `frontend/src/api.js`
6. `frontend/src/pages/AdminPage.jsx`
7. `frontend/src/pages/CitizenPage.jsx`
8. `frontend/src/styles.css`

## Files to ADD

1. `frontend/src/components/AIToolsPanel.jsx`
2. `frontend/src/components/ResolvedArchive.jsx`
3. `frontend/src/components/AIReportTools.jsx`

The existing login/auth implementation is already part of the current project and remains intact:

- Citizen/Admin role selection at login
- Demo account selection
- Persistent local session
- Sign out
- Backend role validation

The existing resolved-issue behavior also remains:

- Resolved incidents leave the active administrator queue.
- Citizens can delete only their own resolved incidents.
- Administrators can permanently delete resolved incidents from the resolution archive.

## New Ollama capabilities

The same configured Ollama model is used for:

1. Photo + text incident classification
2. Flag suggestion
3. Priority suggestion
4. Department suggestion
5. Incident summarization
6. Emergency-risk suggestion
7. Administrative response brief
8. Re-analysis of an incident
9. Citizen closure message
10. Citizen language translation
11. Live-data administrative Q&A
12. Active-incident area brief
13. Active-incident thematic clustering

The LLM does not directly modify the database. The backend remains responsible for authorization, status transitions, deletions, geospatial duplicate rules, and persisted data.

## New endpoints

### Issue AI

- `GET /api/issues/{id}/ai-brief?requester_id=ADMIN_ID`
- `POST /api/issues/{id}/ai-reanalyze?admin_user_id=ADMIN_ID`
- `GET /api/issues/{id}/ai-closure?requester_id=USER_ID`
- `POST /api/issues/{id}/ai-translate?requester_id=USER_ID`

### Admin AI

- `POST /api/admin/ai/ask?admin_user_id=ADMIN_ID`
- `POST /api/admin/ai/area-brief?admin_user_id=ADMIN_ID`
- `POST /api/admin/ai/clusters?admin_user_id=ADMIN_ID`

### Resolved archive

- `GET /api/admin/resolved?admin_user_id=ADMIN_ID`
- Existing `DELETE /api/issues/{id}?requester_id=USER_ID_OR_ADMIN_ID` handles permanent deletion of resolved incidents.

## Manual update order

1. Back up the current project.
2. Replace the four backend files first.
3. Add the three new frontend components.
4. Replace the three frontend page/API/style files.
5. Restart FastAPI.
6. Restart Vite.
7. Keep the existing environment variables unchanged.
8. Test login -> report -> AI analysis -> duplicate flag -> admin assignment -> status -> resolved archive -> citizen deletion.

## Optional future AI upgrade

Semantic duplicate detection can be added later with an embedding model. It is deliberately not made a required dependency in this update so the core OneMap flow stays lightweight and deterministic.
