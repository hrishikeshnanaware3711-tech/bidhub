const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"
).replace(/\/$/, "");

const BACKEND_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error("Cannot reach the CivicWatch server. Start FastAPI and try again.");
  }

  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data?.detail
        ? data.detail
        : "The server could not complete the request.",
    );
  }

  return data;
}

export function assetUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${BACKEND_ORIGIN}${path}`;
}

export function login(username, password, role) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
}

export function registerAccount(name, username, password, role) {
  return request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, username, password, role }),
  });
}

export function getDemoUsers() {
  return request("/demo-users");
}

export function getIssues(filters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/issues${query}`);
}

export function getMyIssues(userId) {
  return request(`/issues/user/${Number(userId)}`);
}

export function getDepartments() {
  return request("/departments");
}

export function getCategories() {
  return request("/categories");
}

export function getFlags() {
  return request("/flags");
}

export async function createIssue({
  userId,
  category,
  description,
  latitude,
  longitude,
  photo,
}) {
  const formData = new FormData();

  formData.append("user_id", String(userId));
  formData.append("category", category);
  formData.append("description", description);
  formData.append("latitude", String(latitude));
  formData.append("longitude", String(longitude));

  if (photo) formData.append("photo", photo);

  return request("/issues", {
    method: "POST",
    body: formData,
  });
}

export function assignIssue(issueId, departmentId, priority, adminUserId) {
  return request(`/issues/${issueId}/assign?admin_user_id=${Number(adminUserId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      department_id: Number(departmentId),
      priority,
    }),
  });
}

export function updateIssueStatus(issueId, status, adminUserId) {
  return request(`/issues/${issueId}/status?admin_user_id=${Number(adminUserId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function deleteIssue(issueId, requesterId) {
  return request(`/issues/${issueId}?requester_id=${Number(requesterId)}`, {
    method: "DELETE",
  });
}

export function generateAIResponseBrief(issueId, adminUserId) {
  return request(`/issues/${issueId}/ai-brief?requester_id=${Number(adminUserId)}`);
}

export function reanalyzeIssue(issueId, adminUserId) {
  return request(`/issues/${issueId}/ai-reanalyze?admin_user_id=${Number(adminUserId)}`, {
    method: "POST",
  });
}

export function getAdminResolved(adminUserId) {
  return request(`/admin/resolved?admin_user_id=${Number(adminUserId)}`);
}

export function generateAIClosure(issueId, requesterId) {
  return request(`/issues/${issueId}/ai-closure?requester_id=${Number(requesterId)}`);
}

export function translateIncidentText(issueId, requesterId, text, targetLanguage) {
  return request(`/issues/${issueId}/ai-translate?requester_id=${Number(requesterId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target_language: targetLanguage }),
  });
}

export function askAICivicAssistant(adminUserId, question) {
  return request(`/admin/ai/ask?admin_user_id=${Number(adminUserId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export function generateAIAreaBrief(adminUserId) {
  return request(`/admin/ai/area-brief?admin_user_id=${Number(adminUserId)}`, {
    method: "POST",
  });
}

export function generateAIClusters(adminUserId) {
  return request(`/admin/ai/clusters?admin_user_id=${Number(adminUserId)}`, {
    method: "POST",
  });
}
