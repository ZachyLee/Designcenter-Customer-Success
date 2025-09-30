import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PartnerVoucherReport from './PartnerVoucherReport';

const NXVoucherRequest = () => {
  const [formData, setFormData] = useState({
    customerCompanyName: '',
    sfdcOpportunityId: '',
    country: 'Indonesia',
    existingNxCustomer: 'New',
    completedLearningPaths: 'No',
    firstName: '',
    lastName: '',
    companyEmail: '',
    certificationExam: 'NX Design Associate'
  });
  const [secondCustomer, setSecondCustomer] = useState({
    firstName: '',
    lastName: '',
    companyEmail: '',
    certificationExam: 'NX Design Associate'
  });
  const [includeSecondCustomer, setIncludeSecondCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [activeTab, setActiveTab] = useState('request'); // 'request' or 'report'
  const navigate = useNavigate();

  useEffect(() => {
    // Get user info from Supabase and verify Partner access
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userData = {
          email: user.email,
          name: user.user_metadata?.name || user.email,
          userType: user.user_metadata?.userType || '',
          country: user.user_metadata?.country || ''
        };

        // Fetch additional partner information from voucher requests
        try {
          const { data: voucherRequests, error } = await supabase
            .from('nx_voucher_requests')
            .select('partner_company, partner_name')
            .eq('partner_email', user.email)
            .limit(1);

          if (!error && voucherRequests && voucherRequests.length > 0) {
            userData.company = voucherRequests[0].partner_company || 'Not specified';
            userData.fullName = voucherRequests[0].partner_name || userData.name;
          }
        } catch (error) {
          console.error('Error fetching partner details:', error);
        }

        setUserInfo(userData);

        // If not a Partner, redirect to landing
        if (userData.userType !== 'Partner') {
          navigate('/landing');
        }
      } else {
        // If no user found, redirect to auth page
        navigate('/');
      }
    };
    getUserInfo();
  }, [navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSecondCustomerChange = (e) => {
    setSecondCustomer({
      ...secondCustomer,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleIncludeSecondCustomerChange = (e) => {
    setIncludeSecondCustomer(e.target.checked);
    if (!e.target.checked) {
      // Reset second customer data when unchecked
      setSecondCustomer({
        firstName: '',
        lastName: '',
        companyEmail: '',
        certificationExam: 'NX Design Associate'
      });
    }
    setError('');
  };

  const validateForm = () => {
    // Customer Company Name is required
    if (!formData.customerCompanyName.trim()) {
      setError('Customer Company Name is required');
      return false;
    }

    // SFDC Opportunity ID is optional - no validation needed

    // Country is required (has default value, but validate anyway)
    if (!formData.country.trim()) {
      setError('Country is required');
      return false;
    }

    // Customer Type is required (has default value, but validate anyway)
    if (!formData.existingNxCustomer.trim()) {
      setError('Please specify the customer type');
      return false;
    }

    // For new customers, Learning Paths completion is required
    if (formData.existingNxCustomer === 'New') {
      if (!formData.completedLearningPaths.trim()) {
        setError('Please specify if the customer has completed NX Learning Paths');
        return false;
      }
      // Validate NX Learning Paths requirement for new customers
      if (formData.completedLearningPaths === 'No') {
        setError('Voucher request cannot be submitted. New NX customers must complete NX Learning Paths in LaaS before certification vouchers can be requested.');
        return false;
      }
    }

    // Candidate 1 fields are all required
    if (!formData.firstName.trim()) {
      setError('Candidate 1 First Name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Candidate 1 Last Name is required');
      return false;
    }
    if (!formData.companyEmail.trim()) {
      setError('Candidate 1 Company Email Address is required');
      return false;
    }
    if (!formData.companyEmail.includes('@')) {
      setError('Please enter a valid email address for Candidate 1');
      return false;
    }
    if (!formData.certificationExam.trim()) {
      setError('Candidate 1 Certification Exam is required');
      return false;
    }

    // Validate candidate 2 if included - all fields required
    if (includeSecondCustomer) {
      if (!secondCustomer.firstName.trim()) {
        setError('Candidate 2 First Name is required');
        return false;
      }
      if (!secondCustomer.lastName.trim()) {
        setError('Candidate 2 Last Name is required');
        return false;
      }
      if (!secondCustomer.companyEmail.trim()) {
        setError('Candidate 2 Company Email Address is required');
        return false;
      }
      if (!secondCustomer.companyEmail.includes('@')) {
        setError('Please enter a valid email address for Candidate 2');
        return false;
      }
      if (!secondCustomer.certificationExam.trim()) {
        setError('Candidate 2 Certification Exam is required');
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

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Prepare voucher request data for first customer
      const voucherRequestData = {
        partner_user_id: user.id,
        partner_email: user.email,
        partner_name: user.user_metadata?.name || user.email,
        partner_company: user.user_metadata?.companyName || '',
        customer_company: formData.customerCompanyName,
        sfdc_opportunity_id: formData.sfdcOpportunityId,
        country: formData.country,
        customer_type: formData.existingNxCustomer,
        completed_learning_paths: formData.completedLearningPaths,
        candidate_first_name: formData.firstName,
        candidate_last_name: formData.lastName,
        customer_email: formData.companyEmail,
        certification_exam: formData.certificationExam,
        request_date: new Date().toISOString(),
        status: 'pending',
        customer_number: 1
      };

      // Prepare array of requests to insert
      const requestsToInsert = [voucherRequestData];

      // Add second customer if included
      if (includeSecondCustomer) {
        const secondCustomerRequestData = {
          partner_user_id: user.id,
          partner_email: user.email,
          partner_name: user.user_metadata?.name || user.email,
          partner_company: user.user_metadata?.companyName || '',
          customer_company: formData.customerCompanyName,
          sfdc_opportunity_id: formData.sfdcOpportunityId,
          country: formData.country,
          customer_type: formData.existingNxCustomer,
          completed_learning_paths: formData.completedLearningPaths,
          candidate_first_name: secondCustomer.firstName,
          candidate_last_name: secondCustomer.lastName,
          customer_email: secondCustomer.companyEmail,
          certification_exam: secondCustomer.certificationExam,
          request_date: new Date().toISOString(),
          status: 'pending',
          customer_number: 2
        };
        requestsToInsert.push(secondCustomerRequestData);
      }

      // Insert voucher request(s) into Supabase
      const { error: insertError } = await supabase
        .from('nx_voucher_requests')
        .insert(requestsToInsert);

      if (insertError) throw insertError;

      // Show success message
      setSuccess(true);
      setError('');

      // Clear form
      setFormData({
        customerCompanyName: '',
        sfdcOpportunityId: '',
        country: 'Indonesia',
        existingNxCustomer: 'New',
        completedLearningPaths: 'No',
        firstName: '',
        lastName: '',
        companyEmail: '',
        certificationExam: 'NX Design Associate'
      });
      setSecondCustomer({
        firstName: '',
        lastName: '',
        companyEmail: '',
        certificationExam: 'NX Design Associate'
      });
      setIncludeSecondCustomer(false);

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/landing');
      }, 3000);

    } catch (error) {
      console.error('Voucher request error:', error);
      setError(error.message || 'Failed to submit voucher request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLanding = () => {
    navigate('/landing');
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
        <div className="neumo-card max-w-md w-full text-center">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <span className="text-6xl">✅</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Voucher Request Submitted Successfully!
          </h1>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            Your NX Certification voucher request{includeSecondCustomer ? 's have' : ' has'} been submitted{includeSecondCustomer ? ` for both customers` : ''}. Our team will review your request{includeSecondCustomer ? 's' : ''} and contact you soon.
          </p>
          <button
            onClick={handleBackToLanding}
            className="neumo-button primary w-full py-4 text-lg"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🏠</span>
              <span>Return to Landing Page</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="relative">
          {/* Back to Home Button - Top Right */}
          <div className="absolute top-0 right-0 z-10">
            <button
              onClick={handleBackToLanding}
              className="neumo-button secondary px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-300 transition-colors"
            >
              <span>🏠</span>
              <span>Back to Home</span>
            </button>
          </div>

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
              NX Credly Certification Program
            </h1>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              Manage your NX certification voucher requests
            </p>
          </div>
        </div>

        {/* User Info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 neumo-card">
          <div className="text-sm text-gray-700 text-center">
            {userInfo.company && (
              <div className="font-semibold text-blue-800 mb-1">
                {userInfo.company}
              </div>
            )}
            <div className="font-medium">
              Partner: {userInfo.fullName || userInfo.name}
            </div>
            <div className="text-xs text-gray-600">{userInfo.email}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={() => setActiveTab('request')}
              className={`flex-1 py-4 px-6 rounded-lg transition-all duration-300 ${
                activeTab === 'request'
                  ? 'bg-blue-600 text-white shadow-lg neumo-button-active'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 neumo-button'
              }`}
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-xl">📝</span>
                <div>
                  <div className="font-medium">Customer Voucher Request</div>
                  <div className="text-xs opacity-90">Submit new voucher requests</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 py-4 px-6 rounded-lg transition-all duration-300 ${
                activeTab === 'report'
                  ? 'bg-green-600 text-white shadow-lg neumo-button-active'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 neumo-button'
              }`}
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-xl">📊</span>
                <div>
                  <div className="font-medium">Voucher Request Report</div>
                  <div className="text-xs opacity-90">View status of all requests</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="neumo-card">
          {activeTab === 'request' ? (
            <div className="p-6">
              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  <span className="text-sm">{error}</span>
                </div>
              )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">🏢</span>
              Customer Company Name
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              name="customerCompanyName"
              value={formData.customerCompanyName}
              onChange={handleInputChange}
              placeholder="Enter customer company name"
              className="neumo-input w-full text-base py-4"
              required
            />
          </div>

          {/* SFDC Opportunity ID */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">🆔</span>
              SFDC Opportunity ID # <span className="text-gray-500 text-sm ml-1">(Optional)</span>
            </label>
            <input
              type="text"
              name="sfdcOpportunityId"
              value={formData.sfdcOpportunityId}
              onChange={handleInputChange}
              placeholder="Enter SFDC Opportunity ID (Optional)"
              className="neumo-input w-full text-base py-4"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">🌏</span>
              Country
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className="neumo-select w-full text-base py-4"
              required
            >
              <option value="Indonesia">Indonesia</option>
              <option value="Malaysia">Malaysia</option>
              <option value="Philippines">Philippines</option>
              <option value="Singapore">Singapore</option>
              <option value="Thailand">Thailand</option>
              <option value="Vietnam">Vietnam</option>
            </select>
          </div>

          {/* Customer Type */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
              <span className="mr-2">❓</span>
              Customer Type
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              name="existingNxCustomer"
              value={formData.existingNxCustomer}
              onChange={handleInputChange}
              className="neumo-select w-full text-base py-4"
              required
            >
              <option value="New">New</option>
              <option value="Existing">Existing</option>
            </select>
          </div>

          {/* NX Learning Paths - Only show for new customers */}
          {formData.existingNxCustomer === 'New' && (
            <div className="neumo-card p-4 border-l-4 border-orange-400 bg-orange-50">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">📚</span>
                  Has New NX Customer completed NX Learning Paths in LaaS?
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="completedLearningPaths"
                  value={formData.completedLearningPaths}
                  onChange={handleInputChange}
                  className="neumo-select w-full text-base py-4"
                  required={formData.existingNxCustomer === 'New'}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              {formData.completedLearningPaths === 'No' && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  <div className="flex items-start">
                    <span className="mr-2 text-red-500">⚠️</span>
                    <div>
                      <p className="text-sm font-medium mb-1">Learning Paths Required</p>
                      <p className="text-xs leading-relaxed">
                        New NX customers must complete NX Learning Paths in LaaS before certification vouchers can be requested.
                        Please ensure the customer completes the required learning paths first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {formData.completedLearningPaths === 'Yes' && (
                <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                  <div className="flex items-center">
                    <span className="mr-2 text-green-500">✅</span>
                    <p className="text-sm">Learning paths completed. Voucher request can proceed.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Candidate 1 Section */}
          <div className="neumo-card p-6 bg-green-50 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">👤</span>
              Candidate 1 Details
            </h3>

            {/* Candidate 1 Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">👤</span>
                  First Name
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  className="neumo-input w-full text-base py-4"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">👤</span>
                  Last Name
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  className="neumo-input w-full text-base py-4"
                  required
                />
              </div>
            </div>

            {/* Candidate 1 Company Email Address */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                <span className="mr-2">📧</span>
                Company Email Address
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="email"
                name="companyEmail"
                value={formData.companyEmail}
                onChange={handleInputChange}
                placeholder="Enter company email address"
                className="neumo-input w-full text-base py-4"
                required
              />
            </div>

            {/* Candidate 1 Certification Exam */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                <span className="mr-2">🎓</span>
                Certification Exam
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                name="certificationExam"
                value={formData.certificationExam}
                onChange={handleInputChange}
                className="neumo-select w-full text-base py-4"
                required
              >
                <option value="NX Design Associate">NX Design Associate</option>
                <option value="NX Design Professional">NX Design Professional</option>
                <option value="NX CAM Associate">NX CAM Associate</option>
                <option value="NX CAM Professional">NX CAM Professional</option>
              </select>
            </div>
          </div>

          {/* Add Candidate 2 Option */}
          <div className="neumo-card p-4 border-l-4 border-blue-400">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="includeSecondCustomer"
                checked={includeSecondCustomer}
                onChange={handleIncludeSecondCustomerChange}
                className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="includeSecondCustomer" className="flex items-center text-sm font-medium text-gray-800">
                <span className="mr-2">👥</span>
                Add Candidate 2 from the same company (Max: 2 candidates per company)
              </label>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Request vouchers for two employees from the same company. Both candidates will share the same company details but can have different certification exams.
            </p>
          </div>

          {/* Candidate 2 Section - Only show when checkbox is checked */}
          {includeSecondCustomer && (
            <div className="neumo-card p-6 bg-green-50 border border-green-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">👤</span>
                Candidate 2 Details
              </h3>

              {/* Candidate 2 Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">👤</span>
                    First Name
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={secondCustomer.firstName}
                    onChange={handleSecondCustomerChange}
                    placeholder="Enter first name"
                    className="neumo-input w-full text-base py-4"
                    required={includeSecondCustomer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">👤</span>
                    Last Name
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={secondCustomer.lastName}
                    onChange={handleSecondCustomerChange}
                    placeholder="Enter last name"
                    className="neumo-input w-full text-base py-4"
                    required={includeSecondCustomer}
                  />
                </div>
              </div>

              {/* Candidate 2 Company Email Address */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">📧</span>
                  Company Email Address
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="email"
                  name="companyEmail"
                  value={secondCustomer.companyEmail}
                  onChange={handleSecondCustomerChange}
                  placeholder="Enter company email address"
                  className="neumo-input w-full text-base py-4"
                  required={includeSecondCustomer}
                />
              </div>

              {/* Candidate 2 Certification Exam */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">🎓</span>
                  Certification Exam
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="certificationExam"
                  value={secondCustomer.certificationExam}
                  onChange={handleSecondCustomerChange}
                  className="neumo-select w-full text-base py-4"
                  required={includeSecondCustomer}
                >
                  <option value="NX Design Associate">NX Design Associate</option>
                  <option value="NX Design Professional">NX Design Professional</option>
                  <option value="NX CAM Associate">NX CAM Associate</option>
                  <option value="NX CAM Professional">NX CAM Professional</option>
                </select>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={loading}
              className="neumo-button primary w-full md:w-auto px-8 py-5 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="neumo-spinner mr-3"></div>
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span>🎟️</span>
                  <span>Submit Request</span>
                </div>
              )}
            </button>
          </div>
        </form>
            </div>
          ) : (
            <div className="p-6">
              <PartnerVoucherReport partnerEmail={userInfo.email} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NXVoucherRequest;