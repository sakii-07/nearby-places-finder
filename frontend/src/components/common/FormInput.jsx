export default function FormInput({
  id,
  name = id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  required = false,
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="ml-1 text-blue-600">*</span> : null}
        </label>
      ) : null}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          error ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-slate-200'
        }`}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
