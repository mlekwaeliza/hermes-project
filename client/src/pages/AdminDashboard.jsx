import React, { useState, useEffect } from 'react';
import { adminAPI, authAPI } from '../services/api';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MemberEditModal from '../components/MemberEditModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sections, setSections] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [members, setMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [message, setMessage] = useState('');
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const [profileName, setProfileName] = useState(user?.full_name || '');

  useEffect(() => {
    if (user?.full_name && profileName === '') {
      setProfileName(user.full_name);
    }
  }, [user]);

  useEffect(() => {
    if (location.hash === '#options') {
      setActiveTab('options');
    } else if (activeTab === 'options' && location.hash !== '#options') {
      setActiveTab('dashboard'); 
    }
  }, [location.hash]);

  // Aggregated Overview State
  const [filterType, setFilterType] = useState('weekly');
  const [filterValue, setFilterValue] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const start = new Date(year, 0, 1);
    const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.floor(diff / oneWeek) + 1;
    return `${year}-W${week.toString().padStart(2, '0')}`;
  });
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // History & Analytics State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [trends, setTrends] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Drill-down State
  const [drilldownData, setDrilldownData] = useState(null);

  // Rewards State
  const currentYear = new Date().getFullYear().toString();
  const [rewardsYear, setRewardsYear] = useState(currentYear);
  const [rewardsMode, setRewardsMode] = useState('year'); // 'year' | 'week'
  const [rewardsWeek, setRewardsWeek] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const start = new Date(year, 0, 1);
    const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.floor(diff / oneWeek) + 1;
    return `${year}-W${week.toString().padStart(2, '0')}`;
  });
  const [topMembers, setTopMembers] = useState(null);
  const [topLeaders, setTopLeaders] = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  // Member Modal State
  const [editingMember, setEditingMember] = useState(null);
  const [memberMode, setMemberMode] = useState('edit');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadData();
    loadLeaders();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance' && filterValue) loadOverview();
    if (activeTab === 'history' && history.length === 0) loadHistory();
    if (activeTab === 'analytics' && trends.length === 0) loadTrends();
    if (activeTab === 'rewards') loadRewards();
  }, [activeTab, filterType, filterValue]);

  useEffect(() => {
    if (activeTab === 'rewards') loadRewards();
  }, [rewardsYear, rewardsMode, rewardsWeek]);

  const loadData = async () => {
    try {
      const [sectionsRes, membersRes] = await Promise.all([
        adminAPI.getSections(),
        adminAPI.getMembers()
      ]);
      setSections(sectionsRes.data);
      setAllMembers(membersRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadLeaders = async () => {
    setLeadersLoading(true);
    try {
      const response = await adminAPI.getLeaders();
      setLeaders(response.data);
    } catch (error) {
      console.error('Failed to load leaders:', error);
    } finally {
      setLeadersLoading(false);
    }
  };

  const loadOverview = async () => {
    if (!filterValue) return;
    setOverviewLoading(true);
    try {
      const res = await adminAPI.getAggregatedOverview(filterType, filterValue);
      setOverviewData(res.data);
    } catch (error) {
      console.error('Failed to load overview:', error);
      setOverviewData(null);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await adminAPI.getHistory();
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTrends = async () => {
    setTrendsLoading(true);
    try {
      const res = await adminAPI.getAttendanceTrends(90);
      setTrends(res.data.trends || []);
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setTrendsLoading(false);
    }
  };

  const loadRewards = async () => {
    setRewardsLoading(true);
    setTopMembers(null);
    setTopLeaders(null);
    try {
      const week = rewardsMode === 'week' ? rewardsWeek : undefined;
      const [membersRes, leadersRes] = await Promise.all([
        adminAPI.getTopMembers(rewardsYear, week),
        adminAPI.getTopLeaders(rewardsYear, week),
      ]);
      setTopMembers(membersRes.data);
      setTopLeaders(leadersRes.data);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setRewardsLoading(false);
    }
  };

  const handleResetPassword = async (leaderId) => {
    if (!window.confirm("Reset this leader's password? A new temporary password will be generated.")) {
      return;
    }
    try {
      const response = await adminAPI.resetLeaderPassword(leaderId);
      const tempPass = response.data.temp_password;
      alert(`New temporary password: ${tempPass}\n\nPlease share this with the leader. They will be prompted to change it on first login.`);
      setMessage('Password reset successfully');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      alert(`Failed to reset password: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await adminAPI.uploadCSV(file);
      setUploadResult(result.data);
      loadData();
      loadLeaders();
      setMessage('CSV Uploaded Successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      alert(`Upload failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Drilldown Action ---
  const openLeaderDashboard = async (leaderId) => {
    setDrilldownData({ loading: true });
    try {
      const res = await adminAPI.getLeaderDashboard(leaderId);
      setDrilldownData({ loading: false, data: res.data });
    } catch (error) {
      alert('Failed to launch leader analytics');
      setDrilldownData(null);
    }
  };

  // --- Member CRUD Actions ---
  const handleEditClick = (member) => {
    setEditingMember(member);
    setMemberMode('edit');
    setIsModalOpen(true);
  };
  const handleAddClick = () => {
    setEditingMember(null);
    setMemberMode('add');
    setIsModalOpen(true);
  };
  const handleSaveMember = async (memberId, updatedData) => {
    try {
      if (memberMode === 'edit') {
        await adminAPI.updateMember(memberId, updatedData);
        setMessage('Member updated successfully');
      } else {
        await adminAPI.createMember(updatedData);
        setMessage('Member added successfully');
      }
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      alert(`Failed to save member: ${error.response?.data?.error || error.message}`);
      throw error;
    }
  };
  const handleDeleteClick = (member) => {
    setDeletingMember(member);
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    setDeleteLoading(true);
    try {
      await adminAPI.deleteMember(deletingMember.id);
      loadData();
      setMessage('Member deleted successfully');
      setTimeout(() => setMessage(''), 3000);
      setShowDeleteConfirm(false);
    } catch (error) {
      alert(`Failed to delete member: ${error.response?.data?.error || error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const triggerGlobalProfileUpload = () => {
    const globalInput = document.getElementById('profile-upload');
    if (globalInput) {
      globalInput.click();
    } else {
      alert('Global Profile Upload element missing!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-8 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Admin Dashboard</h2>
        </div>

        {/* Global Notifications */}
        {message && (
          <div className="mb-6 bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 flex items-center shadow-sm animate-fade-in">
            <span className="mr-3 text-xl">✓</span>
            <span className="font-bold">{message}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 bg-gray-100/60 p-2.5 rounded-2xl shadow-inner border border-gray-200/60">
          {[
            { id: 'dashboard', label: 'Overview', icon: '📊' },
            { id: 'members', label: 'Members Directory', icon: '👥' },
            { id: 'leaders', label: 'Leader Directory', icon: '👔' },
            { id: 'attendance', label: 'Attendance Reports', icon: '📝' },
            { id: 'history', label: 'Submission History', icon: '🕒' },
            { id: 'analytics', label: 'Graphs & Analytics', icon: '📈' },
            { id: 'rewards', label: 'Rewards Program', icon: '🏆' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                window.history.replaceState(null, '', '/admin');
              }}
              className={`flex items-center space-x-2 px-6 py-3 font-bold rounded-xl transition-all duration-300 transform ${
                activeTab === tab.id
                  ? tab.id === 'rewards'
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-md scale-[1.03] border border-yellow-300'
                    : 'bg-white text-primary-600 shadow-md scale-[1.03] border border-white'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-white/50 hover:shadow-sm'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* --- Dashboard Tab --- */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4 animate-fade-in">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-700 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-400 transform hover:-translate-y-2 text-white group">
              <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-blue-100 uppercase tracking-widest">Total Members</h3>
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><span className="text-3xl block transition-transform group-hover:scale-110">👥</span></div>
                </div>
                <div className="mt-8">
                  <p className="text-7xl font-black tracking-tighter drop-shadow-md">{allMembers.length}</p>
                </div>
              </div>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-primary-500 to-purple-700 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-400 transform hover:-translate-y-2 text-white group">
              <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-primary-100 uppercase tracking-widest">Total Sections</h3>
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><span className="text-3xl block transition-transform group-hover:scale-110">📑</span></div>
                </div>
                <div className="mt-8">
                  <p className="text-7xl font-black tracking-tighter drop-shadow-md">{sections.length}</p>
                </div>
              </div>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-400 transform hover:-translate-y-2 text-white group">
              <div className="absolute inset-0 pattern-bg opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-emerald-100 uppercase tracking-widest">Total Leaders</h3>
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><span className="text-3xl block transition-transform group-hover:scale-110">👔</span></div>
                </div>
                <div className="mt-8">
                  <p className="text-7xl font-black tracking-tighter drop-shadow-md">{leaders.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Manage Members Tab --- */}
        {activeTab === 'members' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Member Repository</h3>
              <div className="flex space-x-3">
                <button onClick={handleAddClick} className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-soft flex items-center space-x-2">
                  <span className="text-xl">+</span><span>Add Member</span>
                </button>
                <input
                  type="text"
                  placeholder="Search members by name, ID or section..."
                  className="border-2 border-gray-200 rounded-xl px-4 py-2.5 w-72 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  onChange={(e) => {
                    const term = e.target.value.toLowerCase();
                    const filtered = allMembers.filter(m =>
                      m.full_name?.toLowerCase().includes(term) ||
                      m.membership_id?.toLowerCase().includes(term) ||
                      m.section_name?.toLowerCase().includes(term)
                    );
                    setMembers(filtered);
                  }}
                />
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Section</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Leader</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {members.map(member => (
                    <tr key={member.id} className="hover:bg-primary-50/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{member.membership_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{member.full_name}</div>
                        <div className="text-xs text-gray-500">{member.gender || 'Unknown'} • {member.age_group || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{member.section_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{member.leader_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{member.phone || 'No phone'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex justify-center space-x-2">
                          <button onClick={() => handleEditClick(member)} className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-semibold">Edit</button>
                          <button onClick={() => handleDeleteClick(member)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors font-semibold">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium text-lg">No members found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- Leader Directory Tab --- */}
        {activeTab === 'leaders' && (
          <div className="animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Global Section Leaders</h3>
            {leadersLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leaders.map(leader => (
                  <div key={leader.id} className="bg-white border hover:border-indigo-300 rounded-3xl p-6 shadow-sm hover:shadow-glow transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-100 to-transparent rounded-bl-full opacity-50 z-0 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="text-3xl bg-indigo-50 w-12 h-12 flex items-center justify-center rounded-2xl shadow-inner border border-indigo-100">👔</div>
                        <div>
                          <h4 className="text-xl font-black text-gray-900">{leader.full_name}</h4>
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Section: {leader.section_name}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-grow">
                        <p className="flex items-center"><span className="w-6 text-lg">📱</span> <span className="font-medium">{leader.phone || 'No phone set'}</span></p>
                        <p className="flex items-center"><span className="w-6 text-lg">🔒</span> <span className="font-medium font-mono text-gray-500">@{leader.username}</span></p>
                      </div>

                      <button
                        onClick={() => openLeaderDashboard(leader.id)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
                      >
                        <span>View Analytics Dashboard</span>
                        <span>&rarr;</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Aggregated Attendance Reports Tab --- */}
        {activeTab === 'attendance' && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h3 className="text-2xl font-bold text-gray-900">Attendance Aggregation</h3>
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200">
                <div className="flex bg-white p-1 rounded-lg border shadow-sm">
                  {['weekly', 'monthly', 'yearly'].map(t => (
                    <button key={t} onClick={() => {
                        setFilterType(t);
                        setFilterValue('');
                    }} className={`px-4 py-1.5 rounded-md font-bold text-sm capitalize transition-all ${filterType === t ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <input 
                  type={filterType === 'yearly' ? 'number' : filterType === 'monthly' ? 'month' : 'week'} 
                  value={filterValue} 
                  onChange={e => setFilterValue(e.target.value)} 
                  min={filterType === 'yearly' ? "2020" : undefined} max={filterType === 'yearly' ? "2050" : undefined}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-primary-500" 
                  placeholder={filterType === 'yearly' ? 'YYYY' : ''}
                />
              </div>
            </div>

            {overviewLoading ? (
               <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
            ) : overviewData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-4 border shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase mb-1">Total Submissions</p><p className="text-2xl font-black">{overviewData.stats.total_submitted_leaders} Active Leaders</p></div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-emerald-800"><p className="text-xs font-bold uppercase mb-1">Total Present</p><p className="text-2xl font-black">{overviewData.stats.present}</p></div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-red-800"><p className="text-xs font-bold uppercase mb-1">Total Absent</p><p className="text-2xl font-black">{overviewData.stats.absent}</p></div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-amber-800"><p className="text-xs font-bold uppercase mb-1">Total Excused</p><p className="text-2xl font-black">{overviewData.stats.excused}</p></div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Leader</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Section</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Activity</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-emerald-600 uppercase">Total Present</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-red-600 uppercase">Total Absent</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-amber-600 uppercase">Total Excused</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {overviewData.subleaders.map(l => (
                        <tr key={l.leader_id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => openLeaderDashboard(l.leader_id)}>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="font-bold text-gray-900 group-hover:text-primary-600 decoration-2 group-hover:underline">{l.leader_name}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{l.section_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-mono text-gray-500">{l.submissions_count} Submissions</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-emerald-600 font-bold bg-emerald-50/20">{l.stats.present}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-red-600 font-bold bg-red-50/20">{l.stats.absent}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-amber-600 font-bold bg-amber-50/20">{l.stats.excused}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 font-bold">
                  Please select a {filterType} target.
                </div>
            )}
          </div>
        )}

        {/* --- Submission History Tab --- */}
        {activeTab === 'history' && (
          <div className="animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Global Submission Log</h3>
            {historyLoading ? (
              <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Service Date</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Leader</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Section</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Records</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Time of Submission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((log, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{log.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{log.leader_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-blue-600 font-medium">{log.section_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono">{log.records_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.submitted_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No submissions found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- Graphs & Analytics Tab --- */}
        {activeTab === 'analytics' && (
          <div className="animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Global Attendance Trends</h3>
            {trendsLoading ? (
              <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
            ) : (
              <div className="bg-white p-6 rounded-3xl border shadow-soft mb-8">
                <h4 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><span className="mr-2">📈</span> 90-Day View</h4>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Area type="monotone" dataKey="present_count" name="Present" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorPresent)" activeDot={{r: 6, strokeWidth: 0}} />
                      <Area type="monotone" dataKey="absent_count" name="Absent" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Rewards & Recognition Tab --- */}
        {activeTab === 'rewards' && (
          <div className="animate-fade-in space-y-8">

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">🏆 Rewards &amp; Recognition Program</h3>
                <p className="text-sm text-gray-500 mt-1">Rankings are computed from actual service days only — no penalties for cancelled events.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Year Selector */}
                <select
                  value={rewardsYear}
                  onChange={e => setRewardsYear(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  {[2023, 2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {/* Mode Toggle */}
                <div className="flex bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setRewardsMode('year')}
                    className={`px-4 py-2 font-bold text-sm transition-all ${
                      rewardsMode === 'year' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Full Year
                  </button>
                  <button
                    onClick={() => setRewardsMode('week')}
                    className={`px-4 py-2 font-bold text-sm transition-all ${
                      rewardsMode === 'week' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    By Week
                  </button>
                </div>
                {/* Week Picker */}
                {rewardsMode === 'week' && (
                  <input
                    type="week"
                    value={rewardsWeek}
                    onChange={e => setRewardsWeek(e.target.value)}
                    className="border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )}
              </div>
            </div>

            {/* Annual Award Hero Banner — only in full-year mode */}
            {rewardsMode === 'year' && !rewardsLoading && topMembers && topLeaders && (
              <div className="relative overflow-hidden bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 rounded-3xl p-8 shadow-xl">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage:'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)' ,backgroundSize:'20px 20px'}}></div>
                <div className="relative z-10 text-center">
                  <div className="text-5xl mb-2">🏆</div>
                  <h3 className="text-3xl font-black text-white drop-shadow mb-1">{rewardsYear} Annual Awards</h3>
                  <p className="text-amber-100 font-bold mb-6">Celebrating excellence in attendance and faithful leadership</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                    {/* Best Member Award */}
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/30">
                      <p className="text-amber-100 text-xs font-black uppercase tracking-widest mb-2">🥇 Best Attendee of the Year</p>
                      {topMembers.members.filter(m => m.rank === 1).length > 0 ? (
                        topMembers.members.filter(m => m.rank === 1).map(m => (
                          <div key={m.id} className="text-white">
                            <p className="text-xl font-black">{m.full_name}</p>
                            <p className="text-amber-200 text-sm">{m.section_name} · {m.attendance_rate}% attendance</p>
                          </div>
                        ))
                      ) : <p className="text-white font-bold">No data yet</p>}
                    </div>
                    {/* Best Leader Award */}
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/30">
                      <p className="text-amber-100 text-xs font-black uppercase tracking-widest mb-2">⭐ Best Leader of the Year</p>
                      {topLeaders.leaders.filter(l => l.rank === 1).length > 0 ? (
                        topLeaders.leaders.filter(l => l.rank === 1).map(l => (
                          <div key={l.id} className="text-white">
                            <p className="text-xl font-black">{l.leader_name}</p>
                            <p className="text-amber-200 text-sm">{l.section_name} · {l.submission_rate}% on time</p>
                          </div>
                        ))
                      ) : <p className="text-white font-bold">No data yet</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {rewardsLoading && (
              <div className="flex justify-center py-16">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-amber-400"></div>
                  <p className="text-gray-500 font-bold">Calculating rankings…</p>
                </div>
              </div>
            )}

            {/* Leaderboards */}
            {!rewardsLoading && topMembers && topLeaders && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* ── Top Attending Members ── */}
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                    <h4 className="text-xl font-black flex items-center gap-2">🥇 Top Attending Members</h4>
                    <p className="text-emerald-100 text-sm mt-1">
                      Based on {topMembers.total_service_days} service day{topMembers.total_service_days !== 1 ? 's' : ''} this period
                    </p>
                  </div>

                  {/* Podium — top 3 unique ranks */}
                  {(() => {
                    const top3 = topMembers.members.filter(m => m.rank <= 3);
                    const rank1 = top3.filter(m => m.rank === 1);
                    const rank2 = top3.filter(m => m.rank === 2);
                    const rank3 = top3.filter(m => m.rank === 3);
                    if (top3.length === 0) return null;
                    return (
                      <div className="flex items-end justify-center gap-3 p-6 bg-gradient-to-b from-gray-50 to-white">
                        {/* Silver - Rank 2 */}
                        <div className="flex flex-col items-center flex-1">
                          {rank2.map(m => (
                            <div key={m.id} className="text-center">
                              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl mx-auto mb-1 border-4 border-gray-300 shadow">🥈</div>
                              <p className="text-xs font-black text-gray-700 truncate max-w-[80px]">{m.full_name.split(' ')[0]}</p>
                              <p className="text-xs text-gray-500">{m.attendance_rate}%</p>
                            </div>
                          ))}
                          <div className="w-full bg-gray-200 rounded-t-xl mt-2 h-16 flex items-center justify-center">
                            <span className="text-gray-500 font-black text-lg">#2</span>
                          </div>
                        </div>
                        {/* Gold - Rank 1 */}
                        <div className="flex flex-col items-center flex-1">
                          {rank1.map(m => (
                            <div key={m.id} className="text-center">
                              <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-1 border-4 border-yellow-400 shadow-lg">🥇</div>
                              <p className="text-xs font-black text-gray-800 truncate max-w-[90px]">{m.full_name.split(' ')[0]}</p>
                              <p className="text-xs text-amber-600 font-bold">{m.attendance_rate}%</p>
                            </div>
                          ))}
                          <div className="w-full bg-gradient-to-b from-yellow-400 to-amber-500 rounded-t-xl mt-2 h-24 flex items-center justify-center shadow-md">
                            <span className="text-white font-black text-xl">#1</span>
                          </div>
                        </div>
                        {/* Bronze - Rank 3 */}
                        <div className="flex flex-col items-center flex-1">
                          {rank3.map(m => (
                            <div key={m.id} className="text-center">
                              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl mx-auto mb-1 border-4 border-orange-300 shadow">🥉</div>
                              <p className="text-xs font-black text-gray-700 truncate max-w-[80px]">{m.full_name.split(' ')[0]}</p>
                              <p className="text-xs text-gray-500">{m.attendance_rate}%</p>
                            </div>
                          ))}
                          <div className="w-full bg-orange-200 rounded-t-xl mt-2 h-10 flex items-center justify-center">
                            <span className="text-orange-700 font-black">#3</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Full Table */}
                  <div className="overflow-y-auto max-h-80">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Member</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Section</th>
                          <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Present</th>
                          <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {topMembers.members.map((m, idx) => {
                          const rate = m.attendance_rate;
                          const badgeColor = rate >= 95 ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : rate >= 85 ? 'bg-gray-100 text-gray-700 border-gray-300'
                            : rate >= 75 ? 'bg-orange-100 text-orange-700 border-orange-300'
                            : 'bg-red-50 text-red-600 border-red-200';
                          const badge = rate >= 95 ? '🥇' : rate >= 85 ? '🥈' : rate >= 75 ? '🥉' : '—';
                          const rowBg = m.rank === 1 ? 'bg-yellow-50/60' : m.rank === 2 ? 'bg-gray-50/60' : m.rank === 3 ? 'bg-orange-50/40' : '';
                          return (
                            <tr key={m.id} className={`${rowBg} hover:bg-amber-50/30 transition-colors`}>
                              <td className="px-4 py-3 text-sm font-black text-gray-400">#{m.rank}</td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-gray-900 text-sm">{m.full_name}</div>
                                <div className="text-xs text-gray-400 font-mono">{m.membership_id}</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-blue-600 font-bold">{m.section_name}</td>
                              <td className="px-4 py-3 text-center text-sm font-mono text-gray-600">{m.times_present}/{m.total_services}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black border ${badgeColor}`}>
                                  {badge} {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {topMembers.members.length === 0 && (
                          <tr><td colSpan="5" className="px-4 py-10 text-center text-gray-400 font-medium">No attendance data for this period.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Top Section Leaders ── */}
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                    <h4 className="text-xl font-black flex items-center gap-2">🏅 Most Consistent Leaders</h4>
                    <p className="text-indigo-100 text-sm mt-1">
                      Based on {topLeaders.total_service_days} service day{topLeaders.total_service_days !== 1 ? 's' : ''} this period
                    </p>
                  </div>

                  {/* Podium */}
                  {(() => {
                    const top3 = topLeaders.leaders.filter(l => l.rank <= 3);
                    const rank1 = top3.filter(l => l.rank === 1);
                    const rank2 = top3.filter(l => l.rank === 2);
                    const rank3 = top3.filter(l => l.rank === 3);
                    if (top3.length === 0) return null;
                    return (
                      <div className="flex items-end justify-center gap-3 p-6 bg-gradient-to-b from-gray-50 to-white">
                        {/* Silver */}
                        <div className="flex flex-col items-center flex-1">
                          {rank2.map(l => (
                            <div key={l.id} className="text-center">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl mx-auto mb-1 border-4 border-gray-300 shadow">🥈</div>
                              <p className="text-xs font-black text-gray-700 truncate max-w-[80px]">{l.leader_name.split(' ')[0]}</p>
                              <p className="text-xs text-gray-500">{l.submission_rate}%</p>
                            </div>
                          ))}
                          <div className="w-full bg-gray-200 rounded-t-xl mt-2 h-16 flex items-center justify-center">
                            <span className="text-gray-500 font-black text-lg">#2</span>
                          </div>
                        </div>
                        {/* Gold */}
                        <div className="flex flex-col items-center flex-1">
                          {rank1.map(l => (
                            <div key={l.id} className="text-center">
                              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-1 border-4 border-purple-400 shadow-lg">⭐</div>
                              <p className="text-xs font-black text-gray-800 truncate max-w-[90px]">{l.leader_name.split(' ')[0]}</p>
                              <p className="text-xs text-purple-600 font-bold">{l.submission_rate}%</p>
                            </div>
                          ))}
                          <div className="w-full bg-gradient-to-b from-indigo-500 to-purple-600 rounded-t-xl mt-2 h-24 flex items-center justify-center shadow-md">
                            <span className="text-white font-black text-xl">#1</span>
                          </div>
                        </div>
                        {/* Bronze */}
                        <div className="flex flex-col items-center flex-1">
                          {rank3.map(l => (
                            <div key={l.id} className="text-center">
                              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl mx-auto mb-1 border-4 border-orange-300 shadow">🥉</div>
                              <p className="text-xs font-black text-gray-700 truncate max-w-[80px]">{l.leader_name.split(' ')[0]}</p>
                              <p className="text-xs text-gray-500">{l.submission_rate}%</p>
                            </div>
                          ))}
                          <div className="w-full bg-orange-200 rounded-t-xl mt-2 h-10 flex items-center justify-center">
                            <span className="text-orange-700 font-black">#3</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Full Table */}
                  <div className="overflow-y-auto max-h-80">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Leader</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Section</th>
                          <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Submitted</th>
                          <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {topLeaders.leaders.map((l, idx) => {
                          const rate = l.submission_rate;
                          const badgeColor = rate >= 100 ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : rate >= 90 ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                            : rate >= 75 ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-red-50 text-red-600 border-red-200';
                          const badge = rate >= 100 ? '⭐' : rate >= 90 ? '🏅' : rate >= 75 ? '👍' : '—';
                          const rowBg = l.rank === 1 ? 'bg-purple-50/50' : l.rank === 2 ? 'bg-gray-50/60' : l.rank === 3 ? 'bg-orange-50/40' : '';
                          return (
                            <tr key={l.id} className={`${rowBg} hover:bg-indigo-50/30 transition-colors`}>
                              <td className="px-4 py-3 text-sm font-black text-gray-400">#{l.rank}</td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-gray-900 text-sm">{l.leader_name}</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-blue-600 font-bold">{l.section_name}</td>
                              <td className="px-4 py-3 text-center text-sm font-mono text-gray-600">{l.submitted_count}/{l.total_service_days}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black border ${badgeColor}`}>
                                  {badge} {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {topLeaders.leaders.length === 0 && (
                          <tr><td colSpan="5" className="px-4 py-10 text-center text-gray-400 font-medium">No submission data for this period.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* --- Options Hub --- */}
        {activeTab === 'options' && (
          <div className="animate-fade-in space-y-8">
            <div className="border-b pb-4 mb-6">
               <h3 className="text-2xl font-bold text-gray-900">System Options Hub</h3>
               <p className="text-gray-500">Manage account security, leader credentials, and run bulk CSV imports.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Account Settings */}
              <div className="bg-white p-6 rounded-3xl shadow-soft border border-gray-100 hover:border-primary-200 transition-colors">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-3 bg-blue-50 p-2 rounded-xl">⚙️</span> Admin Security</h4>
                <div className="space-y-6 pl-2">
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-sm font-bold text-gray-600 mb-3">Update your display name:</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                         type="text" 
                         value={profileName} 
                         onChange={e => setProfileName(e.target.value)} 
                         className="border-2 border-gray-200 rounded-xl px-4 py-2 bg-white font-bold text-gray-700 outline-none focus:ring-2 focus:ring-primary-500 flex-grow" 
                      />
                      <button 
                         onClick={async () => {
                            if (!profileName.trim()) return;
                            setLoading(true);
                            try {
                               const res = await authAPI.updateProfile({ full_name: profileName });
                               updateUser({ full_name: res.data.full_name });
                               setMessage('Profile name updated successfully');
                               setTimeout(() => setMessage(''), 3000);
                            } catch (err) {
                               alert('Failed to update profile name');
                            } finally {
                               setLoading(false);
                            }
                         }} 
                         disabled={loading || !profileName.trim() || profileName.trim() === user?.full_name} 
                         className="bg-emerald-600 text-white shadow-md font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                         Save Name
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-sm font-bold text-gray-600 mb-3">Update your login password:</p>
                    <Link to="/change-password" className="inline-block bg-primary-600 text-white shadow-md font-bold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition transform hover:-translate-y-0.5">Change My Password</Link>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-sm font-bold text-gray-600 mb-3">Update your dashboard picture:</p>
                    <button onClick={triggerGlobalProfileUpload} className="inline-block bg-blue-600 text-white shadow-md font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition transform hover:-translate-y-0.5">
                      Upload Picture
                    </button>
                  </div>
                </div>
              </div>

              {/* Leader Security */}
              <div className="bg-white p-6 rounded-3xl shadow-soft border border-gray-100 hover:border-primary-200 transition-colors">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><span className="text-2xl mr-3 bg-indigo-50 p-2 rounded-xl">👔</span> Leader Credentials</h4>
                <div className="bg-gray-50 p-4 rounded-xl h-full">
                  <p className="text-sm font-medium text-gray-600 mb-4">Generate temporary credentials for a section leader if they forget their password.</p>
                  <div className="flex flex-col space-y-4">
                    <select id="leaderResetSelect" className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white font-medium text-gray-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all">
                      <option value="">-- Select a Section Leader --</option>
                      {leaders.map(l => <option key={l.id} value={l.id}>{l.full_name} ({l.section_name})</option>)}
                    </select>
                    <button onClick={() => {
                      const id = document.getElementById('leaderResetSelect').value;
                      if(id) handleResetPassword(id);
                      else alert('Please select a leader first');
                    }} className="bg-red-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-red-600 shadow-md transition transform hover:-translate-y-0.5 mt-auto">Reset Leader Password</button>
                  </div>
                </div>
              </div>

              {/* Data Import */}
              <div className="md:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-3xl shadow-soft border border-amber-200/50">
                 <h4 className="text-xl font-bold text-amber-900 mb-4 flex items-center"><span className="text-3xl mr-3 bg-white p-2 border border-amber-100 shadow-sm rounded-xl">📤</span> Bulk Data Import</h4>
                 <p className="text-base text-amber-800/80 mb-6 font-medium max-w-2xl">Upload a CSV file to automatically provision new Sections, Leaders, and Members simultaneously. Temporary leader credentials will be generated.</p>
                 <label className="flex flex-col items-center justify-center w-full py-12 border-2 border-dashed border-amber-300 bg-white/50 rounded-2xl cursor-pointer hover:bg-white transition shadow-inner group">
                    <div className="text-center transition-transform group-hover:scale-105 duration-300">
                      <div className="text-5xl mb-4 group-hover:-translate-y-1 transition-transform">📁</div>
                      <span className="font-bold text-lg text-amber-800 bg-amber-100 px-6 py-2 rounded-full shadow-sm">Select CSV File to Upload</span>
                    </div>
                    <input type="file" accept=".csv" onChange={handleUpload} disabled={loading} className="hidden" />
                 </label>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- Leader Drilldown Overlay Modal --- */}
      {drilldownData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center z-[150] pt-12 pb-12 px-4 overflow-hidden animate-fade-in">
          {drilldownData.loading ? (
             <div className="flex flex-col items-center mt-32">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-400 mb-4"></div>
                <h3 className="text-white text-2xl font-bold tracking-widest uppercase">Opening Dashboard...</h3>
             </div>
          ) : (
            <div className="bg-gray-50 w-full max-w-7xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
              {/* Header */}
              <div className="bg-indigo-700 p-8 flex justify-between items-center text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                <div>
                   <span className="text-indigo-200 font-bold uppercase tracking-widest text-sm mb-1 block">Live Oversight Protocol</span>
                   <h2 className="text-4xl font-black">{drilldownData.data.leader.full_name}</h2>
                   <div className="flex items-center space-x-6 mt-3 text-indigo-100">
                     <span className="flex items-center bg-indigo-800/50 px-3 py-1 rounded-full"><span className="mr-2">📁</span> {drilldownData.data.leader.section_name} Section</span>
                     <span className="flex items-center"><span className="mr-2">📱</span> {drilldownData.data.leader.phone || 'N/A'}</span>
                     <span className="flex items-center"><span className="mr-2">📧</span> {drilldownData.data.leader.email || 'N/A'}</span>
                   </div>
                </div>
                <button onClick={() => setDrilldownData(null)} className="h-14 w-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-3xl font-light transition-colors z-10 hover:shadow-glow">&times;</button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column: Stats & Roster */}
                  <div className="lg:col-span-1 space-y-8">
                    {/* Performance Overview */}
                    <div className="bg-white p-6 rounded-3xl shadow-soft border border-gray-100">
                      <h4 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wider flex items-center"><span className="text-indigo-500 mr-2">⚡</span> Quick Stats</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                           <p className="text-xs text-gray-500 font-bold uppercase mb-1">Total Members</p>
                           <p className="text-3xl font-black text-indigo-600">{drilldownData.data.roster.length}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                           <p className="text-xs text-gray-500 font-bold uppercase mb-1">Submissions</p>
                           <p className="text-3xl font-black text-gray-800">{drilldownData.data.history.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* Member Roster */}
                    <div className="bg-white rounded-3xl shadow-soft border border-gray-100 flex flex-col h-[500px]">
                      <div className="p-6 border-b border-gray-100"><h4 className="text-lg font-black text-gray-800 uppercase tracking-wider flex items-center"><span className="text-emerald-500 mr-2">👥</span> Direct Roster</h4></div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {drilldownData.data.roster.map(m => (
                          <div key={m.id} className="bg-gray-50 hover:bg-white p-3 rounded-xl border border-transparent hover:border-gray-200 transition-colors">
                            <h5 className="font-bold text-gray-800 text-sm">{m.full_name}</h5>
                            <p className="text-xs text-gray-500 font-mono mt-1">{m.membership_id}</p>
                          </div>
                        ))}
                        {drilldownData.data.roster.length === 0 && <p className="text-center text-gray-400 py-12 font-bold">Roster empty.</p>}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Charts & History */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Attendance Trends */}
                    <div className="bg-white p-6 justify-center rounded-3xl shadow-soft border border-gray-100 h-[400px] flex flex-col">
                      <h4 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wider flex items-center"><span className="text-blue-500 mr-2">📈</span> 90-Day Engagement Trend</h4>
                      <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={drilldownData.data.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorPresOve" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11}} dy={10} minTickGap={20} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11}} allowDecimals={false} />
                            <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} />
                            <Area type="monotone" dataKey="present_count" name="Members Present" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorPresOve)" activeDot={{r: 8, strokeWidth: 0}} />
                            <Area type="monotone" dataKey="absent_count" name="Members Absent" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                          </AreaChart>
                        </ResponsiveContainer>
                        {drilldownData.data.trends.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold">No trending data available.</div>}
                      </div>
                    </div>

                    {/* Personal History */}
                    <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
                      <div className="p-6 border-b border-gray-100"><h4 className="text-lg font-black text-gray-800 uppercase tracking-wider flex items-center"><span className="text-amber-500 mr-2">🕒</span> Past Submissions</h4></div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100 mt-2">
                          <thead>
                            <tr>
                              <th className="px-6 py-4 bg-gray-50/50 text-left text-xs font-black text-gray-500 uppercase">Service Date</th>
                              <th className="px-6 py-4 bg-gray-50/50 text-left text-xs font-black text-gray-500 uppercase">Records Added</th>
                              <th className="px-6 py-4 bg-gray-50/50 text-left text-xs font-black text-gray-500 uppercase">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 bg-white">
                            {drilldownData.data.history.map((log, i) => (
                              <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{log.date}</td>
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-indigo-600 bg-indigo-50/40">{log.records_count}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(log.submitted_at).toLocaleString()}</td>
                              </tr>
                            ))}
                            {drilldownData.data.history.length === 0 && <tr><td colSpan="3" className="px-6 py-12 text-center text-gray-400 font-medium">No prior submissions logged by this leader.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Global Modal */}
      {uploadResult && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
           <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
               <h4 className="font-bold text-emerald-800 text-2xl">✨ Upload Complete!</h4>
               <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-gray-800 text-3xl">&times;</button>
             </div>
             <ul className="text-emerald-700 space-y-2 mb-6 font-medium bg-emerald-50 p-4 rounded-xl border border-emerald-100">
               <li>✓ Sections created: {uploadResult.results.sectionsCreated}</li>
               <li>✓ Leaders created: {uploadResult.results.leadersCreated}</li>
               <li>✓ Members created: {uploadResult.results.membersCreated}</li>
             </ul>
             {uploadResult.tempPasswords?.length > 0 && (
               <div className="mt-6 bg-white border border-amber-200 rounded-xl p-6 shadow-sm">
                  <h5 className="font-bold text-amber-800 mb-4">New Leader Credentials</h5>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Username</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Password</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100 text-sm">
                        {uploadResult.tempPasswords.map((cred, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-900">{cred.username}</td>
                            <td className="px-4 py-3 font-mono text-amber-700 font-medium bg-amber-50/30">{cred.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}
           </div>
         </div>
      )}

      <MemberEditModal
        isOpen={isModalOpen}
        member={editingMember}
        mode={memberMode}
        sections={sections}
        leaders={leaders}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMember}
      />

      {showDeleteConfirm && deletingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-8 border border-gray-100 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Member?</h3>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto">This action cannot be undone. Are you sure you want to remove <strong className="text-gray-800">{deletingMember.full_name}</strong> from the system?</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="flex-1 px-6 py-3 font-bold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete} 
                disabled={deleteLoading}
                className="flex-1 px-6 py-3 font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 hover:shadow-glow transition-all disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && !uploadResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center space-x-4">
              <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span className="font-bold text-lg text-gray-800">Processing...</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
