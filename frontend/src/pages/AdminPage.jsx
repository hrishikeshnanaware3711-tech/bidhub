import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Flame,
  Layers3,
  Map as MapIcon,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TreePine,
  UserRound,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  assignIssue,
  assetUrl,
  generateAIResponseBrief,
  getAdminIssues,
  getAdminStats,
  getDepartmentSummary,
  getDepartments,
  updateIssueStatus,
} from "../api";
import MapView from "../components/MapView";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import AIToolsPanel from "../components/AIToolsPanel";
import ResolvedArchive from "../components/ResolvedArchive";

const FLAG_META = {
  RED: { label: "Fire", color: "#ef4444", icon: "🔥" },
  GREEN: { label: "Tree / Other", color: "#22c55e", icon: "🌳" },
  BLACK: { label: "Vehicle", color: "#111827", icon: "🚗" },
  BLUE: { label: "Medical", color: "#3b82f6", icon: "🚑" },
};

const STATUS_ORDER = ["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Layers3 },
  { id: "incidents", label: "Incidents", icon: ShieldAlert },
  { id: "map", label: "Map View", icon: MapIcon },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "users", label: "Users", icon: UserRound },
];

function statusText(value) {
  return value.replaceAll("_", " ");
}

export default function AdminPage({ user }) {
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentSummary, setDepartmentSummary] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const [issueData, statsData, departmentData, departmentSummaryData] = await Promise.all([
        getAdminIssues(user.id),
        getAdminStats(user.id),
        getDepartments(),
        getDepartmentSummary(user.id),
      ]);

      setIssues(issueData);
      setStats(statsData);
      setDepartments(departmentData);
      setDepartmentSummary(departmentSummaryData);

      if (selectedIssue) {
        const updated = issueData.find((issue) => issue.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setAiBrief(null);
    if (selectedIssue) {
      setDepartmentId(selectedIssue.department_id ? String(selectedIssue.department_id) : "");
      setPriority(selectedIssue.priority || "MEDIUM");
    }
  }, [selectedIssue]);

  const filteredIssues = useMemo(() => {
    const query = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (flagFilter && issue.flag !== flagFilter) return false;
      if (statusFilter && issue.status !== statusFilter) return false;
      if (priorityFilter && issue.priority !== priorityFilter) return false;
      if (!query) return true;
      return (
        String(issue.id).includes(query) ||
        issue.category.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        (issue.department_name || "").toLowerCase().includes(query)
      );
    });
  }, [issues, flagFilter, statusFilter, priorityFilter, search]);

  const flagChartData = stats
    ? Object.entries(stats.flags).map(([key, value]) => ({
        name: FLAG_META[key].label,
        value,
        color: FLAG_META[key].color,
      }))
    : [];

  const recentIssues = issues.slice(0, 5);

  async function saveAssignment() {
    if (!selectedIssue || !departmentId) {
      setError("Select a department before assigning the incident.");
      return;
    }

    try {
      const updated = await assignIssue(selectedIssue.id, departmentId, priority, user.id);
      setSelectedIssue(updated);
      setMessage(`Incident #${updated.id} assigned successfully.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(nextStatus) {
    if (!selectedIssue) return;
    try {
      const updated = await updateIssueStatus(selectedIssue.id, nextStatus, user.id);
      setSelectedIssue(nextStatus === "RESOLVED" ? null : updated);
      setMessage(`Incident #${updated.id} moved to ${statusText(nextStatus)}. It is now archived from the active admin queue.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function generateBrief() {
    if (!selectedIssue) return;
    setAiBriefLoading(true);
    setError("");
    try {
      const result = await generateAIResponseBrief(selectedIssue.id, user.id);
      setAiBrief(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBriefLoading(false);
    }
  }

  function handleAIUpdated(updated) {
    setSelectedIssue(updated);
    setIssues((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  function navigate(item) {
    setActiveNav(item);
    setSidebarOpen(false);
    if (item === "incidents" || item === "reports") {
      document.querySelector(".admin-issue-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (item === "map") {
      document.querySelector(".admin-map-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <div className="admin-brand-pin"><span /></div>
          <div>
            <strong>OneMap</strong>
            <small>Civic command</small>
          </div>
        </div>

        <nav className="admin-nav">
          {SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={activeNav === id ? "admin-nav-item active" : "admin-nav-item"}
              onClick={() => navigate(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-user">
          <div className="admin-avatar"><UserRound size={18} /></div>
          <div>
            <strong>{user.name}</strong>
            <span>Municipal response</span>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <button type="button" className="admin-menu-toggle" onClick={() => setSidebarOpen((value) => !value)}>
            <Menu size={19} />
          </button>

          <div className="admin-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search incidents, locations, or IDs..."
            />
          </div>

          <div className="admin-top-actions">
            <button type="button" className="admin-icon-button" aria-label="Notifications">
              <Bell size={18} />
              {stats?.new_count ? <b>{stats.new_count}</b> : null}
            </button>
            <div className="admin-user-pill">
              <span className="admin-avatar small"><UserRound size={15} /></span>
              <div>
                <strong>{user.name}</strong>
                <span>Administrator</span>
              </div>
              <ChevronRight size={14} />
            </div>
          </div>
        </header>

        <main className="admin-content">
          <div className="admin-title-row">
            <div>
              <span className="dashboard-eyebrow">ADMIN INTERFACE</span>
              <h1>Incident command dashboard</h1>
              <p>See the city at a glance. Review AI analysis, assign departments and move incidents toward resolution.</p>
            </div>
            <button type="button" className="dashboard-refresh" onClick={refresh} disabled={loading}>
              <RefreshCw size={16} className={loading ? "rotating" : ""} /> Refresh data
            </button>
          </div>

          {error ? (
            <div className="admin-alert error"><AlertTriangle size={17} /> {error}<button type="button" onClick={() => setError("")}><X size={15} /></button></div>
          ) : null}
          {message ? (
            <div className="admin-alert success"><Check size={17} /> {message}<button type="button" onClick={() => setMessage("")}><X size={15} /></button></div>
          ) : null}

          {stats ? (
            <section className="admin-stats-grid">
              <StatCard icon={<Flame size={19} />} label="Fire Related" value={stats.flags.RED} helper={`${stats.new_count} new reports`} accent="red" />
              <StatCard icon={<TreePine size={19} />} label="Tree / Other" value={stats.flags.GREEN} helper="Civic incidents" accent="green" />
              <StatCard icon={<ShieldAlert size={19} />} label="Vehicle Accident" value={stats.flags.BLACK} helper={`${stats.priorities.HIGH} high / critical`} accent="black" />
              <StatCard icon={<BarChart3 size={19} />} label="Total Incidents" value={stats.total} helper={`${stats.resolved_count} resolved`} accent="blue" />
            </section>
          ) : null}

          <section className="admin-main-grid">
            <div className="admin-left-column">
              <section className="dashboard-panel admin-map-zone">
                <div className="panel-heading-row">
                  <div>
                    <span className="dashboard-eyebrow">LIVE GEOSPATIAL VIEW</span>
                    <h2>Incident Map</h2>
                  </div>
                  <div className="panel-badge"><span className="live-dot" /> Live</div>
                </div>

                <div className="dashboard-filter-row">
                  <select value={flagFilter} onChange={(event) => setFlagFilter(event.target.value)}>
                    <option value="">All flags</option>
                    <option value="RED">Red — Fire</option>
                    <option value="GREEN">Green — Tree / Other</option>
                    <option value="BLACK">Black — Vehicle</option>
                    <option value="BLUE">Blue — Medical</option>
                  </select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    {STATUS_ORDER.filter((status) => status !== "RESOLVED").map((status) => <option value={status} key={status}>{statusText(status)}</option>)}
                  </select>
                  <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="">All priorities</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <MapView
                  issues={filteredIssues}
                  selectedIssueId={selectedIssue?.id}
                  onSelectIssue={setSelectedIssue}
                  heightClass="map-height-dashboard"
                />
              </section>

              <section className="dashboard-panel admin-issue-zone">
                <div className="panel-heading-row">
                  <div>
                    <span className="dashboard-eyebrow">OPERATIONS QUEUE</span>
                    <h2>Recent incidents</h2>
                  </div>
                  <span className="record-count">{filteredIssues.length} records</span>
                </div>

                <div className="admin-issue-list">
                  {filteredIssues.length ? (
                    filteredIssues.slice(0, 8).map((issue) => (
                      <button
                        type="button"
                        key={issue.id}
                        className={selectedIssue?.id === issue.id ? "admin-issue-row selected" : "admin-issue-row"}
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <span className={`admin-incident-flag flag-${issue.flag.toLowerCase()}`}>
                          {FLAG_META[issue.flag]?.icon}
                        </span>
                        <span className="admin-issue-copy">
                          <strong>#{issue.id} · {issue.category}</strong>
                          <small>{issue.department_name || "Unassigned"} · {issue.priority}</small>
                        </span>
                        <StatusBadge status={issue.status} />
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="dashboard-empty"><CircleAlert size={29} /><strong>No matching incidents.</strong><span>Clear the filters or wait for a new citizen report.</span></div>
                  )}
                </div>
              </section>
            </div>

            <div className="admin-right-column">
              <section className="dashboard-panel analytics-panel">
                <div className="panel-heading-row compact">
                  <div>
                    <span className="dashboard-eyebrow">DISTRIBUTION</span>
                    <h2>Incident distribution</h2>
                  </div>
                  <BarChart3 size={18} />
                </div>

                <div className="donut-chart-wrap">
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={flagChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={79}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {flagChartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center">
                    <strong>{stats?.total || 0}</strong>
                    <span>Total</span>
                  </div>
                </div>

                <div className="chart-legend-list">
                  {flagChartData.map((item) => {
                    const percent = stats?.total ? Math.round((item.value / stats.total) * 100) : 0;
                    return (
                      <div key={item.name}>
                        <span><i style={{ background: item.color }} />{item.name}</span>
                        <strong>{item.value} <small>({percent}%)</small></strong>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="dashboard-panel analytics-panel">
                <div className="panel-heading-row compact">
                  <div>
                    <span className="dashboard-eyebrow">WORKFLOW</span>
                    <h2>Current status</h2>
                  </div>
                  <Clock3 size={18} />
                </div>

                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={STATUS_ORDER.map((status) => ({ name: statusText(status), value: stats?.statuses?.[status] || 0 }))} layout="vertical" margin={{ left: 8, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={72} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1769ff" radius={[0, 7, 7, 0]} barSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="dashboard-panel departments-panel">
                <div className="panel-heading-row compact">
                  <div>
                    <span className="dashboard-eyebrow">RESPONSE TEAMS</span>
                    <h2>Department overview</h2>
                  </div>
                  <Building2 size={18} />
                </div>

                <div className="department-list">
                  {departmentSummary.map((department) => (
                    <div className="department-row" key={department.id}>
                      <div className="department-icon"><Building2 size={16} /></div>
                      <div>
                        <strong>{department.name}</strong>
                        <span>{department.active} active · {department.incidents} total</span>
                      </div>
                      <ChevronRight size={15} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="dashboard-panel ai-admin-panel">
                <div className="ai-admin-heading">
                  <div className="ai-admin-icon"><Sparkles size={19} /></div>
                  <div>
                    <span className="powered-label">POWERED BY OLLAMA</span>
                    <h2>AI analysis</h2>
                  </div>
                  <span className="ai-online-dot">Online / Fallback ready</span>
                </div>

                {selectedIssue ? (
                  <>
                    <div className="ai-selected-title">
                      <strong>Incident #{selectedIssue.id}</strong>
                      <span>{selectedIssue.ai_status}</span>
                    </div>
                    <div className="ai-insight-list">
                      <div><span>Classification</span><strong>{selectedIssue.ai_category || selectedIssue.category}</strong></div>
                      <div><span>Flag</span><strong>{FLAG_META[selectedIssue.flag]?.icon} {FLAG_META[selectedIssue.flag]?.label}</strong></div>
                      <div><span>Suggested priority</span><strong>{selectedIssue.ai_priority || selectedIssue.priority}</strong></div>
                      <div><span>Emergency risk</span><strong>{selectedIssue.ai_emergency_risk ? "Potential risk" : "No immediate risk"}</strong></div>
                    </div>
                    <p className="ai-admin-summary">{selectedIssue.ai_summary || "No AI summary is available for this incident."}</p>
                    <button type="button" className="ai-brief-button" onClick={generateBrief} disabled={aiBriefLoading}>
                      <Sparkles size={14} />
                      {aiBriefLoading ? "Generating response brief..." : "Generate response brief"}
                    </button>
                    {aiBrief ? (
                      <div className="ai-brief-card">
                        <div className="ai-brief-risk">Risk level: <strong>{aiBrief.risk_level}</strong></div>
                        <strong>Recommended high-level actions</strong>
                        <ul>
                          {aiBrief.response_actions.map((action, index) => <li key={index}>{action}</li>)}
                        </ul>
                        <div className="ai-brief-message">Citizen update: {aiBrief.citizen_message}</div>
                        <small>{aiBrief.admin_note}</small>
                        <div className="ai-tags">
                          {aiBrief.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="ai-placeholder">
                    <Sparkles size={17} />
                    Select an incident to inspect its AI classification, summary and emergency-risk suggestion.
                  </div>
                )}
              </section>
            </div>
          </section>

          <AIToolsPanel
            user={user}
            selectedIssue={selectedIssue}
            onIssueUpdated={handleAIUpdated}
          />

          <ResolvedArchive user={user} />

          <section className="dashboard-panel response-panel">
            {selectedIssue ? (
              <>
                <div className="response-panel-header">
                  <div>
                    <span className="dashboard-eyebrow">RESPONSE CONSOLE</span>
                    <h2>Incident #{selectedIssue.id} · {selectedIssue.category}</h2>
                    <p>{selectedIssue.description}</p>
                  </div>
                  <button type="button" className="close-console" onClick={() => setSelectedIssue(null)}><X size={16} /></button>
                </div>

                <div className="response-console-grid">
                  <div className="response-media">
                    {selectedIssue.photo_url ? (
                      <img src={assetUrl(selectedIssue.photo_url)} alt="Reported incident" />
                    ) : (
                      <div className={`response-placeholder flag-${selectedIssue.flag.toLowerCase()}`}>
                        <span>{FLAG_META[selectedIssue.flag]?.icon}</span>
                        <small>No photo attached</small>
                      </div>
                    )}
                  </div>

                  <div className="response-controls">
                    <div className="control-block">
                      <label>Department</label>
                      <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                        <option value="">Select response department</option>
                        {departments.map((department) => (
                          <option value={department.id} key={department.id}>{department.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="control-block">
                      <label>Priority</label>
                      <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>

                    <button type="button" className="blue-button admin-save-button" onClick={saveAssignment}>
                      <Building2 size={16} /> Assign & Save
                    </button>
                  </div>

                  <div className="response-status-block">
                    <div className="control-block">
                      <label>Current status</label>
                      <div className="current-status-large"><StatusBadge status={selectedIssue.status} /></div>
                    </div>

                    <div className="workflow-buttons">
                      {selectedIssue.status === "REPORTED" ? (
                        <button type="button" onClick={() => changeStatus("ASSIGNED")}>Assign Incident</button>
                      ) : null}
                      {selectedIssue.status === "ASSIGNED" ? (
                        <button type="button" onClick={() => changeStatus("IN_PROGRESS")}>Start Work</button>
                      ) : null}
                      {selectedIssue.status === "IN_PROGRESS" ? (
                        <button type="button" className="resolved-button" onClick={() => changeStatus("RESOLVED")}>Mark Resolved</button>
                      ) : null}
                      {selectedIssue.status === "RESOLVED" ? (
                        <div className="resolved-message"><Check size={16} /> Resolution recorded</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="response-empty">
                <CircleAlert size={27} />
                <div><strong>Select an incident from the map or queue.</strong><span>The response console will show assignment, priority and status controls.</span></div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
