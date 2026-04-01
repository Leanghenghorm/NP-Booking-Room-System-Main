import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Login } from "./Login";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "user";
  department_id: number;
  department_name: string;
};

type AuthContextType = {
  user: User | null;
  users: User[];
  login: (user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on mount
    fetch("/api/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
      });
  }, []);

  const login = (user: User) => {
    setUser(user);
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <AuthContext.Provider value={{ user, users, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
