import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const ChartView = ({ type, data, title, language = 'EN' }) => {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 20,
        },
      },
      title: {
        display: true,
        text: title,
        padding: 20,
      },
    },
    layout: {
      padding: 10,
    },
  };

  const pieOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          usePointStyle: true,
        },
      },
    },
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  if (type === 'bar') {
    return (
      <div className="neumo-chart-container">
        <Bar data={data} options={barOptions} />
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <div className="neumo-chart-container">
        <Pie data={data} options={pieOptions} />
      </div>
    );
  }

  return null;
};

// Helper function to generate chart data for question statistics
export const generateQuestionStatsData = (questionStats, language = 'EN') => {
  const labels = questionStats.map(stat => 
    `${stat.area} - ${stat.activity.substring(0, 30)}...`
  );
  
  return {
    labels,
    datasets: [
      {
        label: language === 'EN' ? 'Yes' : 'Ya',
        data: questionStats.map(stat => stat.yesCount || 0),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: language === 'EN' ? 'No' : 'Tidak',
        data: questionStats.map(stat => stat.noCount || 0),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'N/A',
        data: questionStats.map(stat => stat.naCount || 0),
        backgroundColor: 'rgba(156, 163, 175, 0.8)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 1,
      },
    ],
  };
};

// Helper function to generate pie chart data for overall statistics
export const generateOverallStatsData = (stats, language = 'EN') => {
  return {
    labels: [
      language === 'EN' ? 'Yes' : 'Ya',
      language === 'EN' ? 'No' : 'Tidak',
      'N/A'
    ],
    datasets: [
      {
        data: [stats.yes || 0, stats.no || 0, stats.na || 0],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(156, 163, 175, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };
};

// Helper function to generate area-wise statistics
export const generateAreaStatsData = (questionStats, language = 'EN') => {
  const areaStats = {};
  
  questionStats.forEach(stat => {
    if (!areaStats[stat.area]) {
      areaStats[stat.area] = { yes: 0, no: 0, na: 0 };
    }
    areaStats[stat.area].yes += stat.yesCount || 0;
    areaStats[stat.area].no += stat.noCount || 0;
    areaStats[stat.area].na += stat.naCount || 0;
  });

  const labels = Object.keys(areaStats);
  
  return {
    labels,
    datasets: [
      {
        label: language === 'EN' ? 'Yes' : 'Ya',
        data: labels.map(area => areaStats[area].yes),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: language === 'EN' ? 'No' : 'Tidak',
        data: labels.map(area => areaStats[area].no),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'N/A',
        data: labels.map(area => areaStats[area].na),
        backgroundColor: 'rgba(156, 163, 175, 0.8)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 1,
      },
    ],
  };
};

// Helper function to generate language distribution data
export const generateLanguageStatsData = (responsesByLang, language = 'EN') => {
  const engCount = responsesByLang.find(r => r.language === 'EN')?.count || 0;
  const idCount = responsesByLang.find(r => r.language === 'ID')?.count || 0;
  
  return {
    labels: ['English', 'Bahasa Indonesia'],
    datasets: [
      {
        data: [engCount, idCount],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };
};

export default ChartView;