import { useEffect } from 'react';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { calculateDistanceMeters, formatDistance } from '../../utils/distance';

const placeIcon = L.divIcon({
  className: 'place-marker-icon',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;border:2px solid white;background:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,0.2);"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapController({ center, drawing, onMapClick, onCenterChange }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false });
  }, [center.latitude, center.longitude, map]);

  useMapEvents({
    click(event) {
      if (drawing) onMapClick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
    moveend(event) {
      const { lat, lng } = event.target.getCenter();
      onCenterChange({ latitude: lat, longitude: lng });
    },
  });

  return null;
}

export default function MapPlaceholder({
  places = [],
  center,
  currentLocation = null,
  radiusMeters,
  showRadius = false,
  polygonPoints = [],
  drawing = false,
  onMapClick,
  onCenterChange,
}) {
  const polygonPositions = polygonPoints.map((point) => [point.latitude, point.longitude]);
  const validPlaces = places.filter(
    (place) => Number.isFinite(place.latitude)
      && Number.isFinite(place.longitude)
      && place.latitude >= -90
      && place.latitude <= 90
      && place.longitude >= -180
      && place.longitude <= 180,
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={11}
        scrollWheelZoom
        className="h-[420px] w-full"
        aria-label="Map of places"
      >
        <MapController
          center={center}
          drawing={drawing}
          onMapClick={onMapClick}
          onCenterChange={onCenterChange}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showRadius ? (
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusMeters}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.1 }}
          />
        ) : null}
        {polygonPositions.length > 0 ? (
          <>
            {polygonPositions.map((position, index) => (
              <Marker key={`polygon-point-${index}`} position={position} />
            ))}
            {polygonPositions.length === 2 ? (
              <Polyline positions={polygonPositions} pathOptions={{ color: '#7c3aed' }} />
            ) : null}
            {polygonPositions.length >= 3 ? (
              <Polygon positions={polygonPositions} pathOptions={{ color: '#7c3aed', fillOpacity: 0.15 }} />
            ) : null}
          </>
        ) : null}
        {currentLocation && Number.isFinite(currentLocation.latitude) && Number.isFinite(currentLocation.longitude) ? (
          <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={currentLocationIcon}>
            <Popup>
              <div className="min-w-24">
                <strong>Your location</strong>
              </div>
            </Popup>
          </Marker>
        ) : null}
        <MarkerClusterGroup chunkedLoading>
          {validPlaces.map((place, index) => {
            const placeDistanceMeters = currentLocation
              ? calculateDistanceMeters(currentLocation, place)
              : null;

            return (
              <Marker
                key={place.id ?? `${place.name}-${place.latitude}-${place.longitude}-${index}`}
                position={[place.latitude, place.longitude]}
                icon={placeIcon}
              >
                <Popup>
                  <div className="min-w-40">
                    <strong>{place.name}</strong>
                    <p className="mb-1 mt-1 text-sm">{place.category}</p>
                    {place.description ? <p className="mb-1 text-sm">{place.description}</p> : null}
                    {place.address ? <p className="text-xs">{place.address}</p> : null}
                    {placeDistanceMeters !== null ? (
                      <p className="mt-1 text-xs">Distance: {formatDistance(placeDistanceMeters)}</p>
                    ) : Number.isFinite(place.distance_meters) ? (
                      <p className="mt-1 text-xs">{(place.distance_meters / 1000).toFixed(2)} km away</p>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
      {validPlaces.length === 0 ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow">
          No places to display
        </div>
      ) : null}
      {drawing ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-violet-700 shadow">
          Click the map to add polygon points
        </div>
      ) : null}
    </div>
  );
}
