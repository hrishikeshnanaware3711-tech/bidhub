const LABELS = {
  REPORTED: "Reported",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status?.toLowerCase() || "reported"}`}>
      {LABELS[status] || status || "Unknown"}
    </span>
  );
}
