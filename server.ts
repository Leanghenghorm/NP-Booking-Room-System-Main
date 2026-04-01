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

  // Trust proxy for rate limiting and secure cookies
  // Cloud Run uses multiple proxies, so 'true' is recommended.
  app.set('trust proxy', true);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://picsum.photos", "https://*.run.app"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite
        "frame-ancestors": [
          "'self'", 
          "https://*.run.app", 
          "https://*.google.com", 
          "https://ais-pre-ormwg63vtsfjbsvdhdy4iu-278562898323.asia-southeast1.run.app",
          "https://ais-dev-ormwg63vtsfjbsvdhdy4iu-278562898323.asia-southeast1.run.app"
        ], // Allow AI Studio preview
      },
    },
    crossOriginEmbedderPolicy: false, // Needed for some Vite assets
    frameguard: false, // Disable X-Frame-Options to allow iframe preview
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }));

  app.use(express.json());

  // Determine if we should use secure cookies.
  // In AI Studio, we need secure: true and sameSite: "none".
  // On a plain HTTP server, we need secure: false and sameSite: "lax".
  const useSecureCookies = process.env.INSECURE_COOKIES !== "true";

  // Sessions
  app.use(session({
    secret: process.env.SESSION_SECRET || "roombook-secret-key-123",
    resave: true, // Set to true for better session persistence in some environments
    saveUninitialized: true, // Set to true to ensure session is created
    cookie: {
      secure: useSecureCookies, // Required for SameSite=None
      httpOnly: true,
      sameSite: useSecureCookies ? "none" : "lax", // Required for cross-origin iframe
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Session Logging
  app.use((req, res, next) => {
    const oldWriteHead = res.writeHead;
    res.writeHead = function(statusCode, ...args) {
      const setCookie = res.get('Set-Cookie');
      if (setCookie) {
        console.log(`[Cookie] Set-Cookie: ${Array.isArray(setCookie) ? setCookie.join(', ') : setCookie}`);
      }
      return oldWriteHead.apply(this, [statusCode, ...args]);
    };

    if (req.session) {
      const user = (req.session as any).user;
      console.log(`[Session] ID: ${req.sessionID}, User: ${user?.email || 'Guest'}, Proto: ${req.get('x-forwarded-proto')}, Secure: ${req.secure}`);
    }
    next();
  });

  // Rate Limiting for Login
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Increased for development
    message: { error: "Too many login attempts" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Setup database
  await setupDb();

  // API routes FIRST
  app.get("/api/debug", (req, res) => res.json({ message: "API is working", user: (req.session as any)?.user }));
  
  // app.use("/api/login", loginLimiter);
  app.use("/api", apiRouter);
  
  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(err.status || 500).json({ 
      error: err.message || "Internal Server Error",
      details: process.env.NODE_ENV !== "production" ? err.stack : undefined
    });
  });
  
  // API 404 handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
