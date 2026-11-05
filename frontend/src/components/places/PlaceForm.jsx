import Button from '../common/Button';
import FormInput from '../common/FormInput';

export default function PlaceForm({ place, isSaving, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">
        {place.id ? 'Edit place' : 'Add a place'}
      </h3>
      <FormInput
        id="place-name"
        label="Name"
        value={place.name}
        onChange={(event) => place.onChange('name', event.target.value)}
        placeholder="Place name"
        required
      />
      <FormInput
        id="place-category"
        label="Category"
        value={place.category}
        onChange={(event) => place.onChange('category', event.target.value)}
        placeholder="Coffee, Parks, Restaurants…"
        required
      />
      <FormInput
        id="place-address"
        label="Address"
        value={place.address}
        onChange={(event) => place.onChange('address', event.target.value)}
        placeholder="Street address"
      />
      <label className="block space-y-2 text-sm font-medium text-slate-700" htmlFor="place-description">
        Description
        <textarea
          id="place-description"
          value={place.description}
          onChange={(event) => place.onChange('description', event.target.value)}
          rows={2}
          maxLength={10000}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="What makes this place special?"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <FormInput
          id="place-latitude"
          label="Latitude"
          type="number"
          value={place.latitude}
          onChange={(event) => place.onChange('latitude', event.target.value)}
          required
        />
        <FormInput
          id="place-longitude"
          label="Longitude"
          type="number"
          value={place.longitude}
          onChange={(event) => place.onChange('longitude', event.target.value)}
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : place.id ? 'Save changes' : 'Add place'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
