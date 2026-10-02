import { useEffect, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

const CENTER = [28.6139, 77.2090];

function PickerEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });
  return null;
}

function FlyToSelected({ location }) {
  const map = useMap();
  const previous = useRef("");

  useEffect(() => {
    if (!location) return;
    const key = `${location.lat}:${location.lng}`;
    if (previous.current === key) return;
    previous.current = key;
    map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 15), {
      duration: 0.65,
    });
  }, [location, map]);

  return null;
}

export default function LocationPicker({ location, onPick, onUseMyLocation }) {
  return (
    <div className="location-picker">
      <MapContainer
        center={CENTER}
        zoom={12}
        scrollWheelZoom={true}
        className="location-map-root"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <PickerEvents onPick={onPick} />
        <FlyToSelected location={location} />

        {location ? (
          <CircleMarker
            center={[location.lat, location.lng]}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              weight: 4,
              fillColor: "#1769ff",
              fillOpacity: 1,
            }}
          />
        ) : null}
      </MapContainer>

      <div className="location-overlay">
        <span>
          {location
            ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
            : "Tap the map to pin the incident"}
        </span>
        <button type="button" onClick={onUseMyLocation}>
          Use my location
        </button>
      </div>
    </div>
  );
}
