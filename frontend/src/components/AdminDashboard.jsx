import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Pie, Line } from 'react-chartjs-2';
import ChartView, {
  generateQuestionStatsData,
  generateOverallStatsData,
  generateAreaStatsData,
  generateLanguageStatsData
} from './ChartView';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  ChartDataLabels
);

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [dashboardData, setDashboardData] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responseDetails, setResponseDetails] = useState({});
  const [questionStats, setQuestionStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activePanel, setActivePanel] = useState('voucher'); // 'assessment', 'voucher', or 'settings'
  const [activeTab, setActiveTab] = useState('overview');
  const [voucherFilter, setVoucherFilter] = useState('pending-approval'); // voucher workflow filter
  const [requestsCurrentPage, setRequestsCurrentPage] = useState(1);
  const requestsPerPage = 20;
  const [voucherCodesCurrentPage, setVoucherCodesCurrentPage] = useState(1);
  const voucherCodesPerPage = 20;
  
  // Filters
  const [filters, setFilters] = useState({
    email: '',
    language: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 20
  });

  // File upload
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  // Voucher administration
  const [voucherRequests, setVoucherRequests] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherError, setVoucherError] = useState(null);

  // Voucher codes management
  const [voucherCodes, setVoucherCodes] = useState([]);
  const [loadingVoucherCodes, setLoadingVoucherCodes] = useState(false);
  const [uploadingVoucherCodes, setUploadingVoucherCodes] = useState(false);
  const [voucherCodesError, setVoucherCodesError] = useState(null);

  // Rejection reason dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Analytics dashboard
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    status: 'all',
    country: 'all',
    startDate: '',
    endDate: '',
    partner: 'all'
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData();
      fetchResponses();
      fetchQuestionStats();
      fetchVoucherRequests();
      fetchVoucherCodes();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/api/admin/login', loginForm);
      
      localStorage.setItem('adminToken', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      
      setIsAuthenticated(true);
      setError(null);
      
      // Fetch initial data
      await Promise.all([
        fetchDashboardData(),
        fetchResponses(),
        fetchQuestionStats()
      ]);
    } catch (error) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setDashboardData(null);
    setResponses([]);
    setQuestionStats([]);
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data.statistics);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchResponses = async () => {
    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`/api/admin/responses?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResponses(response.data.data.responses);
      
      // Fetch details for each response
      response.data.data.responses.forEach(resp => {
        fetchResponseDetails(resp.id);
      });
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const fetchResponseDetails = async (responseId) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`/api/admin/responses/${responseId}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setResponseDetails(prev => ({
          ...prev,
          [responseId]: response.data.data
        }));
      }
    } catch (error) {
      console.error('Error fetching response details:', error);
    }
  };

  const fetchQuestionStats = async () => {
    try {
      const response = await axios.get('/api/questions/stats');
      setQuestionStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching question stats:', error);
    }
  };

  // Voucher Administration Functions
  const fetchVoucherRequests = async () => {
    try {
      setLoadingVouchers(true);
      setVoucherError(null);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/voucher-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVoucherRequests(response.data.data || []);
    } catch (error) {
      console.error('Error fetching voucher requests:', error);
      setVoucherError('Failed to load voucher requests');
    } finally {
      setLoadingVouchers(false);
    }
  };

  // Rejection dialog functions
  const handleRejectClick = (id) => {
    setRejectingRequestId(id);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const handleRejectCancel = () => {
    setShowRejectDialog(false);
    setRejectingRequestId(null);
    setRejectionReason('');
  };

  const handleRejectConfirm = async () => {
    if (rejectionReason.trim().length === 0) {
      alert('Please enter a reason for rejection (1-24 characters)');
      return;
    }
    if (rejectionReason.length > 24) {
      alert('Rejection reason must be 24 characters or less');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`/api/admin/voucher-requests/${rejectingRequestId}/reject`, {
        reason: rejectionReason.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh voucher data
      fetchVoucherRequests();
      handleRejectCancel();
      alert('Voucher request rejected successfully');
    } catch (error) {
      console.error('Error rejecting voucher request:', error);
      alert(`Failed to reject voucher request: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleVoucherAction = async (id, action) => {
    try {
      const token = localStorage.getItem('adminToken');

      if (action === 'issue-code') {
        // Find the request to get certification exam and other details
        const request = voucherRequests.find(r => r.id === id);
        if (!request) {
          setVoucherError('Request not found');
          return;
        }

        // Call the issue voucher code API
        const response = await axios.post('/api/admin/issue-voucher-code', {
          requestId: id,
          certificationExam: request.certification_exam,
          partnerEmail: request.partner_email,
          partnerCompany: request.partner_company,
          customerCompany: request.customer_company,
          candidateFirstName: request.candidate_first_name,
          candidateLastName: request.candidate_last_name,
          candidateEmail: request.customer_email,
          country: request.country
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          alert(`Voucher code issued successfully!\n\nVoucher Code: ${response.data.voucherCode}\n\nThis code has been assigned to:\n${request.candidate_first_name} ${request.candidate_last_name}\n${request.customer_email}`);

          // Refresh both voucher requests and voucher codes data
          fetchVoucherRequests();
          fetchVoucherCodes();
        }
      } else if (action === 'record-redemption') {
        // Handle redemption recording
        await axios.put(`/api/admin/voucher-requests/${id}/record-redemption`, {
          redemptionStatus: true,
          redemptionDate: new Date().toISOString()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh voucher data
        fetchVoucherRequests();
        alert('Redemption recorded successfully!');
      } else if (action === 'mark-certification-yes') {
        // Handle certification marking - Yes
        await axios.put(`/api/admin/voucher-requests/${id}/mark-certification`, {
          certificationAchieved: true,
          certificationAchievedDate: new Date().toISOString()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh voucher data
        fetchVoucherRequests();
        alert('Certification achieved marked as YES!');
      } else if (action === 'mark-certification-no') {
        // Handle certification marking - No
        await axios.put(`/api/admin/voucher-requests/${id}/mark-certification`, {
          certificationAchieved: false,
          certificationAchievedDate: new Date().toISOString()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh voucher data
        fetchVoucherRequests();
        alert('Certification achieved marked as NO!');
      } else {
        // Handle approve/reject actions as before
        await axios.put(`/api/admin/voucher-requests/${id}/${action}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh voucher data
        fetchVoucherRequests();
      }
    } catch (error) {
      console.error(`Error ${action} voucher request:`, error);
      if (error.response?.status === 404) {
        setVoucherError('No available voucher codes found for this certification exam type');
      } else {
        setVoucherError(`Failed to ${action} voucher request: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  // Voucher codes management functions
  const fetchVoucherCodes = async () => {
    try {
      setLoadingVoucherCodes(true);
      setVoucherCodesError(null);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/voucher-codes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVoucherCodes(response.data.data || []);
    } catch (error) {
      console.error('Error fetching voucher codes:', error);
      if (error.response?.status === 500) {
        setVoucherCodesError('Server error loading voucher codes. Check console for details.');
      } else if (error.response?.status === 404) {
        setVoucherCodesError('Voucher codes endpoint not found.');
      } else {
        setVoucherCodesError('Failed to load voucher codes. Please check your connection.');
      }
    } finally {
      setLoadingVoucherCodes(false);
    }
  };

  const handleResetVoucherAssignment = async (voucherCodeId, voucherCode) => {
    if (!window.confirm(`Are you sure you want to reset the assignment for voucher code "${voucherCode}"? This will free up the voucher code and make it available for reassignment.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`/api/admin/voucher-codes/${voucherCodeId}/reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh voucher codes list
      fetchVoucherCodes();

      // Show success message
      alert(`Voucher code "${voucherCode}" assignment has been reset and is now available for reassignment!`);
    } catch (error) {
      console.error('Error resetting voucher assignment:', error);
      alert(`Failed to reset voucher assignment: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleVoucherCodesUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.querySelector('input[type="file"]');
    const file = fileInput?.files[0];

    if (!file) {
      setVoucherCodesError('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('voucherCodesFile', file);

    try {
      setUploadingVoucherCodes(true);
      setVoucherCodesError(null);

      const token = localStorage.getItem('adminToken');
      const response = await axios.post('/api/admin/upload-voucher-codes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Refresh voucher codes data
        fetchVoucherCodes();
        // Reset form
        fileInput.value = '';
        alert('Voucher codes uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading voucher codes:', error);
      if (error.response?.status === 500) {
        setVoucherCodesError('Server error uploading voucher codes. Check console for details.');
      } else if (error.response?.status === 400) {
        setVoucherCodesError(error.response?.data?.error || 'Invalid file or data format');
      } else {
        setVoucherCodesError(error.response?.data?.message || 'Failed to upload voucher codes');
      }
    } finally {
      setUploadingVoucherCodes(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('This will cleanup duplicate voucher assignments for the same candidate and certification exam. Continue?')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post('/api/admin/cleanup-duplicate-vouchers', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        alert(`Cleanup completed!\n\n${response.data.message}`);
        // Refresh both voucher requests and voucher codes data
        fetchVoucherRequests();
        fetchVoucherCodes();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      alert('Failed to cleanup duplicates: ' + (error.response?.data?.error || error.message));
    }
  };

  const syncVoucherCodes = async () => {
    try {
      const response = await axios.post('/api/admin/sync-voucher-codes', {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.data.success) {
        alert(`Successfully synced ${response.data.syncedCount} voucher codes!`);
        // Refresh the data
        fetchVoucherRequests();
      }
    } catch (error) {
      console.error('Error syncing voucher codes:', error);
      alert('Failed to sync voucher codes: ' + (error.response?.data?.error || error.message));
    }
  };

  const exportVoucherCodesToExcel = () => {
    try {
      if (!voucherCodes || voucherCodes.length === 0) {
        alert('No voucher codes data to export');
        return;
      }

      // Prepare data for Excel export
      const exportData = voucherCodes.map(code => ({
        'Voucher Code': code.voucher_code || '',
        'Certification Exam': code.certification_exam || code.exam_type || '',
        'Partner': code.partner_company || code.partner_name || code.partner_email || '',
        'Customer Company': code.customer_company || '',
        'Candidate': code.candidate_first_name && code.candidate_last_name
          ? `${code.candidate_first_name} ${code.candidate_last_name}`
          : '',
        'Candidate Email': code.candidate_email || '',
        'Country': code.country || '',
        'Status': code.status || '',
        'Issue Date': code.issue_date ? new Date(code.issue_date).toLocaleDateString() : '',
        'Redemption Date': code.redemption_date ? new Date(code.redemption_date).toLocaleDateString() : '',
        'Certified Date': code.certified_date ? new Date(code.certified_date).toLocaleDateString() : '',
        'Created At': code.created_at ? new Date(code.created_at).toLocaleDateString() : '',
        'Updated At': code.updated_at ? new Date(code.updated_at).toLocaleDateString() : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { width: 40 }, // Voucher Code
        { width: 20 }, // Certification Exam
        { width: 25 }, // Partner
        { width: 20 }, // Customer Company
        { width: 20 }, // Candidate
        { width: 25 }, // Candidate Email
        { width: 12 }, // Country
        { width: 12 }, // Status
        { width: 12 }, // Issue Date
        { width: 15 }, // Redemption Date
        { width: 15 }, // Certified Date
        { width: 12 }, // Created At
        { width: 12 }  // Updated At
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Voucher Codes');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `voucher-codes-tracking-${dateStr}.xlsx`;

      // Write and download file
      XLSX.writeFile(wb, filename);

      console.log(`Exported ${exportData.length} voucher codes to ${filename}`);
    } catch (error) {
      console.error('Error exporting voucher codes:', error);
      alert('Failed to export voucher codes. Check console for details.');
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('excel', file);

    try {
      setUploadingExcel(true);
      setUploadSuccess(null);
      setError(null);

      const token = localStorage.getItem('adminToken');
      const response = await axios.post('/api/admin/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      setUploadSuccess(`Excel uploaded successfully! ${response.data.questionsImported} questions imported.`);
      
      // Refresh data
      await Promise.all([
        fetchDashboardData(),
        fetchQuestionStats()
      ]);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to upload Excel file');
    } finally {
      setUploadingExcel(false);
      event.target.value = '';
    }
  };

  const handleDownloadReport = async () => {
    try {
      const params = new URLSearchParams();
      
      if (filters.language) params.append('language', filters.language);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`/api/admin/report/pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'consolidated-report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  };

  const handleDeleteResponse = async (responseId) => {
    if (!confirm('Are you sure you want to delete this response?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`/api/admin/responses/${responseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh responses
      await fetchResponses();
      await fetchDashboardData();
    } catch (error) {
      console.error('Error deleting response:', error);
      alert('Failed to delete response');
    }
  };

  // Analytics functions
  const fetchAnalyticsData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();

      if (analyticsFilters.status !== 'all') params.append('status', analyticsFilters.status);
      if (analyticsFilters.country !== 'all') params.append('country', analyticsFilters.country);
      if (analyticsFilters.partner !== 'all') params.append('partner', analyticsFilters.partner);
      if (analyticsFilters.startDate) params.append('startDate', analyticsFilters.startDate);
      if (analyticsFilters.endDate) params.append('endDate', analyticsFilters.endDate);

      const response = await axios.get(`/api/admin/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAnalyticsData(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setVoucherError('Failed to load analytics data');
    }
  };

  // Real-time updates every 30 seconds when analytics is active
  useEffect(() => {
    let interval;
    if (voucherFilter === 'analytics') {
      fetchAnalyticsData(); // Initial fetch
      interval = setInterval(fetchAnalyticsData, 30000); // 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [voucherFilter, analyticsFilters]);

  const applyFilters = () => {
    fetchResponses();
  };

  const resetFilters = () => {
    setFilters({
      email: '',
      language: '',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20
    });
  };

  // Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="neumo-card max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Login</h1>
            <p className="text-gray-600">Access the admin dashboard</p>
          </div>

          {error && (
            <div className="neumo-alert error mb-4">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="neumo-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="neumo-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="neumo-button primary w-full disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="neumo-spinner mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Home
            </button>
          </div>


        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">📊</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">
                  {activePanel === 'voucher' ? 'Voucher Requests Administration' : 'Assessment Administration'}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                🏠 Home
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Panel Toggle */}
          <div className="flex space-x-2">
            <button
              onClick={() => setActivePanel('assessment')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activePanel === 'assessment'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📊 Assessment Administration
            </button>
            <button
              onClick={() => setActivePanel('voucher')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activePanel === 'voucher'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🎫 Voucher Requests Administration
            </button>
          </div>
        </div>

        {/* Alerts */}
        {uploadSuccess && (
          <div className="neumo-alert success mb-4">
            <p>{uploadSuccess}</p>
          </div>
        )}
        {error && (
          <div className="neumo-alert error mb-4">
            <p>{error}</p>
          </div>
        )}

        {/* Main Content */}
        {activePanel === 'assessment' && (
          <div>
            {/* Assessment Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-6">
              <div className="flex space-x-4">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'responses', label: 'Responses' },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'settings', label: 'Settings' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-6">
            {/* Summary Section with Answer Distribution */}
            <div className="neumo-card">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Answer Distribution Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                {(() => {
                  const totalYes = questionStats.reduce((sum, stat) => sum + (stat.yesCount || 0), 0);
                  const totalNo = questionStats.reduce((sum, stat) => sum + (stat.noCount || 0), 0);
                  const totalNA = questionStats.reduce((sum, stat) => sum + (stat.naCount || 0), 0);
                  const totalAnswers = totalYes + totalNo + totalNA;
                  
                  return (
                    <>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {totalYes}
                        </div>
                        <div className="text-sm text-gray-600">✅ Yes Answers</div>
                        <div className="text-xs text-gray-500">
                          {totalAnswers > 0 ? Math.round((totalYes / totalAnswers) * 100) : 0}% of all responses
                        </div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {totalNo}
                        </div>
                        <div className="text-sm text-gray-600">❌ No Answers</div>
                        <div className="text-xs text-gray-500">
                          {totalAnswers > 0 ? Math.round((totalNo / totalAnswers) * 100) : 0}% of all responses
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">
                          {totalNA}
                        </div>
                        <div className="text-sm text-gray-600">⚪ N/A Answers</div>
                        <div className="text-xs text-gray-500">
                          {totalAnswers > 0 ? Math.round((totalNA / totalAnswers) * 100) : 0}% of all responses
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="mt-4 text-center text-sm text-gray-500">
                Total Answers: {questionStats.reduce((sum, stat) => sum + (stat.yesCount || 0) + (stat.noCount || 0) + (stat.naCount || 0), 0)}
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="neumo-card text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {dashboardData.totalResponses}
                </div>
                <div className="text-gray-600">Total Responses</div>
              </div>
              <div className="neumo-card text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {dashboardData.responsesByLanguage.find(r => r.language === 'EN')?.count || 0}
                </div>
                <div className="text-gray-600">English Responses</div>
              </div>
              <div className="neumo-card text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {dashboardData.responsesByLanguage.find(r => r.language === 'ID')?.count || 0}
                </div>
                <div className="text-gray-600">Bahasa Responses</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {questionStats.length > 0 && (
                <div className="neumo-card">
                  <h3 className="text-lg font-semibold mb-4">Overall Answer Distribution</h3>
                  <ChartView
                    type="pie"
                    data={generateOverallStatsData({
                      yes: questionStats.reduce((sum, stat) => sum + (stat.yesCount || 0), 0),
                      no: questionStats.reduce((sum, stat) => sum + (stat.noCount || 0), 0),
                      na: questionStats.reduce((sum, stat) => sum + (stat.naCount || 0), 0)
                    })}
                    title="Overall Answers"
                  />
                </div>
              )}
              
              <div className="neumo-card">
                <h3 className="text-lg font-semibold mb-4">Language Distribution</h3>
                <ChartView
                  type="pie"
                  data={generateLanguageStatsData(dashboardData.responsesByLanguage)}
                  title="Responses by Language"
                />
              </div>
            </div>

            {/* Recent Responses */}
            <div className="neumo-card">
              <h3 className="text-lg font-semibold mb-4">Recent Responses</h3>
              <div className="overflow-x-auto">
                <table className="neumo-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Language</th>
                      <th>Completion</th>
                      <th>Answer Summary</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.slice(0, 5).map((response) => {
                      const details = responseDetails[response.id];
                      return (
                        <tr key={response.id}>
                          <td>{response.email}</td>
                          <td>{response.language === 'EN' ? 'English' : 'Bahasa Indonesia'}</td>
                          <td>
                            {details ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-12 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      details.completionPercentage === 100 ? 'bg-green-500' : 
                                      details.completionPercentage >= 80 ? 'bg-blue-500' : 
                                      details.completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${details.completionPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium">{details.completionPercentage}%</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Loading...</span>
                            )}
                          </td>
                          <td>
                            {details ? (
                              <div className="text-xs space-y-1">
                                <div className="flex space-x-2">
                                  <span className="text-green-600">✓ {details.answerSummary.yes}</span>
                                  <span className="text-red-600">✗ {details.answerSummary.no}</span>
                                  <span className="text-gray-500">N/A {details.answerSummary.na}</span>
                                </div>
                                <div className={`text-xs font-medium ${
                                  Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 90 ? 'text-green-600' :
                                  Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 75 ? 'text-blue-600' :
                                  Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 60 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  🎯 {Math.round((details.answerSummary.yes / details.answerSummary.total) * 100)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Loading...</span>
                            )}
                          </td>
                          <td>{new Date(response.timestamp).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Responses Tab */}
        {activeTab === 'responses' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="neumo-card">
              <h3 className="text-lg font-semibold mb-4">Filter Responses</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={filters.email}
                  onChange={(e) => setFilters({...filters, email: e.target.value})}
                  className="neumo-input"
                />
                <select
                  value={filters.language}
                  onChange={(e) => setFilters({...filters, language: e.target.value})}
                  className="neumo-select"
                >
                  <option value="">All Languages</option>
                  <option value="EN">English</option>
                  <option value="ID">Bahasa Indonesia</option>
                </select>
                <input
                  type="date"
                  placeholder="Start Date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="neumo-input"
                />
                <input
                  type="date"
                  placeholder="End Date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="neumo-input"
                />
                <div className="flex space-x-2">
                  <button onClick={applyFilters} className="neumo-button primary">
                    Apply
                  </button>
                  <button onClick={resetFilters} className="neumo-button">
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Responses Table */}
            <div className="neumo-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">All Responses</h3>
                <button
                  onClick={handleDownloadReport}
                  className="neumo-button success"
                >
                  Download Report
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="neumo-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email</th>
                      <th>Language</th>
                      <th>Completion</th>
                      <th>Answer Summary</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((response) => {
                      const details = responseDetails[response.id];
                      return (
                        <tr key={response.id}>
                          <td>{response.id}</td>
                          <td>{response.email}</td>
                          <td>{response.language === 'EN' ? 'English' : 'Bahasa Indonesia'}</td>
                          <td>
                            {details ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      details.completionPercentage === 100 ? 'bg-green-500' : 
                                      details.completionPercentage >= 80 ? 'bg-blue-500' : 
                                      details.completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${details.completionPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium">{details.completionPercentage}%</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Loading...</span>
                            )}
                          </td>
                          <td>
                            {details ? (
                              <div className="text-xs space-y-1">
                                <div className="flex space-x-3">
                                  <span className="text-green-600 font-medium">✓ {details.answerSummary.yes}</span>
                                  <span className="text-red-600 font-medium">✗ {details.answerSummary.no}</span>
                                  <span className="text-gray-500 font-medium">N/A {details.answerSummary.na}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className={`text-xs font-medium ${
                                    Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 90 ? 'text-green-600' :
                                    Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 75 ? 'text-blue-600' :
                                    Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 60 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    🎯 {Math.round((details.answerSummary.yes / details.answerSummary.total) * 100)}%
                                  </div>
                                  <div className={`w-2 h-2 rounded-full ${
                                    Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 90 ? 'bg-green-500' :
                                    Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 75 ? 'bg-blue-500' :
                                    Math.round((details.answerSummary.yes / details.answerSummary.total) * 100) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}></div>
                                </div>
                                {details.answerSummary.withRemarks > 0 && (
                                  <div className="text-purple-600 text-xs">
                                    💬 {details.answerSummary.withRemarks} remarks
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Loading...</span>
                            )}
                          </td>
                          <td>{new Date(response.timestamp).toLocaleDateString()}</td>
                          <td>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => navigate(`/summary/${response.id}`)}
                                className="neumo-button text-xs"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteResponse(response.id)}
                                className="neumo-button text-xs bg-red-100 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && questionStats.length > 0 && (
          <div className="space-y-6">
            <div className="neumo-card">
              <h3 className="text-lg font-semibold mb-4">Question Performance by Area</h3>
              <ChartView
                type="bar"
                data={generateAreaStatsData(questionStats)}
                title="Answers by Area"
              />
            </div>

            <div className="neumo-card">
              <h3 className="text-lg font-semibold mb-4">Individual Question Performance</h3>
              <ChartView
                type="bar"
                data={generateQuestionStatsData(questionStats)}
                title="Answers by Question"
              />
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="neumo-card">
              <h3 className="text-lg font-semibold mb-4">Excel File Management</h3>
              <p className="text-gray-600 mb-4">
                Upload a new Excel file to replace the current questions. The file should contain
                sheets named "Eng" and "Bahasa" with columns for Area, Activity, and Criteria.
              </p>

              <div className="mb-4">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  disabled={uploadingExcel}
                  className="neumo-input"
                />
              </div>

              {uploadingExcel && (
                <div className="flex items-center text-blue-600">
                  <div className="neumo-spinner mr-2"></div>
                  Uploading and processing Excel file...
                </div>
              )}
            </div>

            <div className="neumo-card">
              <h3 className="text-lg font-semibold mb-4">System Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Total Questions:</strong> {dashboardData?.totalQuestions || 0}
                </div>
                <div>
                  <strong>Total Responses:</strong> {dashboardData?.totalResponses || 0}
                </div>
                <div>
                  <strong>English Questions:</strong> {questionStats.filter(q => q.language === 'EN').length}
                </div>
                <div>
                  <strong>Bahasa Questions:</strong> {questionStats.filter(q => q.language === 'ID').length}
                </div>
              </div>
            </div>
          </div>
        )}
              </div>
            )}

        {/* Voucher Administration Panel */}
        {activePanel === 'voucher' && (
          <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Vouchers Issued */}
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700 mb-1">
                    {voucherRequests.filter(req => req.status === 'processed' && req.issue_date).length}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">Vouchers Issued</div>
                </div>

                {/* Vouchers Redeemed */}
                <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-2xl font-bold text-orange-700 mb-1">
                    {voucherRequests.filter(req => req.redemption_status === true).length}
                  </div>
                  <div className="text-xs text-orange-600 font-medium">Vouchers Redeemed</div>
                </div>

                {/* Certifications Achieved */}
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700 mb-1">
                    {voucherRequests.filter(req =>
                      req.certification_achieved === true &&
                      req.certified_date !== null
                    ).length}
                  </div>
                  <div className="text-xs text-green-600 font-medium">Certifications Achieved</div>
                </div>

                {/* Certifications Not Achieved */}
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700 mb-1">
                    {voucherRequests.filter(req =>
                      req.certification_achieved === false &&
                      req.certified_date !== null
                    ).length}
                  </div>
                  <div className="text-xs text-red-600 font-medium">Certifications Not Achieved</div>
                </div>

              </div>
            </div>

            {/* Main Section Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">🎫</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Voucher Requests Administration</h2>
                  <p className="text-sm text-gray-500">Manage NX Credly certification voucher requests</p>
                </div>
              </div>

              {/* Workflow Visualization */}
              <div className="space-y-4">
                {/* Workflow Path */}
                <div className="flex items-center justify-between relative">
                  {/* Progress Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0"></div>

                  {/* Stage 1: Pending Approval */}
                  <div className="relative z-10 flex flex-col items-center">
                    <button
                      onClick={() => setVoucherFilter('pending-approval')}
                      className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all ${
                        voucherFilter === 'pending-approval'
                          ? 'bg-yellow-500 text-white shadow-lg scale-110'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 hover:scale-105'
                      }`}
                    >
                      <span className="text-lg">🟡</span>
                      <span className="text-xs mt-1">
                        {voucherRequests.filter(req => req.status === 'pending').length}
                      </span>
                    </button>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-medium text-gray-700">Stage 1</div>
                      <div className="text-xs text-gray-500">Pending Approval</div>
                    </div>
                  </div>

                  {/* Arrow 1 */}
                  <div className="flex items-center justify-center relative z-10">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm">→</span>
                    </div>
                  </div>

                  {/* Stage 2: Issue Voucher Code */}
                  <div className="relative z-10 flex flex-col items-center">
                    <button
                      onClick={() => setVoucherFilter('issue-voucher-code')}
                      className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all ${
                        voucherFilter === 'issue-voucher-code'
                          ? 'bg-purple-500 text-white shadow-lg scale-110'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200 hover:scale-105'
                      }`}
                    >
                      <span className="text-lg">🟣</span>
                      <span className="text-xs mt-1">
                        {voucherRequests.filter(req => req.status === 'approved' && !req.voucher_code).length}
                      </span>
                    </button>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-medium text-gray-700">Stage 2</div>
                      <div className="text-xs text-gray-500">Issue Voucher</div>
                    </div>
                  </div>

                  {/* Arrow 2 */}
                  <div className="flex items-center justify-center relative z-10">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm">→</span>
                    </div>
                  </div>

                  {/* Stage 3: Record Redemption */}
                  <div className="relative z-10 flex flex-col items-center">
                    <button
                      onClick={() => setVoucherFilter('record-redemption')}
                      className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all ${
                        voucherFilter === 'record-redemption'
                          ? 'bg-orange-500 text-white shadow-lg scale-110'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200 hover:scale-105'
                      }`}
                    >
                      <span className="text-lg">🟠</span>
                      <span className="text-xs mt-1">
                        {voucherRequests.filter(req => req.voucher_code && !req.redemption_status).length}
                      </span>
                    </button>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-medium text-gray-700">Stage 3</div>
                      <div className="text-xs text-gray-500">Record Redemption</div>
                    </div>
                  </div>

                  {/* Arrow 3 */}
                  <div className="flex items-center justify-center relative z-10">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm">→</span>
                    </div>
                  </div>

                  {/* Stage 4: Mark Certification */}
                  <div className="relative z-10 flex flex-col items-center">
                    <button
                      onClick={() => setVoucherFilter('mark-certification')}
                      className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all ${
                        voucherFilter === 'mark-certification'
                          ? 'bg-red-500 text-white shadow-lg scale-110'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 hover:scale-105'
                      }`}
                    >
                      <span className="text-lg">🔴</span>
                      <span className="text-xs mt-1">
                        {voucherRequests.filter(req => req.status === 'processed' && req.redemption_status && req.certified_date === null).length}
                      </span>
                    </button>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-medium text-gray-700">Stage 4</div>
                      <div className="text-xs text-gray-500">Mark Certification</div>
                    </div>
                  </div>
                </div>

                {/* Additional Actions (separate) */}
                <div className="flex justify-center gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setVoucherFilter('analytics')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      voucherFilter === 'analytics'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    📈 Analytics Dashboard
                  </button>
                  <button
                    onClick={() => setVoucherFilter('tracking')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      voucherFilter === 'tracking'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    📊 Voucher Codes Tracking
                  </button>
                  <button
                    onClick={() => setVoucherFilter('rejected')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                      voucherFilter === 'rejected'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    ❌ Rejected Requests
                    <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                      {voucherRequests.filter(req => req.status === 'rejected').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setVoucherFilter('management')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      voucherFilter === 'management'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    📤 Voucher Codes Management
                  </button>
                </div>
              </div>
            </div>

            {/* Management Content */}
            {voucherFilter === 'management' ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="border-b border-gray-200 pb-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Voucher Codes Management</h3>
                  <p className="text-sm text-gray-600">Upload Excel files containing voucher codes for different certification exam types.</p>
                </div>

                {/* Error Display */}
                {voucherCodesError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{voucherCodesError}</p>
                  </div>
                )}

                {/* Upload Form */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <form onSubmit={handleVoucherCodesUpload} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Excel File (Voucher Codes)
                      </label>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Excel file should contain columns: Exam Type, Voucher Code, Status
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={uploadingVoucherCodes}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingVoucherCodes ? 'Uploading...' : 'Upload Voucher Codes'}
                    </button>
                  </form>
                </div>
              </div>
            ) : voucherFilter === 'tracking' ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Voucher Codes Tracking</h3>
                    <p className="text-sm text-gray-600">Monitor and manage voucher code usage and status</p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={syncVoucherCodes}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      🔄 Sync Voucher Codes
                    </button>
                    <button
                      onClick={handleCleanupDuplicates}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm"
                    >
                      🧹 Cleanup Duplicates
                    </button>
                    <button
                      onClick={exportVoucherCodesToExcel}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                    >
                      📊 Export to Excel
                    </button>
                  </div>
                </div>

                {loadingVoucherCodes ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading voucher codes...</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certification Exam</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Company</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Redemption Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certified Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                      {voucherCodes.length === 0 ? (
                        <tr>
                          <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                            No voucher codes found. Upload an Excel file to get started.
                          </td>
                        </tr>
                      ) : (
                        voucherCodes.slice((voucherCodesCurrentPage - 1) * voucherCodesPerPage, voucherCodesCurrentPage * voucherCodesPerPage).map((code, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm text-gray-900 font-semibold">
                              {(voucherCodesCurrentPage - 1) * voucherCodesPerPage + index + 1}
                            </td>
                            <td className="px-4 py-4 text-sm font-mono text-gray-900">
                              {code.voucher_code}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              {code.certification_exam || code.exam_type || '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.partner_email ? (
                                <div>
                                  {(code.partner_company || code.partner_name) && (
                                    <div className="font-medium text-gray-900">
                                      {code.partner_company || code.partner_name}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {code.partner_email}
                                  </div>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.customer_company || '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.candidate_first_name && code.candidate_last_name ? (
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {code.candidate_first_name} {code.candidate_last_name}
                                  </div>
                                  {code.candidate_email && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {code.candidate_email}
                                    </div>
                                  )}
                                </div>
                              ) : code.candidate_name ? (
                                <div>
                                  <div className="font-medium text-gray-900">{code.candidate_name}</div>
                                  {code.candidate_email && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {code.candidate_email}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.country || '-'}
                            </td>
                            <td className="px-4 py-4 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                code.status === 'completed' ? 'bg-green-100 text-green-800' :
                                code.status === 'issued' ? 'bg-blue-100 text-blue-800' :
                                code.status === 'redeemed' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {code.status || 'available'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.issue_date ? new Date(code.issue_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.redemption_date ? new Date(code.redemption_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.certified_date ? new Date(code.certified_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {code.status === 'issued' || code.status === 'redeemed' || code.status === 'completed' ? (
                                <button
                                  onClick={() => handleResetVoucherAssignment(code.id, code.voucher_code)}
                                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                                >
                                  Reset
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">Available</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                      </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls for Voucher Codes */}
                    {voucherCodes.length > voucherCodesPerPage && (
                      <div className="flex justify-between items-center mt-4 px-2">
                        <div className="text-sm text-gray-500">
                          Showing {((voucherCodesCurrentPage - 1) * voucherCodesPerPage) + 1} to {Math.min(voucherCodesCurrentPage * voucherCodesPerPage, voucherCodes.length)} of {voucherCodes.length} voucher codes
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setVoucherCodesCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={voucherCodesCurrentPage === 1}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="px-3 py-1 text-sm text-gray-700">
                            Page {voucherCodesCurrentPage} of {Math.ceil(voucherCodes.length / voucherCodesPerPage)}
                          </span>
                          <button
                            onClick={() => setVoucherCodesCurrentPage(prev => Math.min(prev + 1, Math.ceil(voucherCodes.length / voucherCodesPerPage)))}
                            disabled={voucherCodesCurrentPage >= Math.ceil(voucherCodes.length / voucherCodesPerPage)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : voucherFilter === 'analytics' ? (
              // Analytics Dashboard Section
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-3">
                      <select
                        value={analyticsFilters.status}
                        onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="processed">Processed</option>
                        <option value="redeemed">Redeemed</option>
                        <option value="certifications-achieved">Certifications Achieved</option>
                        <option value="certifications-not-achieved">Certifications Not Achieved</option>
                        <option value="rejected">Rejected</option>
                      </select>

                      <select
                        value={analyticsFilters.country}
                        onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, country: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="all">All Countries</option>
                        {analyticsData?.countries?.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>

                      <select
                        value={analyticsFilters.partner}
                        onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, partner: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="all">All Partners</option>
                        {analyticsData?.partners?.map(partner => (
                          <option key={partner} value={partner}>{partner}</option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={analyticsFilters.startDate}
                        onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Start Date"
                      />

                      <input
                        type="date"
                        value={analyticsFilters.endDate}
                        onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="End Date"
                      />
                    </div>

                    <div className="text-sm text-gray-500">
                      {lastUpdated && `Last Updated: ${lastUpdated.toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>

                {analyticsData ? (
                  <>
                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Bar Chart: Top Partners by Certifications */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold mb-4">📊 Top Partners by Certifications</h3>
                        <div className="h-80">
                          <Bar
                            data={{
                              labels: analyticsData.topPartners?.map(p => p.partner) || [],
                              datasets: [{
                                label: 'Certifications Achieved',
                                data: analyticsData.topPartners?.map(p => p.achieved) || [],
                                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                                borderColor: 'rgba(34, 197, 94, 1)',
                                borderWidth: 1
                              }, {
                                label: 'Certifications Not Achieved',
                                data: analyticsData.topPartners?.map(p => p.notAchieved) || [],
                                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                                borderColor: 'rgba(239, 68, 68, 1)',
                                borderWidth: 1
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { position: 'top' },
                                title: { display: false }
                              },
                              scales: {
                                x: { stacked: true },
                                y: {
                                  beginAtZero: true,
                                  stacked: true
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Pie Chart: Customer Type Distribution */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold mb-4">🥧 Certification Status by Customer Type</h3>
                        <div className="h-80">
                          <Pie
                            data={{
                              labels: (() => {
                                // Reorder to group achieved together, then not achieved
                                const statusData = analyticsData.statusDistribution || [];
                                const orderedStatuses = [
                                  'New - Certifications Achieved',
                                  'Existing - Certifications Achieved',
                                  'New - Certifications Not Achieved',
                                  'Existing - Certifications Not Achieved'
                                ];
                                return orderedStatuses.filter(status =>
                                  statusData.some(s => s.status === status)
                                );
                              })(),
                              datasets: [{
                                data: (() => {
                                  // Reorder data to match reordered labels
                                  const statusData = analyticsData.statusDistribution || [];
                                  const orderedStatuses = [
                                    'New - Certifications Achieved',
                                    'Existing - Certifications Achieved',
                                    'New - Certifications Not Achieved',
                                    'Existing - Certifications Not Achieved'
                                  ];
                                  return orderedStatuses.map(status => {
                                    const item = statusData.find(s => s.status === status);
                                    return item ? item.count : 0;
                                  }).filter((count, index) => {
                                    const status = orderedStatuses[index];
                                    return statusData.some(s => s.status === status);
                                  });
                                })(),
                                backgroundColor: (() => {
                                  // Reorder colors to match reordered labels
                                  const statusData = analyticsData.statusDistribution || [];
                                  const orderedStatuses = [
                                    'New - Certifications Achieved',
                                    'Existing - Certifications Achieved',
                                    'New - Certifications Not Achieved',
                                    'Existing - Certifications Not Achieved'
                                  ];
                                  return orderedStatuses.map(status => {
                                    switch(status) {
                                      case 'New - Certifications Achieved': return 'rgba(34, 197, 94, 0.8)'; // Bright Green
                                      case 'New - Certifications Not Achieved': return 'rgba(239, 68, 68, 0.8)'; // Red
                                      case 'Existing - Certifications Achieved': return 'rgba(59, 130, 246, 0.8)'; // Blue (better contrast)
                                      case 'Existing - Certifications Not Achieved': return 'rgba(251, 146, 60, 0.8)'; // Orange (better contrast)
                                      default: return 'rgba(156, 163, 175, 0.7)'; // gray for unknown
                                    }
                                  }).filter((color, index) => {
                                    const status = orderedStatuses[index];
                                    return statusData.some(s => s.status === status);
                                  });
                                })(),
                                borderColor: (() => {
                                  // Reorder border colors to match reordered labels
                                  const statusData = analyticsData.statusDistribution || [];
                                  const orderedStatuses = [
                                    'New - Certifications Achieved',
                                    'Existing - Certifications Achieved',
                                    'New - Certifications Not Achieved',
                                    'Existing - Certifications Not Achieved'
                                  ];
                                  return orderedStatuses.map(status => {
                                    switch(status) {
                                      case 'New - Certifications Achieved': return 'rgba(34, 197, 94, 1)';
                                      case 'New - Certifications Not Achieved': return 'rgba(239, 68, 68, 1)';
                                      case 'Existing - Certifications Achieved': return 'rgba(59, 130, 246, 1)';
                                      case 'Existing - Certifications Not Achieved': return 'rgba(251, 146, 60, 1)';
                                      default: return 'rgba(156, 163, 175, 1)';
                                    }
                                  }).filter((color, index) => {
                                    const status = orderedStatuses[index];
                                    return statusData.some(s => s.status === status);
                                  });
                                })(),
                                borderWidth: 1
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { position: 'right' },
                                tooltip: {
                                  callbacks: {
                                    title: function() {
                                      return '';
                                    },
                                    label: function(context) {
                                      const label = context.label || '';
                                      const value = context.parsed || 0;
                                      return `${label}: ${value}`;
                                    }
                                  }
                                },
                                datalabels: {
                                  display: true,
                                  color: 'white',
                                  font: {
                                    weight: 'bold',
                                    size: 14
                                  },
                                  formatter: function(value, context) {
                                    // Calculate percentage
                                    const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${percentage}%`;
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Bar Chart: Certifications by Country */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold mb-4">🌍 Certifications by Country</h3>
                        <div className="h-80">
                          <Bar
                            data={{
                              labels: analyticsData.certificationsByCountry?.map(c => c.country) || [],
                              datasets: [{
                                label: 'Certifications Achieved',
                                data: analyticsData.certificationsByCountry?.map(c => c.achieved) || [],
                                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                                borderColor: 'rgba(34, 197, 94, 1)',
                                borderWidth: 1
                              }, {
                                label: 'Certifications Not Achieved',
                                data: analyticsData.certificationsByCountry?.map(c => c.notAchieved) || [],
                                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                                borderColor: 'rgba(239, 68, 68, 1)',
                                borderWidth: 1
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { position: 'top' },
                                title: { display: false }
                              },
                              scales: {
                                x: { stacked: true },
                                y: {
                                  beginAtZero: true,
                                  stacked: true
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Line Chart: Certifications Over Time */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold mb-4">📈 Certifications Over Time</h3>
                        <div className="h-80">
                          <Line
                            data={{
                              labels: analyticsData.certificationsOverTime?.map(c => c.month) || [],
                              datasets: [{
                                label: 'Certifications Achieved',
                                data: analyticsData.certificationsOverTime?.map(c => c.count) || [],
                                borderColor: 'rgba(168, 85, 247, 1)',
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                tension: 0.4,
                                fill: true
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { position: 'top' },
                                title: { display: false }
                              },
                              scales: {
                                y: { beginAtZero: true }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Recent Voucher Requests Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <h3 className="text-lg font-semibold mb-4">📋 Recent Voucher Requests</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Company</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certification</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Type</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {analyticsData.recentRequests?.slice((requestsCurrentPage - 1) * requestsPerPage, requestsCurrentPage * requestsPerPage).map((request, index) => (
                              <tr key={request.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 text-sm text-gray-900 font-semibold">
                                  {(requestsCurrentPage - 1) * requestsPerPage + index + 1}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900">
                                  {new Date(request.request_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {request.partner_company || request.partner_name ? (
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {request.partner_company || request.partner_name}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {request.partner_email}
                                      </div>
                                    </div>
                                  ) : (
                                    request.partner_email
                                  )}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {request.customer_company || '-'}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {request.candidate_first_name} {request.candidate_last_name}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {request.certification_exam}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {request.country}
                                </td>
                                <td className="px-4 py-4 text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    request.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    request.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                                    request.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                                    request.status === 'redeemed' ? 'bg-yellow-100 text-yellow-800' :
                                    request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {request.status}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    request.customer_type === 'Existing' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                    {request.customer_type}
                                  </span>
                                </td>
                              </tr>
                            )) || (
                              <tr>
                                <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                                  No recent requests found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {analyticsData.recentRequests && analyticsData.recentRequests.length > requestsPerPage && (
                        <div className="flex justify-between items-center mt-4 px-2">
                          <div className="text-sm text-gray-500">
                            Showing {((requestsCurrentPage - 1) * requestsPerPage) + 1} to {Math.min(requestsCurrentPage * requestsPerPage, analyticsData.recentRequests.length)} of {analyticsData.recentRequests.length} requests
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setRequestsCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={requestsCurrentPage === 1}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-700">
                              Page {requestsCurrentPage} of {Math.ceil(analyticsData.recentRequests.length / requestsPerPage)}
                            </span>
                            <button
                              onClick={() => setRequestsCurrentPage(prev => Math.min(prev + 1, Math.ceil(analyticsData.recentRequests.length / requestsPerPage)))}
                              disabled={requestsCurrentPage >= Math.ceil(analyticsData.recentRequests.length / requestsPerPage)}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading analytics data...</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Voucher Requests Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm">📋</span>
                <h3 className="text-lg font-semibold text-gray-900">
                  {voucherFilter === 'pending-approval' && 'Pending Approval Requests'}
                  {voucherFilter === 'issue-voucher-code' && 'Ready to Issue Voucher Codes'}
                  {voucherFilter === 'record-redemption' && 'Record Redemption'}
                  {voucherFilter === 'mark-certification' && 'Mark Certification'}
                  {voucherFilter === 'rejected' && 'Rejected Requests'}
                  {voucherFilter === 'management' && 'Voucher Codes Management'}
                  {voucherFilter === 'tracking' && 'Voucher Codes Tracking'}
                  {voucherFilter === 'analytics' && 'Analytics Dashboard'}
                </h3>
              </div>

              {voucherError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {voucherError}
                </div>
              )}

              {loadingVouchers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-gray-600">Loading voucher requests...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certification</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {voucherRequests.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                            No voucher requests found
                          </td>
                        </tr>
                      ) : (
                        voucherRequests
                          .filter(request => {
                            switch (voucherFilter) {
                              case 'pending-approval':
                                return request.status === 'pending';
                              case 'issue-voucher-code':
                                return request.status === 'approved';
                              case 'record-redemption':
                                return request.status === 'processed' && request.voucher_code && !request.redemption_status;
                              case 'mark-certification':
                                return request.status === 'processed' && request.redemption_status && request.certified_date === null;
                              case 'rejected':
                                return request.status === 'rejected';
                              default:
                                return true;
                            }
                          })
                          .map((request) => (
                          <tr key={request.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm text-gray-900">
                              {new Date(request.request_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              <div className="text-sm font-medium text-gray-900">
                                {request.partner_company || request.partner_name}
                              </div>
                              <div className="text-sm text-gray-500">{request.partner_email}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">{request.customer_company}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              <div className="text-sm font-medium text-gray-900">{request.candidate_first_name} {request.candidate_last_name}</div>
                              <div className="text-sm text-gray-500">{request.customer_email}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">{request.certification_exam}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{request.country}</td>
                            <td className="px-4 py-4 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                request.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900 font-mono">
                              {request.voucher_code || '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              <div className="flex space-x-2">
                                {request.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleVoucherAction(request.id, 'approve')}
                                      className="text-green-600 hover:text-green-800 text-xs font-medium"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectClick(request.id)}
                                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {request.status === 'approved' && !request.voucher_code && (
                                  <button
                                    onClick={() => handleVoucherAction(request.id, 'issue-code')}
                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                  >
                                    Issue Voucher
                                  </button>
                                )}
                                {request.status === 'processed' && request.voucher_code && !request.redemption_status && (
                                  <button
                                    onClick={() => handleVoucherAction(request.id, 'record-redemption')}
                                    className="text-orange-600 hover:text-orange-800 text-xs font-medium"
                                  >
                                    Record Redemption
                                  </button>
                                )}
                                {request.status === 'processed' && request.redemption_status && !request.certification_achieved && (
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => handleVoucherAction(request.id, 'mark-certification-yes')}
                                      className="text-green-600 hover:text-green-800 text-xs font-medium"
                                    >
                                      Certified
                                    </button>
                                    <button
                                      onClick={() => handleVoucherAction(request.id, 'mark-certification-no')}
                                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                                    >
                                      Not Certified
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      )}

      {/* Admin Authentication Modal */}
      {!isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Access Required</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="neumo-spinner mr-2"></div>
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Voucher Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this voucher request (maximum 24 characters):
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => {
                if (e.target.value.length <= 24) {
                  setRejectionReason(e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              rows="3"
              placeholder="Enter rejection reason..."
              maxLength="24"
            />
            <div className="text-xs text-gray-500 mb-4">
              {rejectionReason.length}/24 characters
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectingRequestId(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminDashboard;
