import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { pastorAPI } from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const PastorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [leaderMetrics, setLeaderMetrics] = useState([]);
  const [atRiskMembers, setAtRiskMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAllData();
  }, [dateRange]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, trendsRes, leadersRes, atRiskRes] = await Promise.all([
        pastorAPI.getDashboardStats(dateRange),
        pastorAPI.getTrends(dateRange),
        pastorAPI.getLeaderMetrics(dateRange),
        pastorAPI.getAtRiskMembers()
      ]);
      setStats(statsRes.data);
      setTrends(trendsRes.data);
      setLeaderMetrics(leadersRes.data);
      setAtRiskMembers(atRiskRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    pastorAPI.exportAttendance(dateRange);
  };

  const exportPDF = () => {
    if (!stats) return;
    const doc = new jsPDF();
    doc.setFont("helvetica");
    
    // Title
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text("Church Attendance Report", 14, 22);
    
    // Date Range
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 30);
    
    // Summary Stats
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Summary Overview", 14, 45);
    
    const avgAttendance = stats.overallAttendance?.length > 0
      ? Math.round(stats.overallAttendance.reduce((sum, d) => sum + (d.present_count / d.total_members) * 100, 0) / stats.overallAttendance.length) + '%'
      : 'N/A';
      
    doc.autoTable({
      startY: 50,
      head: [['Latest Date', 'Avg Attendance', 'Submission Rate', 'At-Risk Members']],
      body: [[
        stats.latestDate || 'N/A',
        avgAttendance,
        `${stats.completion?.rate || 0}%`,
        atRiskMembers.length
      ]],
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] } // Primary 600
    });
    
    // Leader Performance
    let finalY = doc.lastAutoTable.finalY || 50;
    doc.setFontSize(14);
    doc.text("Leader Performance", 14, finalY + 15);
    
    const leaderData = leaderMetrics.map(l => [
      l.leader_name,
      l.section_name,
      l.reporting_days,
      l.total_records,
      l.total_present,
      `${l.attendance_rate}%`
    ]);
    
    doc.autoTable({
      startY: finalY + 20,
      head: [['Leader', 'Section', 'Reporting Days', 'Total Records', 'Present', 'Rate']],
      body: leaderData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] }
    });
    
    // At-Risk
    finalY = doc.lastAutoTable.finalY + 15;
    if (atRiskMembers.length > 0) {
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38);
      doc.text("At-Risk Members (3+ absences)", 14, finalY);
      
      const riskData = atRiskMembers.map(m => [
        m.membership_id,
        m.full_name,
        m.section_name,
        m.leader_name,
        m.absence_count
      ]);
      
      doc.autoTable({
        startY: finalY + 5,
        head: [['ID', 'Name', 'Section', 'Leader', 'Absences']],
        body: riskData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] } // Red 600
      });
    }
    
    doc.save(`Attendance_Report_${dateRange.start}_to_${dateRange.end}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pastor Dashboard</h2>
          <p className="text-gray-600">Overview of attendance and engagement</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100">
            <label className="text-sm font-medium text-gray-600">From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="border-none bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100">
            <label className="text-sm font-medium text-gray-600">To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="border-none bg-transparent outline-none text-sm"
            />
          </div>
          <button
            onClick={exportPDF}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            <span>📄</span>
            <span>PDF Report</span>
          </button>
          <button
            onClick={exportData}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            <span>📊</span>
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
          <div className="group relative overflow-hidden bg-gradient-to-br from-primary-600 to-indigo-800 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-400 transform hover:-translate-y-2 text-white">
            <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative z-10">
              <h3 className="text-primary-200 text-xs font-bold uppercase tracking-widest mb-4">Latest Date</h3>
              <p className="text-3xl font-black tracking-tight">{stats.latestDate || 'N/A'}</p>
            </div>
          </div>
          
          <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-700 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-400 transform hover:-translate-y-2 text-white">
            <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative z-10">
              <h3 className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-4">Avg Attendance</h3>
              <p className="text-5xl font-black tracking-tighter drop-shadow-md">
                {stats.overallAttendance?.length > 0
                  ? Math.round(
                      stats.overallAttendance.reduce((sum, d) => sum + (d.present_count / d.total_members) * 100, 0) /
                      stats.overallAttendance.length
                    ) + '%'
                  : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-400 transform hover:-translate-y-2 text-white">
            <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative z-10">
               <h3 className="text-amber-100 text-xs font-bold uppercase tracking-widest mb-2">Submission Rate</h3>
               <p className="text-5xl font-black tracking-tighter drop-shadow-md">
                 {stats.completion?.rate}%
               </p>
               <div className="mt-3 flex items-center">
                 <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                   {stats.completion?.leadersSubmitted}/{stats.completion?.totalLeaders} leaders
                 </span>
               </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-700 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-400 transform hover:-translate-y-2 text-white">
            <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative z-10">
              <h3 className="text-red-200 text-xs font-bold uppercase tracking-widest mb-4">At-Risk Members</h3>
              <p className="text-5xl font-black tracking-tighter drop-shadow-md">{atRiskMembers.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {/* Attendance Trend Chart */}
        <div className="glass-panel rounded-3xl p-8 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center">
             <span className="text-3xl mr-3">📈</span> Attendance Trends
          </h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="attendance_rate" stroke="#7c3aed" strokeWidth={4} activeDot={{ r: 8 }} name="Attendance %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-gray-500 font-bold">No trend data available</p>
             </div>
          )}
        </div>

        {/* Latest Section Performance */}
        <div className="glass-panel rounded-3xl p-8 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center">
             <span className="text-3xl mr-3">📊</span> Section Performance
          </h3>
          {stats?.sectionBreakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stats.sectionBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="section_name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip 
                   cursor={{fill: '#f3f4f6'}}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="attendance_rate" fill="#10b981" radius={[6, 6, 0, 0]} name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-gray-500 font-bold">No breakdown data available</p>
             </div>
          )}
        </div>
      </div>

      {/* Leader Metrics Table */}
      <div className="glass-panel rounded-3xl border border-gray-100 p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
           <span className="text-3xl mr-3">👑</span> Leader Performance Ranking
        </h3>
        {leaderMetrics.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leader</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Section</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reporting Days</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Records</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Present Count</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaderMetrics.map((leader, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{leader.leader_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.section_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.reporting_days}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.total_records}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.total_present}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-bold ${leader.attendance_rate >= 90 ? 'text-green-600' : leader.attendance_rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {leader.attendance_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No metrics available</p>
        )}
      </div>

      {/* At-Risk Members */}
      <div className="bg-gradient-to-br from-red-50 to-white rounded-3xl shadow-soft border border-red-100 p-8 mt-8">
        <h3 className="text-xl font-black mb-6 text-red-700 flex items-center">
           <span className="text-3xl mr-3 animate-pulse">⚠️</span> At-Risk Members (3+ absences)
        </h3>
        {atRiskMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membership ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absences (30 days)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {atRiskMembers.map((member, idx) => (
                  <tr key={idx} className="hover:bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap">{member.membership_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{member.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.section_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.leader_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-bold">
                        {member.absence_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No at-risk members in the last 30 days</p>
        )}
      </div>
    </div>
  );
};

export default PastorDashboard;
