import Database from "better-sqlite3";
import path from "path";
import * as argon2 from "argon2";

const dbPath = path.resolve(process.cwd(), "database.sqlite");
export const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');
db.pragma('journal_mode = WAL');

export async function setupDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      role TEXT CHECK(role IN ('super_admin', 'admin', 'user')) NOT NULL DEFAULT 'user',
      status TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
      failed_login_count INTEGER DEFAULT 0,
      locked_until DATETIME,
      mfa_secret TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT CHECK(status IN ('active', 'maintenance', 'inactive')) NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_datetime DATETIME NOT NULL,
      end_datetime DATETIME NOT NULL,
      status TEXT CHECK(status IN ('confirmed', 'cancelled', 'completed')) NOT NULL DEFAULT 'confirmed',
      refreshment_request INTEGER DEFAULT 0,
      participant_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      success INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backup_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS booking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL, -- 'create', 'update', 'cancel'
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      target_user_id INTEGER,
      action TEXT NOT NULL, -- 'create', 'update', 'delete'
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_room_time ON bookings (room_id, start_datetime, end_datetime);
    CREATE INDEX IF NOT EXISTS idx_room_time_status ON bookings (room_id, start_datetime, end_datetime, status);
    CREATE INDEX IF NOT EXISTS idx_user ON bookings (user_id);
    CREATE INDEX IF NOT EXISTS idx_department ON bookings (department_id);
  `);

  // Add missing columns to users table if they don't exist (migration)
  const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes("failed_login_count")) {
    db.exec("ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0");
  }
  if (!columnNames.includes("locked_until")) {
    db.exec("ALTER TABLE users ADD COLUMN locked_until DATETIME");
  }
  if (!columnNames.includes("mfa_secret")) {
    db.exec("ALTER TABLE users ADD COLUMN mfa_secret TEXT");
  }
  if (!columnNames.includes("mfa_enabled")) {
    db.exec("ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0");
  }

  // Add missing columns to bookings table if they don't exist (migration)
  const bookingColumns = db.prepare("PRAGMA table_info(bookings)").all() as any[];
  const bookingColumnNames = bookingColumns.map(c => c.name);

  if (!bookingColumnNames.includes("refreshment_request")) {
    db.exec("ALTER TABLE bookings ADD COLUMN refreshment_request INTEGER DEFAULT 0");
  }
  if (!bookingColumnNames.includes("participant_count")) {
    db.exec("ALTER TABLE bookings ADD COLUMN participant_count INTEGER DEFAULT 0");
  }

  // Migration: Ensure users table allows super_admin role
  const usersTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
  if (usersTableInfo && usersTableInfo.sql.includes("'admin', 'user'")) {
    db.exec(`
      PRAGMA foreign_keys=off;
      BEGIN TRANSACTION;
      CREATE TABLE IF NOT EXISTS users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        role TEXT CHECK(role IN ('super_admin', 'admin', 'user')) NOT NULL DEFAULT 'user',
        status TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
        failed_login_count INTEGER DEFAULT 0,
        locked_until DATETIME,
        mfa_secret TEXT,
        mfa_enabled INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );
      INSERT INTO users_new (id, full_name, email, password_hash, department_id, role, status, failed_login_count, locked_until, mfa_secret, mfa_enabled, created_at) 
      SELECT id, full_name, email, password_hash, department_id, role, status, failed_login_count, locked_until, mfa_secret, mfa_enabled, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      COMMIT;
      PRAGMA foreign_keys=on;
    `);
  }

  // Migration: Ensure admin password is using Argon2
  const admin = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@example.com") as any;
  if (admin) {
    if (!admin.password_hash.startsWith("$argon2")) {
      const newHash = await argon2.hash("password123");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, admin.id);
    }
    if (admin.role !== 'super_admin') {
      db.prepare("UPDATE users SET role = 'super_admin' WHERE id = ?").run(admin.id);
    }
  }

  // Migration: Add new departments
  const newDepts = [
    "IDENTITY & APPLICATION SECURITY",
    "DATA & INFORMATION SECURITY",
    "SYSTEM SECURITY",
    "SECURITY INFRASTRUCTURE",
    "NETWORK INFRASTRUCTURE",
    "SYSTEM & SERVER",
    "HR & Admin",
    "Sale",
    "Accountant"
  ];
  const insertDept = db.prepare("INSERT OR IGNORE INTO departments (name) VALUES (?)");
  newDepts.forEach((d) => insertDept.run(d));

  // Seed initial data if empty
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users (full_name, email, password_hash, department_id, role) VALUES (?, ?, ?, ?, ?)"
    );
    const defaultPassword = await argon2.hash("password123");
    insertUser.run("Admin User", "admin@example.com", defaultPassword, 1, "super_admin");
    insertUser.run("John Doe", "john@example.com", defaultPassword, 1, "user");
    insertUser.run("Jane Smith", "jane@example.com", defaultPassword, 2, "user");

    const insertRoom = db.prepare(
      "INSERT INTO rooms (name, location, capacity) VALUES (?, ?, ?)"
    );
    insertRoom.run("Apollo", "Floor 1", 10);
    insertRoom.run("Gemini", "Floor 2", 20);
    insertRoom.run("Mercury", "Floor 1", 5);
  }

  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM system_settings").get() as { count: number };
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
    insertSetting.run("work_start_time", "08:00");
    insertSetting.run("work_end_time", "18:00");
    insertSetting.run("slot_duration_minutes", "60");
  }
}
