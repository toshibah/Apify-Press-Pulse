import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("mentions.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'company', 'person', 'brand'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT,
    published_at TEXT,
    sentiment TEXT, -- 'positive', 'neutral', 'negative'
    sentiment_score INTEGER, -- 0 to 100
    sentiment_reason TEXT,
    summary TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities(id)
  );
`);

// Migration for existing databases
try { db.exec("ALTER TABLE mentions ADD COLUMN sentiment_score INTEGER DEFAULT 50"); } catch (e) {}
try { db.exec("ALTER TABLE mentions ADD COLUMN sentiment_reason TEXT"); } catch (e) {}

// Seed initial data if empty
const entityCount = db.prepare("SELECT COUNT(*) as count FROM entities").get() as { count: number };
if (entityCount.count === 0) {
  const seedEntities = [
    { name: 'Google', type: 'company' },
    { name: 'Apple', type: 'company' },
    { name: 'Elon Musk', type: 'person' },
  ];
  const insert = db.prepare("INSERT INTO entities (name, type) VALUES (?, ?)");
  seedEntities.forEach(e => insert.run(e.name, e.type));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/entities", (req, res) => {
    const entities = db.prepare("SELECT * FROM entities ORDER BY name ASC").all();
    res.json(entities);
  });

  app.post("/api/entities", (req, res) => {
    const { name, type } = req.body;
    const result = db.prepare("INSERT INTO entities (name, type) VALUES (?, ?)").run(name, type);
    res.json({ id: result.lastInsertRowid, name, type });
  });

  app.delete("/api/entities/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM mentions WHERE entity_id = ?").run(id);
    db.prepare("DELETE FROM entities WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/mentions/:entityId", (req, res) => {
    const { entityId } = req.params;
    const mentions = db.prepare("SELECT * FROM mentions WHERE entity_id = ? ORDER BY id DESC").all(entityId);
    res.json(mentions);
  });

  app.post("/api/mentions", (req, res) => {
    const { entity_id, title, url, source, published_at, sentiment, sentiment_score, sentiment_reason, summary } = req.body;
    const result = db.prepare(`
      INSERT INTO mentions (entity_id, title, url, source, published_at, sentiment, sentiment_score, sentiment_reason, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entity_id, title, url, source, published_at, sentiment, sentiment_score || 50, sentiment_reason || "", summary);
    res.json({ id: result.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
