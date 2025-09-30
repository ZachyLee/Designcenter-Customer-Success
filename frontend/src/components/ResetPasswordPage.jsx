import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isValidResetLink, setIsValidResetLink] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  // Check for access token and type from URL parameters or hash
  useEffect(() => {
    // Function to parse hash fragments
    const parseHashParams = () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      return params;
    };

    // Get tokens from URL parameters (query string)
    let accessToken = searchParams.get('access_token');
    let refreshToken = searchParams.get('refresh_token');
    let type = searchParams.get('type');
    let error = searchParams.get('error');
    let errorDescription = searchParams.get('error_description');

    // If not found in query string, check hash fragments
    if (!accessToken) {
      const hashParams = parseHashParams();
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
      type = hashParams.get('type');
      error = hashParams.get('error');
      errorDescription = hashParams.get('error_description');
    }

    console.log('Reset page tokens:', { accessToken, refreshToken, type, error });

    // Check if there's an error in the URL (like expired token)
    if (error) {
      let errorMessage = 'Password reset link is invalid or has expired.';

      if (error === 'access_denied' && errorDescription) {
        if (errorDescription.includes('expired') || errorDescription.includes('invalid')) {
          errorMessage = 'This password reset link has expired. Please request a new password reset from the sign-in page.';
        }
      }

      setError(errorMessage);
      // Give more time to read the error message with countdown
      setCountdown(8);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    if (type === 'recovery' && accessToken && refreshToken) {
      // Don't set session immediately - just validate the tokens exist
      setIsValidResetLink(true);
      console.log('Valid reset link detected');
    } else {
      // If we're on the reset page with no valid tokens, maybe check if user is already authenticated
      // This could happen if they just clicked the link and Supabase automatically handled the auth
      checkCurrentSession();
    }
  }, [searchParams, navigate]);

  // Check if user is already authenticated (from reset link)
  const checkCurrentSession = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (user && !error) {
        // User is authenticated, show the form
        setIsValidResetLink(true);
        console.log('User already authenticated for reset');
      } else {
        // No authentication, show error
        setError('Invalid or expired password reset link. Please request a new one.');
        setCountdown(8);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              navigate('/');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      console.error('Session check error:', err);
      setError('Unable to verify reset link. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccessMessage('');
  };

  const validateForm = () => {
    if (!formData.password || !formData.confirmPassword) {
      setError('Both password fields are required');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Try to update the password (user should already be authenticated at this point)
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (updateError) {
        // If update fails, try setting session from URL tokens
        const accessToken = searchParams.get('access_token') ||
                            new URLSearchParams(window.location.hash.substring(1)).get('access_token');
        const refreshToken = searchParams.get('refresh_token') ||
                             new URLSearchParams(window.location.hash.substring(1)).get('refresh_token');

        if (accessToken && refreshToken) {
          // Set session and try again
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) throw sessionError;

          // Try password update again
          const { error: retryError } = await supabase.auth.updateUser({
            password: formData.password
          });

          if (retryError) throw retryError;
        } else {
          throw updateError;
        }
      }

      // Immediately sign out to prevent any redirect triggers
      await supabase.auth.signOut();

      setSuccessMessage('Password updated successfully! Redirecting to sign in...');

      // Clear form
      setFormData({ password: '', confirmPassword: '' });

      // Redirect to auth page after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
      <div className="neumo-card max-w-md w-full">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <img
                src="/xcelerator.jpg"
                alt="Xcelerator Logo"
                className="w-16 h-16 object-contain"
              />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
            Set New Password
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">
            Enter your new password below
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="text-sm mb-3">{error}</div>
            {countdown > 0 && (
              <div className="text-xs text-red-600 mb-3">
                Redirecting to sign-in page in {countdown} seconds...
              </div>
            )}
            <button
              onClick={() => navigate('/')}
              className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Go to Sign-In Page Now
            </button>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <span className="text-sm">{successMessage}</span>
          </div>
        )}

        {/* Form - Only show if valid reset link */}
        {isValidResetLink && (
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">🔒</span>
              New Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your new password"
              className="neumo-input w-full text-base py-4"
              required
            />
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">🔒</span>
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your new password"
              className="neumo-input w-full text-base py-4"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="neumo-button primary w-full py-5 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="neumo-spinner mr-3"></div>
                Updating Password...
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span>🔄</span>
                <span>Update Password</span>
              </div>
            )}
          </button>
        </form>
        )}

        {/* Back to Sign In Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors py-2 px-4 rounded-lg hover:bg-gray-100"
          >
            <span className="mr-2">←</span>
            Back to Sign In
          </button>
        </div>

        {/* Info Card */}
        <div className="mt-4 neumo-card p-4 border-l-4 border-blue-400">
          <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
            <span className="mr-2">🔐</span>
            Secure Password Reset
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Your password will be securely updated and you'll be able to sign in with your new password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;