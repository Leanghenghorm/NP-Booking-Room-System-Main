import { Router } from "express";
import { db } from "./db";
import * as argon2 from "argon2";
import * as bcrypt from "bcryptjs";
import "express-session";
import crypto from "crypto";

export const apiRouter = Router();

// Logging middleware for API
apiRouter.use((req, res, next) => {
  const user = (req.session as any)?.user;
  console.log(`[API] ${req.method} ${req.url} - User: ${user ? user.email : 'None'}`);
  next();
});

// --- System Settings ---
apiRouter.get("/settings", (req, res) => {
  const settings = db.prepare("SELECT * FROM system_settings").all() as { key: string, value: string }[];
  const settingsMap = settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
  res.json(settingsMap);
});

apiRouter.post("/settings/test-ldap", async (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  let { url, bindDn, bindPassword, searchBase, usernameAttribute, testUsername, testPassword } = req.body;

  if (url && !url.startsWith('ldap://') && !url.startsWith('ldaps://')) {
    url = `ldap://${url}`;
  }

  try {
    const { authenticate } = require('ldap-authentication');
    
    const authOptions: any = {
      ldapOpts: { url },
      userPassword: testPassword,
      userSearchBase: searchBase,
      usernameAttribute: usernameAttribute || 'userPrincipalName',
      username: testUsername
    };

    if (bindDn) {
      authOptions.adminDn = bindDn;
      authOptions.adminPassword = bindPassword;
    }

    const user = await authenticate(authOptions);
    res.json({ success: true, user });
  } catch (err: any) {
    console.error("LDAP Test Error:", err);
    res.status(400).json({ error: err.message || "Authentication failed" });
  }
});

apiRouter.put("/settings", (req, res) => {
  const settings = req.body;
  try {
    const stmt = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    const updateMany = db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        stmt.run(key, String(value));
      }
    });
    updateMany(settings);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Holidays ---
apiRouter.get("/holidays", (req, res) => {
  const holidays = db.prepare("SELECT * FROM holidays ORDER BY date ASC").all();
  res.json(holidays);
});

apiRouter.post("/holidays", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });

  const { date, description } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO holidays (date, description) VALUES (?, ?)");
    const info = stmt.run(date, description);
    res.json({ id: info.lastInsertRowid, date, description });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put("/holidays/:id", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });

  const { id } = req.params;
  const { date, description } = req.body;
  try {
    const stmt = db.prepare("UPDATE holidays SET date = ?, description = ? WHERE id = ?");
    const info = stmt.run(date, description, id);
    if (info.changes === 0) return res.status(404).json({ error: "Holiday not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete("/holidays/:id", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });

  const { id } = req.params;
  try {
    const stmt = db.prepare("DELETE FROM holidays WHERE id = ?");
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Holiday not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Auth ---
apiRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("user-agent");

  try {
    let user = db.prepare(`
      SELECT u.*, d.name as department_name 
      FROM users u 
      JOIN departments d ON u.department_id = d.id
      WHERE u.email = ?
    `).get(email) as any;

    let isMatch = false;
    let usedLdap = false;
    let ldapUserObj: any = null;

    // Check LDAP first if enabled
    const ldapEnabled = db.prepare("SELECT value FROM system_settings WHERE key = 'ldap_enabled'").get() as any;
    
    if (ldapEnabled?.value === 'true') {
      try {
        const { authenticate } = require('ldap-authentication');
        const getSetting = (k: string) => (db.prepare("SELECT value FROM system_settings WHERE key = ?").get(k) as any)?.value;

        let url = getSetting('ldap_url');
        const adminDn = getSetting('ldap_bind_dn');
        const adminPassword = getSetting('ldap_bind_password');
        const userSearchBase = getSetting('ldap_search_base');
        const usernameAttribute = getSetting('ldap_username_attribute') || 'userPrincipalName';

        if (url && !url.startsWith('ldap://') && !url.startsWith('ldaps://')) {
          url = `ldap://${url}`;
        }

        if (url && userSearchBase) {
          const authOptions: any = {
            ldapOpts: { url },
            userPassword: password,
            userSearchBase,
            usernameAttribute,
            username: email
          };
          
          if (adminDn) {
            authOptions.adminDn = adminDn;
            authOptions.adminPassword = adminPassword;
          }

          ldapUserObj = await authenticate(authOptions);
          isMatch = true;
          usedLdap = true;
        }
      } catch (ldapErr) {
        console.error("LDAP Auth Error:", ldapErr);
        // Fallback to local auth if LDAP fails
      }
    }

    // If LDAP succeeded but user is not in local DB, auto-provision them
    if (usedLdap && !user) {
      // Get a default department (just use the first one available)
      const defaultDept = db.prepare("SELECT id FROM departments ORDER BY id ASC LIMIT 1").get() as any;
      const deptId = defaultDept ? defaultDept.id : 1;
      
      // Extract name from LDAP object if possible, otherwise use email prefix
      const fullName = ldapUserObj?.displayName || ldapUserObj?.cn || email.split('@')[0];
      
      // Generate a random password hash for local DB since they use AD
      const randomHash = await argon2.hash(crypto.randomBytes(32).toString('hex'));
      
      const insertStmt = db.prepare(`
        INSERT INTO users (full_name, email, password_hash, department_id, role, status, auth_provider)
        VALUES (?, ?, ?, ?, 'user', 'active', 'ldap')
      `);
      const info = insertStmt.run(fullName, email, randomHash, deptId);
      
      user = db.prepare(`
        SELECT u.*, d.name as department_name 
        FROM users u 
        JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `).get(info.lastInsertRowid) as any;
    } else if (usedLdap && user && user.auth_provider !== 'ldap') {
      // Update existing user to be an LDAP user if they successfully authenticated via LDAP
      db.prepare("UPDATE users SET auth_provider = 'ldap' WHERE id = ?").run(user.id);
      user.auth_provider = 'ldap';
    }

    if (!user) {
      // Log failed attempt
      db.prepare("INSERT INTO login_logs (email, ip_address, user_agent, success) VALUES (?, ?, ?, 0)").run(email, ip, userAgent);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      db.prepare("INSERT INTO login_logs (email, ip_address, user_agent, success, locked) VALUES (?, ?, ?, 0, 1)").run(email, ip, userAgent);
      return res.status(403).json({ error: "Account is temporarily locked due to too many failed attempts. Please try again later." });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: "Account is inactive" });
    }

    // Password verification with backward compatibility (Fallback to local DB)
    if (!isMatch && !usedLdap && user.auth_provider !== 'ldap') {
      if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
        // Old bcrypt hash
        isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
          // Upgrade to argon2
          const newHash = await argon2.hash(password);
          db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);
        }
      } else {
        // Argon2 hash
        try {
          isMatch = await argon2.verify(user.password_hash, password);
        } catch (e) {
          isMatch = false;
        }
      }
    }

    if (!isMatch) {
      // Increment failed attempts
      const newCount = (user.failed_login_count || 0) + 1;
      let lockedUntil = null;
      if (newCount >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      
      db.prepare("UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?").run(newCount, lockedUntil, user.id);
      
      // Log failed attempt
      db.prepare("INSERT INTO login_logs (email, ip_address, user_agent, success) VALUES (?, ?, ?, 0)").run(email, ip, userAgent);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Reset failed attempts on success
    db.prepare("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?").run(user.id);

    // Log successful attempt
    db.prepare("INSERT INTO login_logs (email, ip_address, user_agent, success) VALUES (?, ?, ?, 1)").run(email, ip, userAgent);

    const { password_hash, mfa_secret, ...userWithoutPassword } = user;
    
    // Set session user directly
    if (req.session) {
      (req.session as any).user = userWithoutPassword;
      res.json(userWithoutPassword);
    } else {
      res.json(userWithoutPassword);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ success: true });
    });
  } else {
    res.json({ success: true });
  }
});

apiRouter.get("/me", (req, res) => {
  if (req.session && (req.session as any).user) {
    res.json((req.session as any).user);
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

apiRouter.post("/change-password", async (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (sessionUser.auth_provider === 'ldap') {
    return res.status(403).json({ error: "Active Directory users cannot change their password through this system. Please use your organization's password reset tool." });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  try {
    const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(sessionUser.id) as any;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let isMatch = false;
    if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    } else {
      try {
        isMatch = await argon2.verify(user.password_hash, currentPassword);
      } catch (e) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    // validatePassword is defined further down, but we can just duplicate the logic or move it up.
    // Let's just use a simple validation here or move the validatePassword function up.
    // Wait, validatePassword is defined at line 239. I should move it up before this route.
    // Actually, I'll just do the validation inline to avoid moving code.
    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters long" });
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: "Password must contain at least one uppercase letter" });
    if (!/[a-z]/.test(newPassword)) return res.status(400).json({ error: "Password must contain at least one lowercase letter" });
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: "Password must contain at least one number" });
    if (!/[^A-Za-z0-9]/.test(newPassword)) return res.status(400).json({ error: "Password must contain at least one special character" });

    const hashedPassword = await argon2.hash(newPassword);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashedPassword, sessionUser.id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Users ---
apiRouter.get("/users", (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.role, u.status, u.department_id, u.auth_provider, d.name as department_name 
    FROM users u 
    JOIN departments d ON u.department_id = d.id
  `).all();
  res.json(users);
});

apiRouter.delete("/users/:id", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });
  }

  if (parseInt(req.params.id) === sessionUser.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    const targetUser = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (sessionUser.role === 'admin' && targetUser.role === 'super_admin') {
      return res.status(403).json({ error: "Admins cannot delete super_admins" });
    }

    // Also delete bookings and backup codes
    db.prepare("DELETE FROM bookings WHERE user_id = ?").run(req.params.id);
    db.prepare("DELETE FROM backup_codes WHERE user_id = ?").run(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    
    db.prepare("INSERT INTO user_logs (admin_id, target_user_id, action, details) VALUES (?, ?, ?, ?)").run(
      sessionUser.id, req.params.id, 'delete_user', `Deleted user ${targetUser.email || req.params.id}`
    );
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const validatePassword = (password: string) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character";
  return null;
};

apiRouter.post("/users", async (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });
  }

  const { full_name, email, password, department_id, role, status } = req.body;
  
  if (sessionUser.role === 'admin' && role === 'super_admin') {
    return res.status(403).json({ error: "Admins cannot create super_admins" });
  }

  try {
    const defaultPassword = password || "Password123!";
    const passwordError = validatePassword(defaultPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const hashedPassword = await argon2.hash(defaultPassword);
    
    const stmt = db.prepare("INSERT INTO users (full_name, email, password_hash, department_id, role, status) VALUES (?, ?, ?, ?, ?, ?)");
    const info = stmt.run(full_name, email, hashedPassword, department_id, role, status || 'active');
    
    db.prepare("INSERT INTO user_logs (admin_id, target_user_id, action, details) VALUES (?, ?, ?, ?)").run(
      sessionUser.id, info.lastInsertRowid, 'create_user', `Created user ${email} with role ${role}`
    );

    res.json({ id: info.lastInsertRowid, full_name, email, department_id, role, status });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put("/users/:id", async (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });
  }

  const { id } = req.params;
  const { full_name, email, password, department_id, role, status } = req.body;

  try {
    const targetUser = db.prepare("SELECT role, email FROM users WHERE id = ?").get(id) as any;
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (sessionUser.role === 'admin') {
      if (targetUser.role === 'super_admin') {
        return res.status(403).json({ error: "Admins cannot edit super_admins" });
      }
      if (role === 'super_admin') {
        return res.status(403).json({ error: "Admins cannot change role to super_admin" });
      }
    }

    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ error: passwordError });

      const hashedPassword = await argon2.hash(password);
      const stmt = db.prepare("UPDATE users SET full_name = ?, email = ?, password_hash = ?, department_id = ?, role = ?, status = ? WHERE id = ?");
      stmt.run(full_name, email, hashedPassword, department_id, role, status, id);
    } else {
      const stmt = db.prepare("UPDATE users SET full_name = ?, email = ?, department_id = ?, role = ?, status = ? WHERE id = ?");
      stmt.run(full_name, email, department_id, role, status, id);
    }
    
    db.prepare("INSERT INTO user_logs (admin_id, target_user_id, action, details) VALUES (?, ?, ?, ?)").run(
      sessionUser.id, id, 'update_user', `Updated user ${email}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Departments ---
apiRouter.get("/departments", (req, res) => {
  const departments = db.prepare("SELECT * FROM departments").all();
  res.json(departments);
});

apiRouter.post("/departments", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });
  }

  const { name } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO departments (name) VALUES (?)");
    const info = stmt.run(name);
    res.json({ id: info.lastInsertRowid, name });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put("/departments/:id", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });
  }

  const { id } = req.params;
  const { name } = req.body;
  try {
    const stmt = db.prepare("UPDATE departments SET name = ? WHERE id = ?");
    stmt.run(name, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete("/departments/:id", (req, res) => {
  const sessionUser = (req.session as any)?.user;
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'super_admin')) {
    return res.status(403).json({ error: "Unauthorized: You must be an admin. If you are logged in, your session may have expired or cookies are blocked." });
  }

  const { id } = req.params;
  try {
    // Check if there are users in this department
    const usersInDept = db.prepare("SELECT COUNT(*) as count FROM users WHERE department_id = ?").get(id) as any;
    if (usersInDept.count > 0) {
      return res.status(400).json({ error: "Cannot delete department with existing users" });
    }

    const stmt = db.prepare("DELETE FROM departments WHERE id = ?");
    stmt.run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Rooms ---
apiRouter.get("/rooms", (req, res) => {
  const rooms = db.prepare("SELECT * FROM rooms WHERE status != 'inactive'").all();
  res.json(rooms);
});

apiRouter.get("/rooms/:id/availability", (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  
  if (!date) return res.status(400).json({ error: "Date is required" });

  const bookings = db.prepare(`
    SELECT b.start_datetime, b.end_datetime, b.title, b.description, u.full_name as booked_by, d.name as department
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.room_id = ? AND date(b.start_datetime) = date(?) AND b.status = 'confirmed'
    ORDER BY b.start_datetime ASC
  `).all(id, date);

  res.json(bookings);
});

apiRouter.post("/rooms", (req, res) => {
  const { name, location, capacity } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO rooms (name, location, capacity) VALUES (?, ?, ?)");
    const info = stmt.run(name, location, capacity);
    res.json({ id: info.lastInsertRowid, name, location, capacity, status: 'active' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put("/rooms/:id", (req, res) => {
  const { id } = req.params;
  const { name, location, capacity, status } = req.body;
  try {
    const stmt = db.prepare("UPDATE rooms SET name = ?, location = ?, capacity = ?, status = ? WHERE id = ?");
    stmt.run(name, location, capacity, status, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete("/rooms/:id", (req, res) => {
  const roomId = parseInt(req.params.id);
  try {
    // Check if there are any CONFIRMED bookings for this room
    // If there are only cancelled or completed bookings, we might allow deletion 
    // depending on how strict the user wants to be. 
    // "if the the room have booking already" usually implies active ones.
    const activeBookingCount = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE room_id = ? AND status = 'confirmed'").get(roomId) as { count: number };
    
    if (activeBookingCount.count > 0) {
      return res.status(400).json({ error: "Cannot delete room that has active confirmed bookings. Please cancel them first." });
    }

    // Mark as inactive (effectively deleted from the app)
    const stmt = db.prepare("UPDATE rooms SET status = 'inactive' WHERE id = ?");
    const info = stmt.run(roomId);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Bookings ---
apiRouter.get("/bookings", (req, res) => {
  const { room_id, date, start, end } = req.query;
  
  let query = `
    SELECT b.*, u.full_name as user_name, d.name as department_name, r.name as room_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN departments d ON b.department_id = d.id
    JOIN rooms r ON b.room_id = r.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (room_id) {
    query += " AND b.room_id = ?";
    params.push(room_id);
  }

  if (date) {
    query += " AND date(b.start_datetime) = date(?)";
    params.push(date);
  }

  if (start && end) {
    query += " AND date(b.start_datetime) >= date(?) AND date(b.start_datetime) <= date(?)";
    params.push(start, end);
  }

  query += " ORDER BY b.start_datetime ASC";

  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

apiRouter.post("/bookings", async (req, res) => {
  const { room_id, user_id, title, description, start_datetime, end_datetime, is_range, end_date, refreshment_request, participant_count } = req.body;

  // Check if room and user are active
  const room = db.prepare("SELECT name, status FROM rooms WHERE id = ?").get(room_id) as any;
  if (!room || room.status !== 'active') {
    return res.status(400).json({ error: "Room is not active" });
  }

  const user = db.prepare("SELECT full_name, status, department_id FROM users WHERE id = ?").get(user_id) as any;
  if (!user || user.status !== 'active') {
    return res.status(400).json({ error: "User is not active" });
  }

  const datesToBook: { start: string, end: string }[] = [];
  
  if (is_range && end_date) {
    let current = new Date(start_datetime);
    const end = new Date(end_date);
    const startTimeStr = start_datetime.split('T')[1];
    const endTimeStr = end_datetime.split('T')[1];

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      datesToBook.push({
        start: `${dateStr}T${startTimeStr}`,
        end: `${dateStr}T${endTimeStr}`
      });
      current.setDate(current.getDate() + 1);
    }
  } else {
    datesToBook.push({ start: start_datetime, end: end_datetime });
  }

  // 1. Time Validation
  for (const dates of datesToBook) {
    if (new Date(dates.end) <= new Date(dates.start)) {
      return res.status(400).json({ error: "End time must be after start time" });
    }
    if (new Date(dates.start) < new Date()) {
      return res.status(400).json({ error: "Cannot book in the past" });
    }
    
    // Check if date is a holiday
    const dateStr = dates.start.split('T')[0];
    const holiday = db.prepare("SELECT description FROM holidays WHERE date = ?").get(dateStr) as any;
    if (holiday) {
      return res.status(400).json({ error: `Cannot book on a holiday: ${holiday.description} (${dateStr})` });
    }
  }

  // 2. Conflict Prevention
  const conflictQuery = `
    SELECT start_datetime
    FROM bookings
    WHERE room_id = ?
    AND status = 'confirmed'
    AND start_datetime < ?
    AND end_datetime > ?
  `;
  
  const conflicts = [];
  for (const dates of datesToBook) {
    const conflict = db.prepare(conflictQuery).get(room_id, dates.end, dates.start) as any;
    if (conflict) {
      conflicts.push(dates.start.split('T')[0]);
    }
  }

  if (conflicts.length > 0) {
    return res.status(409).json({ 
      error: "Room is already booked for these dates: " + conflicts.join(", ") 
    });
  }

  // 3. Insert Bookings
  try {
    const stmt = db.prepare(`
      INSERT INTO bookings (room_id, user_id, department_id, title, description, start_datetime, end_datetime, refreshment_request, participant_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertLog = db.prepare("INSERT INTO booking_logs (booking_id, user_id, action, details) VALUES (?, ?, ?, ?)");
    
    const results = db.transaction((bookings) => {
      const ids = [];
      for (const b of bookings) {
        const info = stmt.run(room_id, user_id, user.department_id, title, description, b.start, b.end, refreshment_request ? 1 : 0, participant_count || 0);
        const bookingId = info.lastInsertRowid;
        ids.push(bookingId);
        insertLog.run(bookingId, user_id, 'create', `Created booking for room ${room_id} from ${b.start} to ${b.end}`);
      }
      return ids;
    })(datesToBook);

    // Send Telegram Notification if refreshment requested
    if (refreshment_request) {
      try {
        const tokenSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_bot_token'").get() as any;
        const chatIdSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_chat_id'").get() as any;
        
        if (tokenSetting?.value && chatIdSetting?.value) {
          const message = `🔔 *New Refreshment Request*\n\n` +
            `*Meeting:* ${title}\n` +
            `*Room:* ${room.name}\n` +
            `*Date:* ${start_datetime.split('T')[0]}\n` +
            `*Time:* ${start_datetime.split('T')[1]} - ${end_datetime.split('T')[1]}\n` +
            `*Participants:* ${participant_count}\n` +
            `*Requested By:* ${user.full_name}`;

          fetch(`https://api.telegram.org/bot${tokenSetting.value}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatIdSetting.value,
              text: message,
              parse_mode: 'Markdown'
            })
          }).catch(err => console.error("Telegram notification failed:", err));
        }
      } catch (err) {
        console.error("Failed to send Telegram notification:", err);
      }
    }

    res.json({ success: true, booking_ids: results });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put("/bookings/:id", (req, res) => {
  const { id } = req.params;
  const { title, description, start_datetime, end_datetime, status } = req.body;
  
  // If updating time, check conflicts and holidays
  if (start_datetime && end_datetime) {
    if (new Date(end_datetime) <= new Date(start_datetime)) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    if (new Date(start_datetime) < new Date()) {
      return res.status(400).json({ error: "Cannot move booking to the past" });
    }
    
    // Check if date is a holiday
    const dateStr = start_datetime.split('T')[0];
    const holiday = db.prepare("SELECT description FROM holidays WHERE date = ?").get(dateStr) as any;
    if (holiday) {
      return res.status(400).json({ error: `Cannot book on a holiday: ${holiday.description} (${dateStr})` });
    }
    
    const booking = db.prepare("SELECT room_id FROM bookings WHERE id = ?").get(id) as any;
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const conflictQuery = `
      SELECT 1
      FROM bookings
      WHERE room_id = ?
      AND id != ?
      AND status = 'confirmed'
      AND start_datetime < ?
      AND end_datetime > ?
    `;
    const conflict = db.prepare(conflictQuery).get(booking.room_id, id, end_datetime, start_datetime);
    
    if (conflict) {
      return res.status(409).json({ error: "Room is already booked for this time period" });
    }
  }

  try {
    const stmt = db.prepare(`
      UPDATE bookings 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          start_datetime = COALESCE(?, start_datetime),
          end_datetime = COALESCE(?, end_datetime),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    // Check if status is being changed to cancelled to send Telegram notification
    if (status === 'cancelled') {
      try {
        const fullBooking = db.prepare(`
          SELECT b.*, r.name as room_name, u.full_name as user_name
          FROM bookings b
          JOIN rooms r ON b.room_id = r.id
          JOIN users u ON b.user_id = u.id
          WHERE b.id = ?
        `).get(id) as any;

        if (fullBooking && fullBooking.refreshment_request) {
          const tokenSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_bot_token'").get() as any;
          const chatIdSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_chat_id'").get() as any;
          
          if (tokenSetting?.value && chatIdSetting?.value) {
            const message = `❌ *Refreshment Request CANCELLED (via Update)*\n\n` +
              `*Meeting:* ${fullBooking.title}\n` +
              `*Room:* ${fullBooking.room_name}\n` +
              `*Date:* ${fullBooking.start_datetime.split('T')[0]}\n` +
              `*Time:* ${fullBooking.start_datetime.split('T')[1]} - ${fullBooking.end_datetime.split('T')[1]}\n` +
              `*Updated By:* System`;

            fetch(`https://api.telegram.org/bot${tokenSetting.value}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatIdSetting.value,
                text: message,
                parse_mode: 'Markdown'
              })
            }).catch(err => console.error("Telegram notification failed:", err));
          }
        }
      } catch (err) {
        console.error("Failed to send Telegram cancellation notification:", err);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get("/my-bookings", (req, res) => {
  const { user_id } = req.query;
  
  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  const bookings = db.prepare(`
    SELECT b.*, r.name as room_name, d.name as department_name, u.full_name as user_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN departments d ON b.department_id = d.id
    JOIN users u ON b.user_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.start_datetime DESC
  `).all(user_id);

  res.json(bookings);
});

apiRouter.delete("/bookings/:id", (req, res) => {
  const bookingId = parseInt(req.params.id);
  const userIdStr = req.query.user_id as string;
  
  try {
    const booking = db.prepare("SELECT user_id, status FROM bookings WHERE id = ?").get(bookingId) as any;
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    // Authorization check
    if (userIdStr && userIdStr !== "undefined") {
      const userId = parseInt(userIdStr);
      const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as any;
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.role !== 'admin' && booking.user_id !== userId) {
        return res.status(403).json({ error: "You are not authorized to cancel this booking." });
      }
    } else {
      // If no user_id is provided, we should probably block it for security, 
      // but I'll allow it for now to avoid breaking the UI if user_id is missing.
      // Actually, let's be strict.
      return res.status(401).json({ error: "Authentication required" });
    }

    const stmt = db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(bookingId);
    db.prepare("INSERT INTO booking_logs (booking_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(bookingId, userIdStr || booking.user_id, 'cancel', `Cancelled booking ${bookingId}`);

    // Send Telegram Notification if refreshment was requested
    try {
      const fullBooking = db.prepare(`
        SELECT b.*, r.name as room_name, u.full_name as user_name
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN users u ON b.user_id = u.id
        WHERE b.id = ?
      `).get(bookingId) as any;

      if (fullBooking && fullBooking.refreshment_request) {
        const tokenSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_bot_token'").get() as any;
        const chatIdSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_chat_id'").get() as any;
        
        if (tokenSetting?.value && chatIdSetting?.value) {
          const message = `❌ *Refreshment Request CANCELLED*\n\n` +
            `*Meeting:* ${fullBooking.title}\n` +
            `*Room:* ${fullBooking.room_name}\n` +
            `*Date:* ${fullBooking.start_datetime.split('T')[0]}\n` +
            `*Time:* ${fullBooking.start_datetime.split('T')[1]} - ${fullBooking.end_datetime.split('T')[1]}\n` +
            `*Cancelled By:* ${userIdStr ? (db.prepare("SELECT full_name FROM users WHERE id = ?").get(userIdStr) as any)?.full_name : 'System'}`;

          fetch(`https://api.telegram.org/bot${tokenSetting.value}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatIdSetting.value,
              text: message,
              parse_mode: 'Markdown'
            })
          }).catch(err => console.error("Telegram notification failed:", err));
        }
      }
    } catch (err) {
      console.error("Failed to send Telegram cancellation notification:", err);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
