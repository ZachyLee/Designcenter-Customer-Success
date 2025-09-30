import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import VoucherRequestChart from './VoucherRequestChart';

const LandingPage = () => {
  const [language, setLanguage] = useState('EN');
  const [loading, setLoading] = useState(false);
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    // Get user info from Supabase
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserInfo({
          email: user.email,
          name: user.user_metadata?.name || user.email,
          firstName: user.user_metadata?.firstName || '',
          lastName: user.user_metadata?.lastName || '',
          companyName: user.user_metadata?.companyName || '',
          userType: user.user_metadata?.userType || '',
          country: user.user_metadata?.country || ''
        });
        // Also store in localStorage for backward compatibility
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userName', user.user_metadata?.name || user.email);
        localStorage.setItem('userCompany', user.user_metadata?.companyName || '');
        localStorage.setItem('userType', user.user_metadata?.userType || '');
        localStorage.setItem('userCountry', user.user_metadata?.country || '');
      } else {
        // If no user found, redirect to auth page
        navigate('/');
      }
    };
    getUserInfo();
  }, [navigate]);

  const handleStart = async () => {
    setLoading(true);

    // Store user info in sessionStorage for the checklist
    sessionStorage.setItem('userEmail', userInfo.email);
    sessionStorage.setItem('userLanguage', language);

    // Navigate to checklist
    navigate('/checklist');
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    } else {
      // Clear localStorage
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
      <div className="neumo-card max-w-md w-full">
        {/* User Info Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-600">
            <div>Welcome, {userInfo.name || userInfo.email}</div>
            {userInfo.companyName && (
              <div className="text-xs text-gray-500">
                {userInfo.companyName} {userInfo.userType && `(${userInfo.userType})`}
                {userInfo.country && ` • ${userInfo.country}`}
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-red-600 hover:text-red-800 transition-colors py-1 px-3 rounded-lg hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>

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
            Designcenter Customer Success Portal
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">
            {language === 'EN'
              ? ''
              : ''
            }
          </p>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
            <span className="mr-2">🌐</span>
            {language === 'EN' ? 'Select Language' : 'Pilih Bahasa'}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="neumo-select w-full text-base py-4"
          >
            <option value="EN">English</option>
            <option value="ID">Bahasa Indonesia</option>
          </select>
        </div>

        {/* Voucher Request Analytics - Only for Partners */}
        {userInfo.userType === 'Partner' && (
          <div className="mb-6">
            <VoucherRequestChart language={language} />
          </div>
        )}

        {/* NX Credly Certification Program - Only for Partners */}
        {userInfo.userType === 'Partner' && (
          <div className="mb-6">
            <button
              onClick={() => navigate('/partner/nx-voucher-request')}
              className="neumo-button primary w-full py-5 flex items-center justify-center space-x-3 text-lg"
            >
              <span className="text-2xl">🧩</span>
              <span>
                {language === 'EN'
                  ? 'NX Credly Certification'
                  : 'Minta Sertifikasi NX Credly'
                }
              </span>
            </button>
          </div>
        )}

        {/* Main Form Section */}
        <div className="space-y-6">

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={loading}
            className="neumo-button primary w-full py-5 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="neumo-spinner mr-3"></div>
                {language === 'EN' ? 'Loading...' : 'Memuat...'}
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span>🚀</span>
                <span>{language === 'EN' ? 'Solid Edge Assessment' : 'Mulai Penilaian'}</span>
              </div>
            )}
          </button>

          {/* Case Study Toggle */}
          <div className="mb-6">
            <button
              onClick={() => setShowCaseStudy(!showCaseStudy)}
              className="neumo-button primary w-full py-5 flex items-center justify-center space-x-3 text-lg"
            >
              <span className="text-2xl ">📽️</span>
              <span>
                {language === 'EN'
                  ? (showCaseStudy ? 'Hide Customer Success Story' : 'Customer Success Story')
                  : (showCaseStudy ? 'Sembunyikan Kisah Sukses Pelanggan' : 'Lihat Kisah Sukses Pelanggan')
                }
              </span>
              <span className="text-xl transition-transform duration-300">
                {showCaseStudy ? '⌃' : '⌄'}
              </span>
            </button>
          </div>

          {/* Case Study Content */}
          {showCaseStudy && (
            <div className="neumo-card mb-6 p-6 space-y-6 max-h-96 overflow-y-auto">
              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center justify-center">
                  <span className="mr-2">📽️</span>
                  {language === 'EN' ? 'ADR Group - Success Story' : 'ADR Group - Kisah Sukses'}
                </h3>
                <p className="text-sm text-gray-600">
                  {language === 'EN'
                    ? 'Indonesian automotive manufacturer achieving excellence with Solid Edge'
                    : 'Produsen otomotif Indonesia mencapai keunggulan dengan Solid Edge'
                  }
                </p>
              </div>

              {/* YouTube Video */}
              <div className="relative w-full neumo-card p-4" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-4 left-4 right-4 bottom-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] rounded-lg border border-gray-300"
                  src="https://www.youtube.com/embed/PTBSFF0sghA"
                  title="PT ADR Case Study"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>

              {/* Case Study Summary */}
              <div className="space-y-4">
                {/* Company Background */}
                <div className="neumo-card p-4">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <span className="mr-2">🏢</span>
                    {language === 'EN' ? 'Company Background' : 'Latar Belakang Perusahaan'}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {language === 'EN'
                      ? 'ADR Group (PT. Selamat Sempurna, Tbk) is a listed Indonesian manufacturer specializing in automotive components such as radiators, filters, and brake systems.'
                      : 'ADR Group (PT. Selamat Sempurna, Tbk) adalah produsen Indonesia yang terdaftar yang mengkhususkan diri dalam komponen otomotif seperti radiator, filter, dan sistem rem.'
                    }
                  </p>
                </div>

                {/* Challenges */}
                <div className="neumo-card p-4">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <span className="mr-2">⚙️</span>
                    {language === 'EN' ? 'Challenges Faced' : 'Tantangan yang Dihadapi'}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {language === 'EN'
                      ? 'The company encountered complex CAD design workflows, long modeling times, and inconsistencies in surface modeling quality using traditional methods.'
                      : 'Perusahaan menghadapi alur kerja desain CAD yang kompleks, waktu pemodelan yang lama, dan inkonsistensi dalam kualitas pemodelan permukaan menggunakan metode tradisional.'
                    }
                  </p>
                </div>

                {/* Solutions & Improvements */}
                <div className="neumo-card p-4">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <span className="mr-2">✅</span>
                    {language === 'EN' ? 'Solutions & Results' : 'Solusi & Hasil'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                    {language === 'EN'
                      ? 'After adopting Solid Edge with synchronous modeling, ADR Group achieved:'
                      : 'Setelah mengadopsi Solid Edge dengan pemodelan sinkron, ADR Group mencapai:'
                    }
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 ml-4">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></span>
                      {language === 'EN' ? '30% reduction in design iteration time' : '30% pengurangan waktu iterasi desain'}
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></span>
                      {language === 'EN' ? 'Smoother surface transitions with better G2 control' : 'Transisi permukaan yang lebih halus dengan kontrol G2 yang lebih baik'}
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></span>
                      {language === 'EN' ? 'Easier collaboration across design teams' : 'Kolaborasi yang lebih mudah antar tim desain'}
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></span>
                      {language === 'EN' ? 'Improved productivity in handling large assemblies' : 'Peningkatan produktivitas dalam menangani perakitan besar'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default LandingPage;