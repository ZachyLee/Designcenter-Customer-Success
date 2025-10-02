import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PartnerVoucherReport = ({ partnerEmail }) => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState({});

  useEffect(() => {
    fetchUserAndReportData();

    // Set up real-time subscription for voucher requests
    const subscription = supabase
      .channel('partner_voucher_report')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nx_voucher_requests'
        },
        () => {
          fetchReportData(); // Refresh data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partnerEmail]);

  const fetchUserAndReportData = async () => {
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserInfo({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email,
        company: user.user_metadata?.companyName || ''
      });

      // Fetch report data for this partner using email
      await fetchReportData();
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch all voucher requests for this partner using email
      const { data, error } = await supabase
        .from('nx_voucher_requests')
        .select('*')
        .eq('partner_email', partnerEmail)
        .order('request_date', { ascending: false });

      if (error) throw error;

      // Group by customer company and aggregate data
      const companyGroups = {};

      data.forEach(request => {
        const companyKey = request.customer_company;

        if (!companyGroups[companyKey]) {
          companyGroups[companyKey] = {
            customerCompanyName: request.customer_company,
            country: request.country,
            sfdcOpportunityId: request.sfdc_opportunity_id || 'N/A',
            existingNxCustomer: request.customer_type,
            requests: [],
            totalVouchers: 0,
            pendingVouchers: 0,
            approvedVouchers: 0,
            rejectedVouchers: 0,
            issuedVouchers: 0,
            redeemedVouchers: 0,
            certifiedVouchers: 0,
            notCertifiedVouchers: 0,
            latestRequestDate: request.request_date
          };
        }

        // Add individual request details
        companyGroups[companyKey].requests.push({
          id: request.id,
          customerName: `${request.candidate_first_name} ${request.candidate_last_name}`,
          customerEmail: request.customer_email,
          certificationExam: request.certification_exam,
          status: request.status,
          requestDate: request.request_date,
          voucherCode: request.voucher_code || 'Pending',
          voucherCodeIssuedDate: request.issue_date,
          redemptionStatus: request.redemption_status || false,
          redemptionDate: request.redemption_date,
          certificationAchieved: request.certification_achieved || false,
          certificationAchievedDate: request.certified_date,
          customerNumber: request.customer_number || 1,
          rejectionReason: request.rejection_reason
        });

        // Update counters
        companyGroups[companyKey].totalVouchers++;

        switch (request.status) {
          case 'pending':
            companyGroups[companyKey].pendingVouchers++;
            break;
          case 'approved':
          case 'processed':
            companyGroups[companyKey].approvedVouchers++;
            break;
          case 'rejected':
            companyGroups[companyKey].rejectedVouchers++;
            break;
          case 'issued':
            companyGroups[companyKey].issuedVouchers++;
            break;
          case 'redeemed':
            companyGroups[companyKey].redeemedVouchers++;
            break;
        }

        // Count certifications achieved
        if (request.certification_achieved === true) {
          companyGroups[companyKey].certifiedVouchers++;
        } else if (request.certification_achieved === false && request.certified_date) {
          companyGroups[companyKey].notCertifiedVouchers++;
        }

        // Keep track of latest request date
        if (new Date(request.request_date) > new Date(companyGroups[companyKey].latestRequestDate)) {
          companyGroups[companyKey].latestRequestDate = request.request_date;
        }
      });

      // Convert to array and sort by latest request date
      const reportArray = Object.values(companyGroups).sort((a, b) =>
        new Date(b.latestRequestDate) - new Date(a.latestRequestDate)
      );

      setReportData(reportArray);
      setError('');
    } catch (error) {
      console.error('Error fetching report data:', error);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, certificationAchieved = false) => {
    // If certification is achieved, show special status
    if (certificationAchieved) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full border bg-purple-100 text-purple-800 border-purple-200">
          🏆 Certified
        </span>
      );
    }

    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      issued: 'bg-blue-100 text-blue-800 border-blue-200',
      processed: 'bg-blue-100 text-blue-800 border-blue-200',
      redeemed: 'bg-green-100 text-green-800 border-green-200'
    };

    const statusText = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      issued: 'Issued',
      processed: 'Processed',
      redeemed: 'Redeemed'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${badges[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {statusText[status] || status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const exportToPDF = async () => {
    try {
      setLoading(true);

      // Use production domain in production, localhost in development
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${apiUrl}/api/admin/export-partner-voucher-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerEmail: partnerEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `partner-voucher-report-${partnerEmail.replace('@', '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setError('Failed to export PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="neumo-card p-6">
        <div className="flex items-center justify-center">
          <div className="neumo-spinner mr-3"></div>
          <span className="text-gray-600">Loading your voucher report...</span>
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

  return (
    <div className="neumo-card p-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <span className="mr-2">📋</span>
            Your Voucher Request Report
          </h3>
          <button
            onClick={exportToPDF}
            disabled={loading || reportData.length === 0}
            className="neumo-button-sm px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <span className="mr-2">📄</span>
            Export to PDF
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Track all your submitted voucher requests and their current status
        </p>
      </div>

      {/* Summary Stats */}
      {reportData.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* First Row: Total Requests, Pending, Rejected */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neumo-card p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {reportData.reduce((sum, company) => sum + company.totalVouchers, 0)}
              </div>
              <div className="text-xs text-gray-600">Total Requests</div>
            </div>
            <div className="neumo-card p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {reportData.reduce((sum, company) => sum + company.pendingVouchers, 0)}
              </div>
              <div className="text-xs text-gray-600">Pending</div>
            </div>
            <div className="neumo-card p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {reportData.reduce((sum, company) => sum + company.rejectedVouchers, 0)}
              </div>
              <div className="text-xs text-gray-600">Rejected</div>
            </div>
          </div>

          {/* Second Row: Approved, Certifications Achieved, Certifications Not Achieved */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neumo-card p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {reportData.reduce((sum, company) => sum + company.approvedVouchers + company.issuedVouchers + company.redeemedVouchers, 0)}
              </div>
              <div className="text-xs text-gray-600">Approved</div>
            </div>
            <div className="neumo-card p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {reportData.reduce((sum, company) => sum + company.certifiedVouchers, 0)}
              </div>
              <div className="text-xs text-gray-600">Certifications Achieved</div>
            </div>
            <div className="neumo-card p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {reportData.reduce((sum, company) => sum + company.notCertifiedVouchers, 0)}
              </div>
              <div className="text-xs text-gray-600">Certifications Not Achieved</div>
            </div>
          </div>
        </div>
      )}

      {/* Report Data */}
      {reportData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <span className="text-4xl mb-4 block">📋</span>
          <p>No voucher requests found. Start by submitting your first request!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportData.map((company, index) => (
            <div key={index} className="neumo-card p-4 border-l-4 border-blue-400">
              {/* Company Header */}
              <div className="mb-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-gray-800">
                    {company.customerCompanyName}
                  </h4>
                  <div className="text-sm text-gray-500">
                    Latest: {formatDate(company.latestRequestDate)}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Country:</span> {company.country}
                  </div>
                  <div>
                    <span className="font-medium">SFDC ID:</span> {company.sfdcOpportunityId}
                  </div>
                  <div>
                    <span className="font-medium">Customer Type:</span> {company.existingNxCustomer}
                  </div>
                </div>
              </div>

              {/* Voucher Summary */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    Total Vouchers: {company.totalVouchers}
                  </span>
                  <div className="flex space-x-4">
                    {company.pendingVouchers > 0 && (
                      <span className="text-yellow-600">
                        {company.pendingVouchers} Pending
                      </span>
                    )}
                    {(company.approvedVouchers + company.issuedVouchers + company.redeemedVouchers) > 0 && (
                      <span className="text-green-600">
                        {company.approvedVouchers + company.issuedVouchers + company.redeemedVouchers} Approved
                      </span>
                    )}
                    {company.certifiedVouchers > 0 && (
                      <span className="text-green-600">
                        {company.certifiedVouchers} Achieved
                      </span>
                    )}
                    {company.notCertifiedVouchers > 0 && (
                      <span className="text-orange-600">
                        {company.notCertifiedVouchers} Not Achieved
                      </span>
                    )}
                    {company.rejectedVouchers > 0 && (
                      <span className="text-red-600">
                        {company.rejectedVouchers} Rejected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual Requests */}
              <div className="space-y-2">
                {company.requests.map((request, reqIndex) => (
                  <div key={reqIndex} className="p-3 bg-white rounded-lg border border-gray-200">
                    {/* Compact Top Row - Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      {/* Candidate Info */}
                      <div>
                        <div className="font-medium text-gray-800 text-sm">
                          {request.customerName}
                        </div>
                        <div className="text-xs text-gray-600">
                          {request.customerEmail}
                        </div>
                        <div className="text-xs text-gray-500">
                          Candidate {request.customerNumber}
                        </div>
                      </div>

                      {/* Certification */}
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          {request.certificationExam}
                        </div>
                        <div className="text-xs text-gray-500">
                          Requested: {formatDate(request.requestDate)}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-center">
                        {getStatusBadge(request.status, request.certificationAchieved)}
                      </div>

                      {/* Rejection Reason (if rejected) */}
                      <div className="flex items-center justify-end">
                        {request.status === 'rejected' && request.rejectionReason && (
                          <div className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200">
                            <div className="font-medium">Rejection Reason:</div>
                            <div>{request.rejectionReason}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Compact Progress Tracking Row - Only show if not rejected */}
                    {request.status !== 'rejected' && (
                      <div className="border-t border-gray-100 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Voucher Code Section */}
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                              🎟️ Voucher Code
                            </div>
                            <div className={`text-sm font-medium ${request.voucherCode === 'Pending' ? 'text-gray-500' : 'text-blue-600'}`}>
                              {request.voucherCode}
                            </div>
                            {request.voucherCodeIssuedDate && (
                              <div className="text-xs text-gray-500">
                                Issued: {formatDate(request.voucherCodeIssuedDate)}
                              </div>
                            )}
                          </div>

                          {/* Redemption Status */}
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                              💰 Redemption Status
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                                request.redemptionStatus
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {request.redemptionStatus ? '✅ Yes' : '❌ No'}
                              </span>
                            </div>
                            {request.redemptionDate && (
                              <div className="text-xs text-gray-500">
                                Redeemed: {formatDate(request.redemptionDate)}
                              </div>
                            )}
                          </div>

                          {/* Certification Achieved */}
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                              🏆 Certification Achieved
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                                request.certificationAchieved
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {request.certificationAchieved ? '🎓 Yes' : '⏳ No'}
                              </span>
                            </div>
                            {request.certificationAchievedDate && (
                              <div className="text-xs text-gray-500">
                                {request.certificationAchieved ? 'Achieved' : 'Not Achieved'}: {formatDate(request.certificationAchievedDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>Progress</span>
                        <span>
                          {request.certificationAchievedDate ? '100%' :
                           request.redemptionStatus ? '66%' :
                           request.voucherCode !== 'Pending' ? '33%' : '0%'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            request.certificationAchieved ? 'bg-green-500' :
                            request.certificationAchievedDate && !request.certificationAchieved ? 'bg-red-500' :
                            request.redemptionStatus ? 'bg-blue-500' :
                            request.voucherCode !== 'Pending' ? 'bg-yellow-500' : 'bg-gray-300'
                          }`}
                          style={{
                            width: request.certificationAchievedDate ? '100%' :
                                   request.redemptionStatus ? '66%' :
                                   request.voucherCode !== 'Pending' ? '33%' : '10%'
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Requested</span>
                        <span>Code Issued</span>
                        <span>Redeemed</span>
                        <span>Completed</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-center">
        <div className="text-xs text-gray-500">
          Report updates automatically • Voucher codes will be provided by admin team
        </div>
      </div>
    </div>
  );
};

export default PartnerVoucherReport;