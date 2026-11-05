import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import Button from '../common/Button';
import { useAuth } from '../../context/useAuth';
import { favoritesApi, placesApi } from '../../services/api';
import { fromFeatureCollection } from '../../services/placeData';

export default function PlaceCollectionPage({ favoritesOnly = false }) {
  const { user, logout } = useAuth();
  const [places, setPlaces] = useState([]);
  const [favoriteState, setFavoriteState] = useState({ ids: [], error: '' });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const favoriteIds = favoriteState.ids;

  useEffect(() => {
    let active = true;

    const loadFavorites = async () => {
      try {
        const favorites = await favoritesApi.list();
        if (active) setFavoriteState({ ids: favorites.map((place) => String(place.id)), error: '' });
      } catch (error) {
        if (active) setFavoriteState({ ids: [], error: error.message || 'Unable to load favorites.' });
      }
    };

    const loadPlaces = async () => {
      try {
        const collection = await placesApi.geoJSON();
        if (active) setPlaces(fromFeatureCollection(collection));
      } catch (error) {
        if (active) setErrorMessage(error.message);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPlaces();
    loadFavorites();

    return () => {
      active = false;
    };
  }, []);

  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    return places.filter((place) => {
      if (favoritesOnly && !favoriteIds.includes(String(place.id))) return false;
      if (!query) return true;
      return [place.name, place.category, place.address, place.description]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [favoriteIds, favoritesOnly, places, search]);

  const handleToggleFavorite = async (placeId) => {
    const alreadySaved = favoriteIds.includes(String(placeId));
    try {
      if (alreadySaved) {
        await favoritesApi.remove(placeId);
      } else {
        await favoritesApi.add(placeId);
      }
      const favorites = await favoritesApi.list();
      setFavoriteState({ ids: favorites.map((place) => String(place.id)), error: '' });
    } catch (error) {
      setFavoriteState((current) => ({ ...current, error: error.message || 'Unable to update favorites.' }));
    }
  };

  const title = favoritesOnly ? 'Favorites' : 'Places';
  const subtitle = favoritesOnly
    ? 'Your saved places from your authenticated account.'
    : 'Browse and save places from your connected PostGIS database.';

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      userName={user?.name || 'User'}
      userEmail={user?.email || ''}
      onLogout={logout}
      user={user}
    >
      <section className="space-y-5" aria-label={`${title} listing`}>
        {errorMessage || favoriteState.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage || favoriteState.error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="sr-only" htmlFor="place-directory-search">Search places</label>
          <input
            id="place-directory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, category, or address"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm sm:max-w-md"
          />
          <span className="text-sm text-slate-500">
            {isLoading ? 'Loading places…' : `${visiblePlaces.length} ${title.toLowerCase()}`}
          </span>
        </div>

        {isLoading ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500" role="status">
            Loading places…
          </p>
        ) : visiblePlaces.length ? (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {visiblePlaces.map((place, index) => {
              const isFavorite = favoriteIds.includes(String(place.id));
              return (
                <article
                  key={place.id ?? `${place.name}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900">{place.name}</h2>
                      <p className="mt-1 text-sm text-blue-700">{place.category}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(place.id)}
                      aria-pressed={isFavorite}
                      aria-label={`${isFavorite ? 'Remove' : 'Add'} ${place.name} ${isFavorite ? 'from' : 'to'} favorites`}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        isFavorite
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isFavorite ? 'Saved' : 'Save'}
                    </button>
                  </div>
                  {place.address ? <p className="mt-3 text-sm text-slate-600">{place.address}</p> : null}
                  {place.description ? <p className="mt-2 text-sm text-slate-500">{place.description}</p> : null}
                  <p className="mt-3 text-xs text-slate-400">
                    {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-medium text-slate-700">
              {favoritesOnly && !search ? 'You have no saved favorites yet.' : `No ${title.toLowerCase()} match your search.`}
            </p>
            {favoritesOnly ? (
              <Link to="/places" className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800">
                Browse places to save favorites
              </Link>
            ) : null}
          </div>
        )}

        <div className="flex justify-end">
          <Link to="/dashboard">
            <Button variant="secondary">Back to overview</Button>
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
