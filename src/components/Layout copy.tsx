import { ReactNode, useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { Building2, UserCircle, CalendarDays, FolderOpen, Settings, Users, LogOut, ChevronDown, KeyRound } from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function Layout({ children, currentTab, onTabChange }: { children: ReactNode, currentTab: string, onTabChange: (tab: string) => void }) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-indigo-600">
              <Building2 className="h-8 w-8" />
              <span className="font-bold text-xl tracking-tight text-slate-900">RoomBook</span>
            </div>
            
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                <button 
                  onClick={() => onTabChange('dashboard')}
                  className={`px-4 py-2 rounded-xl text-base font-bold transition-colors flex items-center gap-2 ${currentTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <Building2 className="h-5 w-5" />
                  Rooms
                </button>
                <button 
                  onClick={() => onTabChange('calendar')}
                  className={`px-4 py-2 rounded-xl text-base font-bold transition-colors flex items-center gap-2 ${currentTab === 'calendar' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <CalendarDays className="h-5 w-5" />
                  Calendar
                </button>
                <button 
                  onClick={() => onTabChange('my-bookings')}
                  className={`px-4 py-2 rounded-xl text-base font-bold transition-colors flex items-center gap-2 ${currentTab === 'my-bookings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <FolderOpen className="h-5 w-5" />
                  My Bookings
                </button>
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <>
                    <button 
                      onClick={() => onTabChange('time-management')}
                      className={`px-4 py-2 rounded-xl text-base font-bold transition-colors flex items-center gap-2 ${currentTab === 'time-management' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      <Settings className="h-5 w-5" />
                      Time
                    </button>
                    <button 
                      onClick={() => onTabChange('user-management')}
                      className={`px-4 py-2 rounded-xl text-base font-bold transition-colors flex items-center gap-2 ${currentTab === 'user-management' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      <Users className="h-5 w-5" />
                      Admin
                    </button>
                  </>
                )}
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-slate-900 text-sm">{user.full_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs border-2 border-white shadow-sm group-hover:bg-indigo-200 transition-colors">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-900">{user.full_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Department</span>
                        <span className="font-bold text-slate-900">{user.department_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Role</span>
                        <span className="font-bold text-indigo-600 uppercase tracking-wider">{user.role.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => {
                          setShowDropdown(false);
                          setShowChangePassword(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                      >
                        <KeyRound className="h-4 w-4" />
                        Change Password
                      </button>
                      <button 
                        onClick={() => {
                          setShowDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
        {children}
      </main>

      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-around z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 ${currentTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <Building2 className="h-6 w-6" />
            <span className="text-xs font-bold">Rooms</span>
          </button>
          <button 
            onClick={() => onTabChange('calendar')}
            className={`flex flex-col items-center gap-1 ${currentTab === 'calendar' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <CalendarDays className="h-6 w-6" />
            <span className="text-xs font-bold">Calendar</span>
          </button>
          <button 
            onClick={() => onTabChange('my-bookings')}
            className={`flex flex-col items-center gap-1 ${currentTab === 'my-bookings' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <FolderOpen className="h-6 w-6" />
            <span className="text-xs font-bold">My Bookings</span>
          </button>
          {(user.role === 'admin' || user.role === 'super_admin') && (
            <button 
              onClick={() => onTabChange('user-management')}
              className={`flex flex-col items-center gap-1 ${currentTab === 'user-management' ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <Users className="h-6 w-6" />
              <span className="text-xs font-bold">Admin</span>
            </button>
          )}
        </nav>
      )}

      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
    </div>
  );
}
