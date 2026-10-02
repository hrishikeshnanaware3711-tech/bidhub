import { useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";

const CENTER = [28.6139, 77.2090];

const FLAG_META = {
  RED: { label: "Fire", emoji: "🔥", className: "flag-marker-red" },
  GREEN: { label: "Tree / Other", emoji: "🌳", className: "flag-marker-green" },
  BLACK: { label: "Vehicle", emoji: "🚗", className: "flag-marker-black" },
  BLUE: { label: "Medical", emoji: "🚑", className: "flag-marker-blue" },
};

function createIcon(flag) {
  const meta = FLAG_META[flag] || FLAG_META.GREEN;
  return L.divIcon({
    className: "incident-marker-wrapper",
    html: `<div class="incident-marker ${meta.className}"><span>${meta.emoji}</span></div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 42],
    popupAnchor: [0, -38],
  });
}

export default function MapView({
  issues = [],
  heightClass = "map-height-large",
  onSelectIssue,
  selectedIssueId,
}) {
  const icons = useMemo(() => {
    return Object.fromEntries(
      Object.keys(FLAG_META).map((flag) => [flag, createIcon(flag)]),
    );
  }, []);

  return (
    <div className={`map-frame ${heightClass}`}>
      <MapContainer
        center={CENTER}
        zoom={13}
        scrollWheelZoom={true}
        className="map-root"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {issues.map((issue) => (
          <Marker
            key={issue.id}
            position={[issue.latitude, issue.longitude]}
            icon={icons[issue.flag] || icons.GREEN}
            zIndexOffset={selectedIssueId === issue.id ? 900 : 0}
            eventHandlers={{
              click: () => onSelectIssue?.(issue),
            }}
          >
            <Popup>
              <div className="popup-card">
                <div className="popup-head">
                  <div>
                    <span className="popup-eyebrow">INCIDENT #{issue.id}</span>
                    <strong>{issue.category}</strong>
                  </div>
                  <span className={`popup-flag popup-flag-${issue.flag.toLowerCase()}`}>
                    {FLAG_META[issue.flag]?.emoji || "📍"}
                  </span>
                </div>

                <p>{issue.description}</p>

                <div className="popup-detail-grid">
                  <span>Priority</span>
                  <b>{issue.priority}</b>
                  <span>Status</span>
                  <b>{issue.status.replace("_", " ")}</b>
                  <span>Department</span>
                  <b>{issue.department_name || "Unassigned"}</b>
                </div>

                {issue.duplicate_of_id ? (
                  <div className="popup-warning">
                    Possible duplicate of #{issue.duplicate_of_id}
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="map-key">
        {Object.entries(FLAG_META).map(([flag, meta]) => (
          <span key={flag}>
            <i className={`key-dot key-${flag.toLowerCase()}`} />
            {meta.label}
          </span>
        ))}
      </div>

      {!issues.length ? (
        <div className="map-empty">
          <span>No incidents match the current view.</span>
        </div>
      ) : null}
    </div>
  );
}
