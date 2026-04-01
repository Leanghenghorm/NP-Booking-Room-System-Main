import { useState, useEffect, FormEvent } from "react";
import { Users, UserPlus, Trash2, Edit2, X, Plus } from 'lucide-react';
import { useAuth } from "./AuthProvider";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department_id: number;
  department_name: string;
  status: string;
};

type Department = {
  id: number;
  name: string;
};

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "departments">("users");
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
            {(["users", "departments"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
                  activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                {tab}
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
          ) : (
            <button 
              onClick={() => { setEditingDept(null); setIsDeptModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          )}
        </div>
      </div>

      {activeTab === "users" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{u.full_name}</div>
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
