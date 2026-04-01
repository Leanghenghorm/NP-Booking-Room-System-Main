import express from "express";
import { createServer as createViteServer } from "vite";
import { setupDb } from "./src/db_bak";
import { apiRouter } from "./src/api_bak";
import helmet from "helmet";
import session from "express-session";
import rateLimit from "express-rate-limit";

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: any;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3001;

  // Security Headers
  app.use(helmet({
  strictTransportSecurity: false, // Disable HSTS for http
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://picsum.photos", "https://*.run.app"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "frame-ancestors": ["'self'", "https://*.run.app", "https://*.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));


  app.use(express.json());

  // Sessions
  app.use(session({
    secret: process.env.SESSION_SECRET || "roombook-secret-key-123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000 // 30 minutes
    }
  }));

  // Rate Limiting for Login
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 login requests per window
    message: { error: "Too many login attempts, please try again after 5 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Setup database
  setupDb();

  // API routes FIRST
  app.use("/api/login", loginLimiter);
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
    res.sendFile("dist/index.html", { root: process.cwd() });
  });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
