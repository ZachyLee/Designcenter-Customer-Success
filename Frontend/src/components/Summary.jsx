import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const Summary = () => {
  const { responseId } = useParams();
  const navigate = useNavigate();
  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchResponseData();
  }, [responseId]);

  const fetchResponseData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/responses/${responseId}`);
      setResponseData(response.data.data);
    } catch (error) {
      console.error('Error fetching response data:', error);
      setError('Failed to load response data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await axios.get(`/api/responses/${responseId}/pdf`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `checklist-report-${responseId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getAnswerStats = () => {
    if (!responseData?.answers) return { yes: 0, no: 0, na: 0 };
    
    return responseData.answers.reduce((stats, answer) => {
      if (answer.answer === 'Yes') stats.yes++;
      else if (answer.answer === 'No') stats.no++;
      else if (answer.answer === 'N/A') stats.na++;
      return stats;
    }, { yes: 0, no: 0, na: 0 });
  };

  const groupAnswersByArea = () => {
    if (!responseData?.answers) return {};
    
    return responseData.answers.reduce((groups, answer) => {
      const area = answer.area || 'Other';
      if (!groups[area]) groups[area] = [];
      groups[area].push(answer);
      return groups;
    }, {});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neumo-card text-center">
          <div className="neumo-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !responseData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="neumo-card max-w-md text-center">
          <div className="neumo-alert error mb-4">
            <p>{error || 'Response not found'}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="neumo-button primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { response, answers } = responseData;
  const language = response.language;
  const stats = getAnswerStats();
  const groupedAnswers = groupAnswersByArea();
  const total = stats.yes + stats.no + stats.na;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="neumo-card mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {language === 'EN' ? 'Assessment Summary' : 'Ringkasan Penilaian'}
              </h1>
              <div className="text-gray-600">
                <p><strong>{language === 'EN' ? 'Email:' : 'Email:'}</strong> {response.email}</p>
                <p><strong>{language === 'EN' ? 'Language:' : 'Bahasa:'}</strong> {language === 'EN' ? 'English' : 'Bahasa Indonesia'}</p>
                <p><strong>{language === 'EN' ? 'Date:' : 'Tanggal:'}</strong> {new Date(response.timestamp).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="neumo-button success disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <div className="flex items-center">
                    <div className="neumo-spinner mr-2"></div>
                    {language === 'EN' ? 'Downloading...' : 'Mengunduh...'}
                  </div>
                ) : (
                  language === 'EN' ? 'Download PDF' : 'Unduh PDF'
                )}
              </button>
              <button
                onClick={() => navigate('/')}
                className="neumo-button"
              >
                {language === 'EN' ? 'New Assessment' : 'Penilaian Baru'}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="neumo-card mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {language === 'EN' ? 'Results Overview' : 'Ikhtisar Hasil'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-4 bg-green-50 rounded-2xl">
              <div className="text-2xl font-bold text-green-600">{stats.yes}</div>
              <div className="text-sm text-green-700">
                {language === 'EN' ? 'Yes' : 'Ya'} ({total ? Math.round(stats.yes/total*100) : 0}%)
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-2xl">
              <div className="text-2xl font-bold text-red-600">{stats.no}</div>
              <div className="text-sm text-red-700">
                {language === 'EN' ? 'No' : 'Tidak'} ({total ? Math.round(stats.no/total*100) : 0}%)
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-2xl">
              <div className="text-2xl font-bold text-gray-600">{stats.na}</div>
              <div className="text-sm text-gray-700">
                N/A ({total ? Math.round(stats.na/total*100) : 0}%)
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-2xl">
              <div className="text-2xl font-bold text-blue-600">{total}</div>
              <div className="text-sm text-blue-700">
                {language === 'EN' ? 'Total Questions' : 'Total Pertanyaan'}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex text-xs text-gray-600 mb-1">
              <span>{language === 'EN' ? 'Completion Rate' : 'Tingkat Penyelesaian'}</span>
              <span className="ml-auto">100%</span>
            </div>
            <div className="neumo-progress">
              <div className="neumo-progress-bar" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        {/* Detailed Results by Area */}
        <div className="space-y-6">
          {Object.entries(groupedAnswers).map(([area, areaAnswers]) => (
            <div key={area} className="neumo-card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{area}</h3>
              
              <div className="space-y-4">
                {areaAnswers.map((answer, index) => (
                  <div key={answer.id || index} className="border-l-4 border-gray-200 pl-4">
                    <div className="mb-2">
                      <h4 className="font-medium text-gray-800">{answer.activity}</h4>
                      <p className="text-sm text-gray-600 mt-1">{answer.criteria}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">
                          {language === 'EN' ? 'Answer:' : 'Jawaban:'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          answer.answer === 'Yes' 
                            ? 'bg-green-100 text-green-800' 
                            : answer.answer === 'No'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {answer.answer === 'Yes' 
                            ? (language === 'EN' ? 'Yes' : 'Ya')
                            : answer.answer === 'No'
                            ? (language === 'EN' ? 'No' : 'Tidak')
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {answer.remarks && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500 mb-1">
                          {language === 'EN' ? 'Remarks:' : 'Keterangan:'}
                        </p>
                        <p className="text-sm text-gray-700">{answer.remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="neumo-card mt-6">
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="neumo-button success disabled:opacity-50"
            >
              {downloadingPdf ? (
                <div className="flex items-center">
                  <div className="neumo-spinner mr-2"></div>
                  {language === 'EN' ? 'Downloading...' : 'Mengunduh...'}
                </div>
              ) : (
                language === 'EN' ? 'Download PDF Report' : 'Unduh Laporan PDF'
              )}
            </button>
            <button
              onClick={() => navigate('/')}
              className="neumo-button"
            >
              {language === 'EN' ? 'Take Another Assessment' : 'Ambil Penilaian Lain'}
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            {language === 'EN' 
              ? 'This assessment was completed using the Solid Edge Success Criteria Checklist tool.'
              : 'Penilaian ini diselesaikan menggunakan alat Solid Edge Success Criteria Checklist.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Summary;