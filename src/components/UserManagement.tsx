import { useState, useEffect, FormEvent } from "react";
import { Users, UserPlus, Trash2, Edit2, X, Plus, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from "./AuthProvider";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department_id: number;
  department_name: string;
  status: string;
  auth_provider?: string;
};

type Department = {
  id: number;
  name: string;
};

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "departments" | "ldap">("users");
  const [userFilter, setUserFilter] = useState<"all" | "local" | "ad">("all");
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, deptsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments")
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (deptsRes.ok) setDepartments(await deptsRes.json());
    } catch (err) {
      console.error("Failed to fetch user management data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user ${user.full_name}?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) fetchData();
      else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  if (loading && users.length === 0) return <div className="p-8 text-slate-500">Loading user management...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage system access, roles, and status</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(["users", "departments", "ldap"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
                  activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                {tab === "ldap" ? "AD / LDAP" : tab}
              </button>
            ))}
          </div>
          
          {activeTab === "users" ? (
            <button 
              onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add System User
            </button>
          ) : activeTab === "departments" ? (
            <button 
              onClick={() => { setEditingDept(null); setIsDeptModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          ) : null}
        </div>
      </div>

      {activeTab === "users" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-medium text-slate-900">System Users</h3>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value as any)}
              className="text-sm border-slate-200 rounded-lg bg-white px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="all">All Users</option>
              <option value="local">Local Users</option>
              <option value="ad">AD Users</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.filter(u => {
                  if (userFilter === "local") return u.auth_provider !== "ldap";
                  if (userFilter === "ad") return u.auth_provider === "ldap";
                  return true;
                }).map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {u.full_name}
                            {u.auth_provider === 'ldap' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-indigo-50 text-indigo-700 border border-indigo-100" title="Active Directory User">
                                AD
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {u.department_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold ${
                        u.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                        u.role === 'admin' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-slate-50 text-slate-600 border border-slate-100'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}
                          disabled={currentUser?.role === 'admin' && u.role === 'super_admin'}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button 
                            onClick={() => handleDeleteUser(u)}
                            disabled={currentUser?.role === 'admin' && u.role === 'super_admin'}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "departments" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map(dept => (
                  <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5 font-bold text-slate-900">{dept.name}</td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingDept(dept);
                            setIsDeptModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors inline-flex"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete department ${dept.name}?`)) {
                              const res = await fetch(`/api/departments/${dept.id}`, { method: "DELETE" });
                              if (res.ok) fetchData();
                              else {
                                const data = await res.json();
                                alert(data.error || "Failed to delete department");
                              }
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors inline-flex"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "ldap" && (
        <LdapSettings />
      )}

      {isUserModalOpen && (
        <UserModal
          user={editingUser}
          currentUser={currentUser}
          departments={departments}
          onClose={() => setIsUserModalOpen(false)}
          onSuccess={() => {
            setIsUserModalOpen(false);
            fetchData();
          }}
        />
      )}

      {isDeptModalOpen && (
        <DepartmentModal
          department={editingDept}
          onClose={() => setIsDeptModalOpen(false)}
          onSuccess={() => {
            setIsDeptModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function LdapSettings() {
  const [settings, setSettings] = useState({
    ldap_enabled: 'false',
    ldap_url: '',
    ldap_bind_dn: '',
    ldap_bind_password: '',
    ldap_search_base: '',
    ldap_username_attribute: 'userPrincipalName'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings({
          ldap_enabled: data.ldap_enabled || 'false',
          ldap_url: data.ldap_url || '',
          ldap_bind_dn: data.ldap_bind_dn || '',
          ldap_bind_password: data.ldap_bind_password || '',
          ldap_search_base: data.ldap_search_base || '',
          ldap_username_attribute: data.ldap_username_attribute || 'userPrincipalName'
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testUsername || !testPassword) {
      setTestResult({ success: false, message: 'Please enter a test username and password' });
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/settings/test-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.ldap_url,
          bindDn: settings.ldap_bind_dn,
          bindPassword: settings.ldap_bind_password,
          searchBase: settings.ldap_search_base,
          usernameAttribute: settings.ldap_username_attribute,
          testUsername,
          testPassword
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTestResult({ success: true, message: `Successfully authenticated as ${data.user.displayName || data.user.cn || testUsername}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Authentication failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading settings...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-3xl">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Active Directory / LDAP Integration</h3>
            <p className="text-sm text-slate-500 mt-1">
              Allow users to log in using their Active Directory credentials. Users will be automatically provisioned upon their first successful login.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
        
        {saved && (
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Settings saved successfully.
          </div>
        )}

        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <input
            type="checkbox"
            id="ldap_enabled"
            checked={settings.ldap_enabled === 'true'}
            onChange={e => setSettings({ ...settings, ldap_enabled: e.target.checked ? 'true' : 'false' })}
            className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <label htmlFor="ldap_enabled" className="font-medium text-slate-900">
            Enable Active Directory / LDAP Authentication
          </label>
        </div>

        <div className={`space-y-4 ${settings.ldap_enabled !== 'true' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Server URL</label>
            <input
              type="text"
              placeholder="ldap://ad.example.com:389 or ldaps://ad.example.com:636"
              value={settings.ldap_url}
              onChange={e => setSettings({ ...settings, ldap_url: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bind DN (Service Account)</label>
              <input
                type="text"
                placeholder="CN=Bind User,CN=Users,DC=example,DC=com"
                value={settings.ldap_bind_dn}
                onChange={e => setSettings({ ...settings, ldap_bind_dn: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bind Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={settings.ldap_bind_password}
                onChange={e => setSettings({ ...settings, ldap_bind_password: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Search Base</label>
              <input
                type="text"
                placeholder="DC=example,DC=com"
                value={settings.ldap_search_base}
                onChange={e => setSettings({ ...settings, ldap_search_base: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username Attribute</label>
              <select
                value={settings.ldap_username_attribute}
                onChange={e => setSettings({ ...settings, ldap_username_attribute: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                <option value="userPrincipalName">userPrincipalName (e.g. user@domain.com)</option>
                <option value="sAMAccountName">sAMAccountName (e.g. domain\user)</option>
                <option value="mail">mail (Email Address)</option>
                <option value="uid">uid (OpenLDAP)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h4 className="text-sm font-medium text-slate-900 mb-4">Test Connection</h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Test Username</label>
                  <input
                    type="text"
                    placeholder="user@domain.com"
                    value={testUsername}
                    onChange={e => setTestUsername(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Test Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={testPassword}
                    onChange={e => setTestPassword(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !testUsername || !testPassword}
                  className="px-4 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test Authentication'}
                </button>
                
                {testResult && (
                  <div className={`text-sm flex items-center gap-2 ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}

function UserModal({ user, currentUser, departments, onClose, onSuccess }: { user: User | null, currentUser: any, departments: Department[], onClose: () => void, onSuccess: () => void }) {
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState(user?.department_id || (departments[0]?.id || 1));
  const [role, setRole] = useState(user?.role || "user");
  const [status, setStatus] = useState(user?.status || "active");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password, department_id: departmentId, role, status })
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || `Failed to ${user ? "update" : "create"} user`);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{user ? "Edit User" : "Add New User"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
          </div>

          {(!user || user.auth_provider !== 'ldap') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {user && <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                required={!user}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                disabled={currentUser?.role === 'admin' && user?.role === 'super_admin'}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="user">Normal User</option>
                {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                  <option value="admin">Admin</option>
                )}
                {currentUser?.role === 'super_admin' && (
                  <option value="super_admin">Super Admin</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DepartmentModal({ department, onClose, onSuccess }: { department: Department | null, onClose: () => void, onSuccess: () => void }) {
  const [name, setName] = useState(department?.name || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = department ? `/api/departments/${department.id}` : "/api/departments";
      const method = department ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || `Failed to ${department ? "update" : "create"} department`);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{department ? "Edit Department" : "Add New Department"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
