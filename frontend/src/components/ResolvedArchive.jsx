import { useEffect, useState } from "react";
import { Archive, CheckCircle2, Sparkles, Trash2 } from "lucide-react";

import { deleteIssue, generateAIClosure, getAdminResolved } from "../api";

export default function ResolvedArchive({ user }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [closures, setClosures] = useState({});
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setIssues(await getAdminResolved(user.id));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(issue) {
    if (!window.confirm(`Permanently delete resolved incident #${issue.id}?`)) return;
    setBusyId(issue.id);
    try {
      await deleteIssue(issue.id, user.id);
      setIssues((current) => current.filter((item) => item.id !== issue.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function closure(issue) {
    setBusyId(issue.id);
    try {
      const result = await generateAIClosure(issue.id, user.id);
      setClosures((current) => ({ ...current, [issue.id]: result }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dashboard-panel resolved-archive-panel">
      <div className="panel-heading-row compact">
        <div>
          <span className="dashboard-eyebrow">RESOLUTION ARCHIVE</span>
          <h2>Resolved incidents</h2>
        </div>
        <Archive size={18} />
      </div>

      <p className="archive-note">Resolved issues leave the active admin queue. They remain here so the record can be reviewed before permanent deletion.</p>

      {error ? <div className="ai-studio-error">{error}</div> : null}
      {loading ? <div className="ai-placeholder">Loading resolved incidents...</div> : null}

      {!loading && issues.length === 0 ? (
        <div className="ai-placeholder"><CheckCircle2 size={17} /> No resolved incidents in the archive.</div>
      ) : null}

      <div className="resolved-archive-list">
        {issues.map((issue) => (
          <article className="resolved-archive-item" key={issue.id}>
            <div>
              <span className="issue-id">INCIDENT #{issue.id}</span>
              <strong>{issue.category}</strong>
              <span>{issue.department_name || "Unassigned"} · {issue.resolved_at ? new Date(issue.resolved_at).toLocaleString() : "Resolved"}</span>
            </div>
            <div className="archive-actions">
              <button type="button" className="ai-tool-button" onClick={() => closure(issue)} disabled={busyId === issue.id}>
                <Sparkles size={14} /> Closure message
              </button>
              <button type="button" className="delete-outline-button" onClick={() => remove(issue)} disabled={busyId === issue.id}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
            {closures[issue.id] ? (
              <div className="ai-output-box archive-closure">
                <strong>{closures[issue.id].closure_title}</strong>
                <p>{closures[issue.id].citizen_message}</p>
                <small>{closures[issue.id].resolution_summary}</small>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
