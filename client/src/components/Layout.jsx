import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authAPI } from '../services/api';

const Layout = ({ children, showNav = true }) => {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const [uploading, setUploading] = useState(false);

  const handleProfileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await authAPI.uploadProfilePicture(file);
      updateUser({ profile_picture: res.data.profile_picture });
    } catch (err) {
      alert('Failed to upload profile picture: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };
  const navItems = {
    admin: [
      { path: '/admin', label: 'Dashboard', icon: '📊' },
    ],
    leader: [
      { path: '/leader', label: 'Dashboard', icon: '📊' },
    ],
    pastor: [
      { path: '/pastor', label: 'Dashboard', icon: '📊' },
      { path: '/pastor/leaders', label: 'Leader Performance', icon: '📈' },
      { path: '/pastor/at-risk', label: 'At-Risk Members', icon: '⚠️' },
    ]
  };

  const currentNav = navItems[user?.role] || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 text-white shadow-md border-b border-primary-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-primary-200">
                Church Attendance
              </h1>
              <span className="bg-white/20 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-full text-xs font-semibold tracking-wider shadow-inner">
                {user?.role?.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                {/* Profile Picture Upload Avatar */}
                <div className="relative group cursor-pointer" onClick={() => document.getElementById('profile-upload').click()}>
                  {user?.profile_picture ? (
                    <img src={`${user.profile_picture}?t=${new Date().getTime()}`} alt="Profile" className={`w-10 h-10 rounded-full border-2 border-white/20 object-cover shadow-sm group-hover:border-white/60 transition-colors ${uploading ? 'opacity-50' : ''}`} />
                  ) : (
                    <div className={`w-10 h-10 rounded-full bg-primary-600 border-2 border-white/20 flex items-center justify-center text-white font-bold shadow-sm group-hover:bg-primary-500 transition-colors ${uploading ? 'opacity-50 animate-pulse' : ''}`}>
                      {user?.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <input type="file" id="profile-upload" className="hidden" accept="image/*" onChange={handleProfileUpload} disabled={uploading} />
                  <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm text-white text-xs py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Update Picture
                  </div>
                </div>

                {/* User Name Link to Info/Options */}
                <Link
                  to="/"
                  className="hidden sm:block font-medium text-primary-50 hover:text-white transition-colors cursor-pointer"
                  title="Go to Dashboard Home"
                >
                  {uploading ? 'Uploading...' : user?.full_name}
                </Link>
              </div>
              {user?.role === 'admin' ? (
                <Link
                  to="/admin#options"
                  onClick={() => {
                    if (window.location.pathname === '/admin') {
                      window.location.hash = 'options';
                      window.dispatchEvent(new HashChangeEvent("hashchange"));
                    }
                  }}
                  className="text-primary-200 hover:text-white text-sm font-medium transition-colors duration-200 cursor-pointer"
                >
                  Options
                </Link>
              ) : (
                <Link
                  to="/change-password"
                  className="text-primary-200 hover:text-white text-sm transition-colors duration-200"
                >
                  Change Password
                </Link>
              )}
              <button
                onClick={logout}
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-soft"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        {showNav && currentNav.length > 0 && (
          <nav className="mb-8 bg-white/80 backdrop-blur-md border border-white rounded-xl shadow-soft p-3 z-10 relative">
            <div className="flex flex-wrap gap-2">
              {currentNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg transition-all duration-300 font-medium ${location.pathname === item.path
                      ? 'bg-primary-600 text-white shadow-glow transform scale-[1.02]'
                      : 'bg-transparent hover:bg-primary-50 text-gray-600 hover:text-primary-700'
                    }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Main Content */}
        <main>{children}</main>
      </div>
    </div>
  );
};

export default Layout;
