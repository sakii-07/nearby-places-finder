export const FAVORITES_STORAGE_KEY = 'nearby_places_favorites';

export function fromFeatureCollection(collection) {
  return (Array.isArray(collection?.features) ? collection.features : [])
    .filter((feature) => {
      if (feature.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
        return false;
      }
      const [longitude, latitude] = feature.geometry.coordinates;
      return Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180;
    })
    .map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return {
        id: feature.id ?? feature.properties?.id,
        name: feature.properties?.name || 'Untitled place',
        description: feature.properties?.description || '',
        category: feature.properties?.category || 'Other',
        address: feature.properties?.address || '',
        latitude,
        longitude,
      };
    });
}

export function getFavoriteIds() {
  const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (!saved) return [];

  let favoriteIds;
  try {
    favoriteIds = JSON.parse(saved);
  } catch (error) {
    throw new Error('Saved favorites could not be read. Clear the saved favorites and try again.', {
      cause: error,
    });
  }

  if (!Array.isArray(favoriteIds) || favoriteIds.some((id) => !['string', 'number'].includes(typeof id))) {
    throw new Error('Saved favorites have an invalid format. Clear the saved favorites and try again.');
  }
  return favoriteIds.map(String);
}

export function toggleFavorite(placeId) {
  const favoriteIds = getFavoriteIds();
  const normalizedId = String(placeId);
  const nextFavorites = favoriteIds.includes(normalizedId)
    ? favoriteIds.filter((id) => id !== normalizedId)
    : [...favoriteIds, normalizedId];

  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
  return nextFavorites;
}
