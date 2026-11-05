import { useEffect, useMemo, useState } from 'react';
import Button from '../components/common/Button';
import AppLayout from '../components/layout/AppLayout';
import MapPlaceholder from '../components/map/MapPlaceholder';
import { useAuth } from '../context/useAuth';
import { placesApi } from '../services/api';
import { fromFeatureCollection } from '../services/placeData';
import { formatDistance } from '../utils/distance';

const DEFAULT_CENTER = { latitude: 18.5204, longitude: 73.8567 };
const CATEGORIES = [
  'All',
  'Restaurants',
  'Coffee',
  'Parks',
  'Hotels',
  'Grocery',
  'Historical',
  'Temple',
  'Transport',
  'Shopping',
  'Education',
  'Hospital',
];
const RADII = [500, 1000, 2000, 5000, 10000];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [places, setPlaces] = useState([]);
  const [category, setCategory] = useState('All');
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [radiusMeters, setRadiusMeters] = useState(2000);
  const [mode, setMode] = useState('all');
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [polygonSearchStatus, setPolygonSearchStatus] = useState('idle');
  const [polygonResults, setPolygonResults] = useState([]);
  const [polygonSearchError, setPolygonSearchError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const visiblePlaces = useMemo(
    () => (category === 'All' ? places : places.filter(
      (place) => place.category.toLowerCase() === category.toLowerCase(),
    )),
    [category, places],
  );

  const loadGeoJSON = async (categoryFilter = category) => {
    setIsLoading(true);
    setPolygonSearchStatus('idle');
    setPolygonSearchError('');
    setErrorMessage('');
    try {
      const data = await placesApi.geoJSON(
        categoryFilter === 'All' ? {} : { category: categoryFilter },
      );
      setPlaces(fromFeatureCollection(data));
      setMode('all');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const searchNearby = async (categoryFilter = category, origin = center) => {
    setIsLoading(true);
    setPolygonSearchStatus('idle');
    setPolygonSearchError('');
    setErrorMessage('');
    try {
      const params = {
        latitude: origin.latitude,
        longitude: origin.longitude,
        radius_meters: radiusMeters,
      };
      if (categoryFilter !== 'All') params.category = categoryFilter;
      const results = await placesApi.nearby(params);
      setPlaces(results);
      setMode('nearby');
      setIsDrawing(false);
      setStatusMessage(`Found ${results.length} places within ${radiusMeters.toLocaleString()} m.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPolygon = async (points = polygonPoints) => {
    const distinctPoints = new Set(points.map((point) => `${point.longitude},${point.latitude}`));
    if (distinctPoints.size < 3) {
      setErrorMessage('Add at least three distinct points to search an area.');
      return;
    }
    if (points.some((point) => (
      !Number.isFinite(point.longitude)
      || !Number.isFinite(point.latitude)
      || point.longitude < -180
      || point.longitude > 180
      || point.latitude < -90
      || point.latitude > 90
    ))) {
      setErrorMessage('Polygon points must use valid longitude and latitude coordinates.');
      return;
    }

    const ring = points.map((point) => [point.longitude, point.latitude]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

    setIsLoading(true);
    setPolygonSearchStatus('loading');
    setPolygonSearchError('');
    setErrorMessage('');
    setStatusMessage('');
    setIsDrawing(false);
    try {
      const results = await placesApi.withinPolygon({ type: 'Polygon', coordinates: [ring] });
      setPlaces(results);
      setPolygonResults(results);
      setPolygonSearchStatus('success');
      setMode('polygon');
      setStatusMessage(`Found ${results.length} places in the drawn area.`);
    } catch (error) {
      setPolygonSearchError(error.message);
      setPolygonSearchStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    placesApi
      .geoJSON()
      .then((data) => {
        if (active) setPlaces(fromFeatureCollection(data));
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    setStatusMessage('');
    if (mode === 'nearby') searchNearby(nextCategory);
    else if (mode === 'all') loadGeoJSON(nextCategory);
  };

  const handleLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Location is not available in this browser.');
      setCurrentLocation(null);
      return;
    }

    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { latitude: coords.latitude, longitude: coords.longitude };
        setCenter(nextLocation);
        setCurrentLocation(nextLocation);
        setStatusMessage('Map centered on your current location.');
      },
      (error) => {
        setCurrentLocation(null);
        setErrorMessage(error.code === error.PERMISSION_DENIED
          ? 'Location access was denied. Please enable location permissions.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your current location is unavailable right now.'
            : 'Location access timed out. Please try again.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const beginPolygon = () => {
    setPolygonPoints([]);
    setIsDrawing(true);
    setPolygonSearchStatus('idle');
    setPolygonSearchError('');
    setErrorMessage('');
    setStatusMessage('Click at least three points on the map, then search this area.');
  };

  return (
    <AppLayout
      title="Nearby Places Finder"
      subtitle="Explore nearby places on an interactive map."
      userName={user?.name || 'User'}
      userEmail={user?.email || ''}
      onLogout={logout}
      user={user}
    >
      <div className="space-y-5">
        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {statusMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            {statusMessage}
          </div>
        ) : null}

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Map search controls">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(160px,220px)_1fr] lg:items-end">
            <label className="space-y-1 text-sm font-medium text-slate-700" htmlFor="search-radius">
              Search radius
              <select
                id="search-radius"
                value={radiusMeters}
                onChange={(event) => setRadiusMeters(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                {RADII.map((radius) => (
                  <option key={radius} value={radius}>
                    {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleLocation}>
                Use My Location
              </Button>
              <Button type="button" onClick={() => searchNearby()} disabled={isLoading}>
                Search Nearby
              </Button>
              <Button type="button" variant="secondary" onClick={beginPolygon} disabled={isLoading}>
                Draw Search Area
              </Button>
              {isDrawing ? (
                <Button type="button" onClick={() => searchPolygon()} disabled={polygonPoints.length < 3 || isLoading}>
                  Search Area ({polygonPoints.length} points)
                </Button>
              ) : null}
              {polygonPoints.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPolygonPoints([]);
                    setIsDrawing(false);
                    setMode('all');
                    loadGeoJSON();
                  }}
                >
                  Clear Area
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filter by category">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => handleCategoryChange(item)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  category === item
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-label="Map exploration">
          <MapPlaceholder
            places={visiblePlaces}
            center={center}
            currentLocation={currentLocation}
            radiusMeters={radiusMeters}
            showRadius={mode === 'nearby'}
            polygonPoints={polygonPoints}
            drawing={isDrawing}
            onMapClick={(point) => setPolygonPoints((current) => [...current, point])}
            onCenterChange={setCenter}
          />
          {polygonSearchStatus !== 'idle' ? (
            <section
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
              aria-label="Polygon Search Results"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Polygon Search Results</h2>
                {polygonSearchStatus === 'success' ? (
                  <span className="text-sm text-slate-500">
                    Total matching places: {polygonResults.length}
                  </span>
                ) : null}
              </div>
              {polygonSearchStatus === 'loading' ? (
                <p className="text-sm text-slate-600" role="status">Searching places inside the selected area…</p>
              ) : null}
              {polygonSearchStatus === 'error' ? (
                <p className="text-sm text-red-700" role="alert">
                  Unable to search this area: {polygonSearchError}
                </p>
              ) : null}
              {polygonSearchStatus === 'success' && polygonResults.length === 0 ? (
                <p className="text-sm text-slate-600">No places found inside the selected area.</p>
              ) : null}
              {polygonSearchStatus === 'success' && polygonResults.length > 0 ? (
                <ul className="divide-y divide-slate-200">
                  {polygonResults.map((place, index) => (
                    <li
                      key={place.id ?? `${place.name}-${place.latitude}-${place.longitude}-${index}`}
                      className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="font-medium text-slate-900">{place.name}</h3>
                        <p className="text-sm text-slate-600">{place.category}</p>
                        {place.address ? <p className="text-sm text-slate-500">{place.address}</p> : null}
                      </div>
                      {Number.isFinite(place.distance_meters) ? (
                        <span className="shrink-0 text-sm text-slate-500">
                          Distance: {formatDistance(place.distance_meters)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
          <div className="flex justify-between gap-2 text-sm text-slate-500">
            <span>{mode === 'nearby' ? 'Nearby results' : mode === 'polygon' ? 'Search area results' : 'Places'} · {visiblePlaces.length}</span>
            {isLoading ? <span role="status">Loading places…</span> : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
