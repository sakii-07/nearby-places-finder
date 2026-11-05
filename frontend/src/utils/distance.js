export function calculateDistanceMeters(fromLocation, toLocation) {
  if (!fromLocation || !toLocation) return null;

  const fromLatitude = Number(fromLocation.latitude);
  const fromLongitude = Number(fromLocation.longitude);
  const toLatitude = Number(toLocation.latitude);
  const toLongitude = Number(toLocation.longitude);

  if (!Number.isFinite(fromLatitude)
    || !Number.isFinite(fromLongitude)
    || !Number.isFinite(toLatitude)
    || !Number.isFinite(toLongitude)) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const startLatitude = toRadians(fromLatitude);
  const endLatitude = toRadians(toLatitude);

  const a = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2
  );

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const distanceKm = distanceMeters / 1000;
  return `${distanceKm.toFixed(distanceKm >= 10 ? 1 : 1)} km`;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
