import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
    userType: 'Partner',
    country: 'Indonesia'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  // Check if user is already authenticated
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/landing');
      }
    };
    checkUser();
  }, [navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccessMessage('');
  };

  const validateForm = () => {
    // For forgot password, only email is required
    if (isForgotPassword) {
      if (!formData.email) {
        setError('Email address is required');
        return false;
      }
      if (!formData.email.includes('@')) {
        setError('Please enter a valid email address');
        return false;
      }
      return true;
    }

    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return false;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (isSignUp) {
      if (!formData.firstName || !formData.lastName) {
        setError('First name and last name are required for sign up');
        return false;
      }
      if (!formData.companyName) {
        setError('Company name is required for sign up');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
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
      if (isForgotPassword) {
        // Handle password reset
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        setSuccessMessage('Password reset email sent! Please check your inbox and follow the instructions to reset your password.');
        setFormData({ ...formData, email: '' }); // Clear email field
      } else if (isSignUp) {
        // Sign up with Supabase
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              name: `${formData.firstName} ${formData.lastName}`,
              companyName: formData.companyName,
              userType: formData.userType,
              country: formData.country,
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // Check if this is a new user or existing user
          // Supabase returns a user object even for existing emails, but doesn't send confirmation
          // We can check if the user was actually created by looking at the identities
          const isNewUser = data.user.identities && data.user.identities.length > 0;

          if (isNewUser) {
            // User created successfully
            setError('');
            alert('Account created successfully! Please check your email to verify your account.');
            setIsSignUp(false); // Switch to sign in mode
          } else {
            // User already exists
            throw new Error('An account with this email address already exists. Please sign in instead.');
          }
        }
      } else {
        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        if (data.user) {
          // Store user info in localStorage for backward compatibility
          localStorage.setItem('userEmail', data.user.email);
          localStorage.setItem('userName', data.user.user_metadata?.name || data.user.email);

          // Navigate to landing page
          navigate('/landing');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      companyName: '',
      userType: 'Partner',
      country: 'Indonesia'
    });
    setError('');
    setSuccessMessage('');
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setIsSignUp(false);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      companyName: '',
      userType: 'Partner',
      country: 'Indonesia'
    });
    setError('');
    setSuccessMessage('');
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
            {isForgotPassword
              ? 'Reset Password'
              : isSignUp
                ? 'Create Account'
                : 'Welcome to Designcenter Customer Success Journey'
            }
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">
            {isForgotPassword
              ? 'Enter your email address and we\'ll send you a link to reset your password'
              : isSignUp
                ? 'Join us to access the Solid Edge Success Criteria Checklist'
                : 'Please sign in to continue'
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <span className="text-sm">{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields (Sign Up Only) */}
          {isSignUp && !isForgotPassword && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">👤</span>
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter your first name"
                  className="neumo-input w-full text-base py-4"
                  required={isSignUp}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">👤</span>
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter your last name"
                  className="neumo-input w-full text-base py-4"
                  required={isSignUp}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">🏢</span>
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  placeholder="Enter your company name"
                  className="neumo-input w-full text-base py-4"
                  required={isSignUp}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">👥</span>
                  User Type
                </label>
                <select
                  name="userType"
                  value={formData.userType}
                  onChange={handleInputChange}
                  className="neumo-select w-full text-base py-4"
                  required={isSignUp && !isForgotPassword}
                >
                  <option value="Partner">Partner</option>
                  <option value="End User">End User</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">🌏</span>
                  Country
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="neumo-select w-full text-base py-4"
                  required={isSignUp && !isForgotPassword}
                >
                  <option value="Indonesia">Indonesia</option>
                  <option value="Malaysia">Malaysia</option>
                  <option value="Philippines">Philippines</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Thailand">Thailand</option>
                  <option value="Vietnam">Vietnam</option>
                </select>
              </div>
            </>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">📧</span>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              className="neumo-input w-full text-base py-4"
              required
            />
          </div>

          {/* Password Field (Hidden in Forgot Password Mode) */}
          {!isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                <span className="mr-2">🔒</span>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                className="neumo-input w-full text-base py-4"
                required={!isForgotPassword}
              />
            </div>
          )}

          {/* Confirm Password Field (Sign Up Only) */}
          {isSignUp && !isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                <span className="mr-2">🔒</span>
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                className="neumo-input w-full text-base py-4"
                required={isSignUp && !isForgotPassword}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="neumo-button primary w-full py-5 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="neumo-spinner mr-3"></div>
                {isForgotPassword
                  ? 'Sending Reset Email...'
                  : isSignUp
                    ? 'Creating Account...'
                    : 'Signing In...'
                }
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span>{isForgotPassword ? '📧' : isSignUp ? '✨' : '🚀'}</span>
                <span>
                  {isForgotPassword
                    ? 'Send Reset Email'
                    : isSignUp
                      ? 'Create Account'
                      : 'Sign In'
                  }
                </span>
              </div>
            )}
          </button>
        </form>

        {/* Toggle Mode & Links */}
        <div className="mt-6 text-center space-y-2">
          {!isForgotPassword ? (
            <>
              <p className="text-sm text-gray-600">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button
                  onClick={toggleMode}
                  className="ml-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
              {!isSignUp && (
                <p className="text-sm text-gray-600">
                  Forgot your password?
                  <button
                    onClick={toggleForgotPassword}
                    className="ml-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    Reset Password
                  </button>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Remember your password?
              <button
                onClick={toggleForgotPassword}
                className="ml-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>

        {/* Admin Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/admin')}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors py-2 px-4 rounded-lg hover:bg-gray-100"
          >
            <span className="mr-2">⚙️</span>
            Admin Dashboard
          </button>
        </div>

        {/* Info Card */}
        <div className="mt-4 neumo-card p-4 border-l-4 border-blue-400">
          <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
            <span className="mr-2">🔐</span>
            Secure Access
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Your account provides secure access to the Solid Edge Success Criteria Checklist assessment tool.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;