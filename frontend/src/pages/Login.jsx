import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import FormInput from '../components/common/FormInput';
import { useAuth } from '../context/useAuth';

const initialValues = { email: '', password: '' };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [name]: '',
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required.';
    }

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatusMessage('Please correct the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('');
    try {
      await login(formData);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setStatusMessage(error.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
        <div className="flex flex-col justify-between bg-slate-900 p-8 text-white md:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Nearby Places Finder</p>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">Discover great places around you.</h1>
          </div>

          <div className="mt-10 space-y-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-sm text-slate-200">Smart city discovery</p>
              <p className="mt-2 text-lg font-semibold">Find local favorites fast.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-sm text-slate-200">Built for real-time browsing</p>
              <p className="mt-2 text-lg font-semibold">Map-ready user experience.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-medium text-blue-600">Welcome back</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Sign in</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <FormInput
                id="email"
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                error={errors.email}
                required
              />

              <FormInput
                id="password"
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                error={errors.password}
                required
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            {statusMessage ? (
              <p role="alert" className={`mt-4 text-sm ${statusMessage.includes('correct') ? 'text-amber-600' : 'text-red-600'}`}>
                {statusMessage}
              </p>
            ) : null}

            <p className="mt-6 text-center text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
