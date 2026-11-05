import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import Button from '../common/Button';
import PlaceForm from './PlaceForm';
import { useAuth } from '../../context/useAuth';
import { favoritesApi, placesApi } from '../../services/api';

const EMPTY_PLACE = {
  id: null,
  name: '',
  category: '',
  address: '',
  description: '',
  latitude: '18.5204',
  longitude: '73.8567',
};
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
const PAGE_SIZE = 10;

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getDownloadFilename(contentDisposition, fallback) {
  return contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
}

export default function PlaceManagementPage() {
  const { user, logout } = useAuth();
  const [places, setPlaces] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [favoriteError, setFavoriteError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [placeForm, setPlaceForm] = useState(EMPTY_PLACE);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState(null);
  const csvInput = useRef(null);
  const geoJsonInput = useRef(null);

  useEffect(() => {
    let active = true;
    placesApi.list({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(category !== 'All' ? { category } : {}),
    })
      .then((result) => {
        if (!active) return;
        setPlaces(result.items);
        setTotal(result.total);
        setErrorMessage('');
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message || 'Unable to load places.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, page, reloadKey, search]);

  useEffect(() => {
    let active = true;
    favoritesApi.list()
      .then((favorites) => {
        if (active) {
          setFavoriteIds(favorites.map((place) => String(place.id)));
          setFavoriteError('');
        }
      })
      .catch((error) => {
        if (active) setFavoriteError(error.message || 'Unable to load favorites.');
      });
    return () => {
      active = false;
    };
  }, []);

  const pages = Math.ceil(total / PAGE_SIZE);
  const filteredCategories = useMemo(
    () => ['All', ...new Set([
      ...CATEGORIES.slice(1),
      ...places.map((place) => place.category).filter(Boolean),
    ])],
    [places],
  );

  const openAddForm = () => {
    setPlaceForm(EMPTY_PLACE);
    setIsFormOpen(true);
    setErrorMessage('');
    setStatusMessage('');
  };

  const openEditForm = (place) => {
    setPlaceForm({
      id: place.id,
      name: place.name,
      category: place.category,
      address: place.address || '',
      description: place.description || '',
      latitude: String(place.latitude),
      longitude: String(place.longitude),
    });
    setIsFormOpen(true);
    setErrorMessage('');
    setStatusMessage('');
  };

  const handlePlaceChange = (field, value) => {
    setPlaceForm((current) => ({ ...current, [field]: value }));
  };

  const handleSavePlace = async (event) => {
    event.preventDefault();
    if (!placeForm.name.trim() || !placeForm.category.trim()) {
      setErrorMessage('Name and Category are required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setStatusMessage('');
    const payload = {
      name: placeForm.name.trim(),
      category: placeForm.category.trim(),
      address: placeForm.address.trim() || null,
      description: placeForm.description.trim() || null,
      latitude: Number(placeForm.latitude),
      longitude: Number(placeForm.longitude),
    };
    try {
      if (placeForm.id) {
        await placesApi.update(placeForm.id, payload);
        setStatusMessage('Place updated.');
      } else {
        await placesApi.create(payload);
        setStatusMessage('Place created.');
        setPage(0);
      }
      setPlaceForm(EMPTY_PLACE);
      setIsFormOpen(false);
      setIsLoading(true);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save the place.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (place) => {
    if (!window.confirm(`Delete "${place.name}"? This cannot be undone.`)) return;
    setErrorMessage('');
    setStatusMessage('');
    try {
      await placesApi.remove(place.id);
      setStatusMessage('Place deleted.');
      setIsLoading(true);
      if (places.length === 1 && page > 0) setPage((current) => current - 1);
      else setReloadKey((key) => key + 1);
      setFavoriteIds((current) => current.filter((id) => id !== String(place.id)));
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete the place.');
    }
  };

  const handleToggleFavorite = async (placeId) => {
    const id = String(placeId);
    const isFavorite = favoriteIds.includes(id);
    setFavoriteBusyId(id);
    setFavoriteError('');
    try {
      if (isFavorite) await favoritesApi.remove(placeId);
      else await favoritesApi.add(placeId);
      setFavoriteIds((current) => (
        isFavorite ? current.filter((favoriteId) => favoriteId !== id) : [...current, id]
      ));
    } catch (error) {
      setFavoriteError(error.message || 'Unable to update favorites.');
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const handleImport = async (file, type) => {
    if (!file) return;
    setIsImporting(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const result = type === 'csv'
        ? await placesApi.uploadCSV(file)
        : await placesApi.uploadGeoJSON(file);
      setStatusMessage(`Imported ${result.successful_count} places; ${result.failed_count} records failed.`);
      if (result.errors.length) setErrorMessage(result.errors.slice(0, 5).join(' '));
      setPage(0);
      setIsLoading(true);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to import places.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCSV = async () => {
    setErrorMessage('');
    try {
      const response = await placesApi.exportCSV();
      downloadFile(
        response.data,
        getDownloadFilename(response.headers['content-disposition'], 'places.csv'),
      );
      setStatusMessage('CSV export downloaded.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to export CSV.');
    }
  };

  const handleExportGeoJSON = async () => {
    setErrorMessage('');
    try {
      const data = await placesApi.exportGeoJSON();
      downloadFile(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }),
        'places.geojson',
      );
      setStatusMessage('GeoJSON export downloaded.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to export GeoJSON.');
    }
  };

  return (
    <AppLayout
      title="Places"
      subtitle={user?.role === 'admin' ? 'Manage places across all users.' : 'Manage your places.'}
      userName={user?.name || 'User'}
      userEmail={user?.email || ''}
      onLogout={logout}
      user={user}
    >
      <section className="space-y-5" aria-label="Places management">
        {errorMessage || favoriteError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage || favoriteError}
          </div>
        ) : null}
        {statusMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            {statusMessage}
          </div>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Import and export places">
          <div>
            <h2 className="font-semibold text-slate-900">Import / Export</h2>
            <p className="mt-1 text-sm text-slate-500">Files include only places you are authorized to access.</p>
          </div>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              handleImport(event.target.files?.[0], 'csv');
              event.target.value = '';
            }}
          />
          <input
            ref={geoJsonInput}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={(event) => {
              handleImport(event.target.files?.[0], 'geojson');
              event.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={isImporting} onClick={() => csvInput.current?.click()}>
              {isImporting ? 'Importing…' : 'Import CSV'}
            </Button>
            <Button type="button" variant="secondary" disabled={isImporting} onClick={() => geoJsonInput.current?.click()}>
              Import GeoJSON
            </Button>
            <Button type="button" variant="secondary" onClick={handleExportCSV}>Export CSV</Button>
            <Button type="button" variant="secondary" onClick={handleExportGeoJSON}>Export GeoJSON</Button>
          </div>
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <label className="space-y-1 text-sm font-medium text-slate-700" htmlFor="place-search">
              Search
              <input
                id="place-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                  setIsLoading(true);
                }}
                placeholder="Search place name or address"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700" htmlFor="place-category-filter">
              Category
              <select
                id="place-category-filter"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(0);
                  setIsLoading(true);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {filteredCategories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <Button type="button" onClick={openAddForm}>+ Add Place</Button>
        </div>

        {isFormOpen ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <PlaceForm
              place={{ ...placeForm, onChange: handlePlaceChange }}
              isSaving={isSaving}
              onSubmit={handleSavePlace}
              onCancel={() => {
                setPlaceForm(EMPTY_PLACE);
                setIsFormOpen(false);
                setErrorMessage('');
              }}
            />
          </div>
        ) : null}

        {isLoading ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500" role="status">
            Loading places…
          </p>
        ) : places.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">ID</th>
                  <th className="min-w-44 px-3 py-3 font-medium">Place Name</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="min-w-48 px-3 py-3 font-medium">Address</th>
                  {user?.role === 'admin' ? <th className="whitespace-nowrap px-3 py-3 font-medium">Owner</th> : null}
                  <th className="px-3 py-3 text-center font-medium">Favorite</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {places.map((place) => {
                  const isFavorite = favoriteIds.includes(String(place.id));
                  return (
                    <tr key={place.id}>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">{place.id}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{place.name}</td>
                      <td className="px-3 py-3 text-slate-600">{place.category}</td>
                      <td className="px-3 py-3 text-slate-600">{place.address || '—'}</td>
                      {user?.role === 'admin' ? (
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          {place.owner_id ? `User #${place.owner_id}` : 'Unassigned'}
                        </td>
                      ) : null}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          disabled={favoriteBusyId === String(place.id)}
                          onClick={() => handleToggleFavorite(place.id)}
                          aria-pressed={isFavorite}
                          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${place.name} ${isFavorite ? 'from' : 'to'} favorites`}
                          className={`rounded-lg px-2 py-1 text-xl leading-none transition disabled:opacity-50 ${
                            isFavorite ? 'text-rose-600 hover:text-rose-700' : 'text-slate-400 hover:text-rose-600'
                          }`}
                        >
                          {isFavorite ? '♥' : '♡'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex gap-2">
                          <Button type="button" variant="primary" className="h-9 px-3 py-1.5" onClick={() => openEditForm(place)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            className="h-9 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                            onClick={() => handleDelete(place)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-medium text-slate-700">
              {search || category !== 'All' ? 'No places match these filters.' : 'No places yet. Add a place or import a file to get started.'}
            </p>
          </div>
        )}

        {!isLoading && pages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={page === 0}
                onClick={() => {
                  setIsLoading(true);
                  setPage((current) => current - 1);
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={page + 1 >= pages}
                onClick={() => {
                  setIsLoading(true);
                  setPage((current) => current + 1);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
