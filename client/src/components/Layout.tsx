import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import NotificationBell from './NotificationBell';
import {
  FolderKanban,
  Users,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path: string) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      isActive(path)
        ? 'bg-openserve-green text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  const roleLabel = {
    staff: 'Staff',
    admin: 'Admin',
    superadmin: 'Super Admin',
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-openserve-green rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">O</span>
              </div>
              <span className="text-xl font-semibold text-gray-800">
                OpenServe
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <Link to="/" className={navLinkClass('/')}>
                <FolderKanban size={20} />
                <span>Projects</span>
              </Link>

              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <Link to="/users" className={navLinkClass('/users')}>
                  <Users size={20} />
                  <span>Users</span>
                </Link>
              )}

              {user?.role === 'superadmin' && (
                <Link to="/settings" className={navLinkClass('/settings')}>
                  <Settings size={20} />
                  <span>Settings</span>
                </Link>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <NotificationBell />

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-openserve-green rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium text-gray-700">
                      {user?.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {roleLabel[user?.role || 'staff']}
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                      <div className="font-medium text-gray-700">
                        {user?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {roleLabel[user?.role || 'staff']}
                      </div>
                    </div>

                    {/* Mobile nav */}
                    <div className="md:hidden border-b border-gray-100 py-1">
                      <Link
                        to="/"
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <FolderKanban size={18} />
                        Projects
                      </Link>
                      {(user?.role === 'admin' ||
                        user?.role === 'superadmin') && (
                        <Link
                          to="/users"
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Users size={18} />
                          Users
                        </Link>
                      )}
                      {user?.role === 'superadmin' && (
                        <Link
                          to="/settings"
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings size={18} />
                          Settings
                        </Link>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
