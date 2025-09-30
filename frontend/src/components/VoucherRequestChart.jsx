import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const VoucherRequestChart = ({ language }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('approved'); // 'approved' or 'certifications'

  useEffect(() => {
    fetchVoucherData();

    // Set up real-time subscription for voucher requests
    const subscription = supabase
      .channel('voucher_requests_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nx_voucher_requests'
        },
        () => {
          fetchVoucherData(); // Refresh data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchVoucherData = async () => {
    try {
      setLoading(true);

      // Fetch voucher request data grouped by country
      const { data, error } = await supabase
        .from('nx_voucher_requests')
        .select('country, status, certification_achieved')
        .order('country');

      if (error) throw error;

      // Group by country and count requests vs certifications
      const countryData = {};
      const countries = ['Indonesia', 'Malaysia', 'Philippines', 'Singapore', 'Thailand', 'Vietnam'];

      // Initialize all countries with 0
      countries.forEach(country => {
        countryData[country] = {
          approved: 0,
          certifications: 0
        };
      });

      // Count actual data
      data.forEach(request => {
        if (countryData.hasOwnProperty(request.country)) {
          // Only count approved/processed requests
          if (request.status === 'approved' || request.status === 'processed') {
            countryData[request.country].approved++;
          }
          // Count as certification only if certification_achieved is true
          if (request.certification_achieved === true) {
            countryData[request.country].certifications++;
          }
        }
      });

      // Convert to array format for chart
      const totalApproved = data.filter(r => r.status === 'approved' || r.status === 'processed').length;
      const totalCertifications = data.filter(r => r.certification_achieved === true).length;

      const chartArray = Object.entries(countryData).map(([country, counts]) => ({
        country,
        approved: counts.approved,
        certifications: counts.certifications,
        approvedPercentage: totalApproved > 0 ? ((counts.approved / totalApproved) * 100).toFixed(1) : 0,
        certificationsPercentage: totalCertifications > 0 ? ((counts.certifications / totalCertifications) * 100).toFixed(1) : 0,
        completionRate: counts.approved > 0 ? ((counts.certifications / counts.approved) * 100).toFixed(1) : 0
      }));

      setChartData(chartArray);
      setError('');
    } catch (error) {
      console.error('Error fetching voucher data:', error);
      setError('Failed to load voucher request data');
    } finally {
      setLoading(false);
    }
  };

  const getCountryFlag = (country) => {
    const flags = {
      'Indonesia': '🇮🇩',
      'Malaysia': '🇲🇾',
      'Philippines': '🇵🇭',
      'Singapore': '🇸🇬',
      'Thailand': '🇹🇭',
      'Vietnam': '🇻🇳'
    };
    return flags[country] || '🌏';
  };

  const getCountryColors = (index) => {
    const colorSets = [
      { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', bgLight: 'bg-blue-50' },
      { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', bgLight: 'bg-emerald-50' },
      { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200', bgLight: 'bg-amber-50' },
      { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', bgLight: 'bg-purple-50' },
      { bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-200', bgLight: 'bg-rose-50' },
      { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-200', bgLight: 'bg-indigo-50' }
    ];
    return colorSets[index % colorSets.length];
  };

  const getCurrentData = () => {
    const mappedData = chartData.map(item => ({
      ...item,
      currentValue: viewMode === 'approved' ? item.approved : item.certifications,
      currentPercentage: viewMode === 'approved' ? item.approvedPercentage : item.certificationsPercentage
    }));

    // Sort by current value (highest first), then by country name for ties
    return mappedData.sort((a, b) => {
      if (b.currentValue !== a.currentValue) {
        return b.currentValue - a.currentValue; // Higher values first
      }
      return a.country.localeCompare(b.country); // Alphabetical for ties
    });
  };

  const maxCount = Math.max(...getCurrentData().map(item => item.currentValue), 1);

  const handleViewToggle = (mode) => {
    setViewMode(mode);
  };

  if (loading) {
    return (
      <div className="neumo-card p-6">
        <div className="flex items-center justify-center">
          <div className="neumo-spinner mr-3"></div>
          <span className="text-gray-600">
            {language === 'EN' ? 'Loading analytics data...' : 'Memuat data analitik...'}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neumo-card p-6">
        <div className="flex items-center justify-center text-red-600">
          <span className="mr-2">⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const currentData = getCurrentData();
  const totalApproved = chartData.reduce((sum, item) => sum + item.approved, 0);
  const totalCertifications = chartData.reduce((sum, item) => sum + item.certifications, 0);

  return (
    <div className="neumo-card p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
          <span className="mr-2">📊</span>
          {language === 'EN'
            ? 'NX Certification Analytics by Country'
            : 'Analitik Sertifikasi NX per Negara'
          }
        </h3>
        <p className="text-sm text-gray-600">
          {language === 'EN'
            ? 'Interactive performance tracking across Southeast Asia'
            : 'Pelacakan kinerja interaktif di Asia Tenggara'
          }
        </p>
      </div>

      {/* Toggle Buttons */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewToggle('approved')}
            className={`flex-1 py-3 px-4 rounded-lg transition-all duration-300 ${
              viewMode === 'approved'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span>✅</span>
              <span className="font-medium">
                {language === 'EN' ? 'Requests Approved' : 'Permintaan Disetujui'}
              </span>
            </div>
            <div className="text-xs mt-1 opacity-90">
              {totalApproved} total
            </div>
          </button>

          <button
            onClick={() => handleViewToggle('certifications')}
            className={`flex-1 py-3 px-4 rounded-lg transition-all duration-300 ${
              viewMode === 'certifications'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🏆</span>
              <span className="font-medium">
                {language === 'EN' ? 'Certifications Achieved' : 'Sertifikasi Dicapai'}
              </span>
            </div>
            <div className="text-xs mt-1 opacity-90">
              {totalCertifications} total
            </div>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-3">
        {currentData.map((item, index) => {
          const colors = getCountryColors(index);
          const hasValue = item.currentValue > 0;

          return (
            <div key={item.country} className={`neumo-card p-4 transition-all duration-300 ${
              hasValue ? `${colors.bgLight} ${colors.border} border-2` : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center">
                {/* Country Info - No initials */}
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-2xl">{getCountryFlag(item.country)}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-base">
                      {item.country.length > 10 ? item.country.substring(0, 8) + '...' : item.country}
                    </div>
                    <div className={`text-xs font-medium ${
                      hasValue ? colors.text : 'text-gray-400'
                    }`}>
                      {hasValue ? `${item.currentPercentage}% of total` : 'No data'}
                    </div>
                  </div>
                </div>

                {/* Progress Visual */}
                <div className="flex items-center space-x-3">
                  {/* Circular Progress Indicator */}
                  <div className={`w-12 h-12 rounded-full ${
                    hasValue ? colors.bg : 'bg-gray-300'
                  } flex items-center justify-center shadow-lg`}>
                    <span className={`${
                      hasValue ? 'text-white' : 'text-gray-500'
                    } font-bold text-lg`}>
                      {item.currentValue}
                    </span>
                  </div>

                  {/* Bar Chart */}
                  <div className="w-16 h-3 bg-gray-200 rounded-full overflow-hidden">
                    {hasValue && (
                      <div
                        className={`h-full ${colors.bg} transition-all duration-500 rounded-full`}
                        style={{ width: `${(item.currentValue / maxCount) * 100}%` }}
                      ></div>
                    )}
                  </div>

                  {/* Stats - Inside card */}
                  <div className="text-center min-w-[50px]">
                    <div className={`text-sm font-bold ${
                      hasValue ? colors.text : 'text-gray-400'
                    }`}>
                      {item.currentPercentage}%
                    </div>
                    {viewMode === 'certifications' && item.approved > 0 && (
                      <div className="text-xs font-medium text-emerald-600">
                        {item.completionRate}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">
              {language === 'EN' ? 'Total Approved:' : 'Total Disetujui:'}
            </span>
            <span className="font-semibold text-blue-600">{totalApproved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">
              {language === 'EN' ? 'Certifications:' : 'Sertifikasi:'}
            </span>
            <span className="font-semibold text-green-600">{totalCertifications}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-700">
              {language === 'EN' ? 'Overall Success Rate' : 'Tingkat Keberhasilan Keseluruhan'}
            </div>
            <div className="text-2xl font-bold text-green-600">
              {totalApproved > 0 ? ((totalCertifications / totalApproved) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          {language === 'EN'
            ? 'Updates automatically • Click tabs to switch views'
            : 'Diperbarui otomatis • Klik tab untuk beralih tampilan'
          }
        </div>
      </div>
    </div>
  );
};

export default VoucherRequestChart;