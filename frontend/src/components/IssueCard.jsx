import {
  Building2,
  CalendarDays,
  MapPin,
  ShieldAlert,
} from "lucide-react";

import StatusBadge from "./StatusBadge";
import { assetUrl } from "../api";

const STEPS = ["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

export default function IssueCard({ issue, compact = false }) {
  const currentIndex = STEPS.indexOf(issue.status);

  return (
    <article className={`issue-card ${compact ? "compact" : ""}`}>
      <div className="issue-card-top">
        {issue.photo_url ? (
          <img src={assetUrl(issue.photo_url)} alt="Incident" className="issue-thumb" />
        ) : (
          <div className={`issue-thumb placeholder-flag flag-${issue.flag?.toLowerCase()}`}>
            {issue.flag === "RED" ? "🔥" : issue.flag === "BLACK" ? "🚗" : issue.flag === "BLUE" ? "🚑" : "🌳"}
          </div>
        )}

        <div className="issue-card-title-block">
          <div className="issue-row-topline">
            <span className="issue-id">#{issue.id}</span>
            <StatusBadge status={issue.status} />
          </div>
          <h3>{issue.category}</h3>
          <p>{issue.description}</p>
        </div>
      </div>

      <div className="issue-card-meta">
        <span>
          <MapPin size={13} />
          {issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}
        </span>
        <span>
          <Building2 size={13} />
          {issue.department_name || "Unassigned"}
        </span>
        <span>
          <CalendarDays size={13} />
          {new Date(issue.created_at).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      {issue.duplicate_of_id ? (
        <div className="duplicate-note">
          <ShieldAlert size={15} />
          Possible duplicate of Incident #{issue.duplicate_of_id}
        </div>
      ) : null}

      {!compact ? (
        <div className="issue-timeline">
          {STEPS.map((step, index) => (
            <div key={step} className={index <= currentIndex ? "timeline-node active" : "timeline-node"}>
              <span>{index + 1}</span>
              <small>{step.replace("_", " ")}</small>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
