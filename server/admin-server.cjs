const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const rootDir = path.resolve(__dirname, "..");
const defaultContentPath = path.join(rootDir, "public", "content", "workCases.json");
const legacyContentPath = path.join(rootDir, "src", "content", "workCases.json");
const contentPath = path.resolve(process.env.CASES_CONTENT_PATH || defaultContentPath);
const assetsCasesDir = path.join(rootDir, "public", "assets", "cases");
const port = Number(process.env.ADMIN_PORT || 5174);

const adminUsername = process.env.ADMIN_USERNAME || "huanghao";
const adminPassword = process.env.ADMIN_PASSWORD || "19930315";
const sessionCookieName = "vp_admin_session";
const sessions = new Map();

const cosConfig = {
  secretId: process.env.COS_SECRET_ID,
  secretKey: process.env.COS_SECRET_KEY,
  bucket: process.env.COS_BUCKET,
  region: process.env.COS_REGION,
  publicBaseUrl: (process.env.COS_PUBLIC_BASE_URL || "").replace(/\/$/, ""),
};
const useCos = Boolean(cosConfig.secretId && cosConfig.secretKey && cosConfig.bucket && cosConfig.region);
const cos = useCos
  ? new (require("cos-nodejs-sdk-v5"))({
      SecretId: cosConfig.secretId,
      SecretKey: cosConfig.secretKey,
    })
  : null;

app.use(express.json({ limit: "10mb" }));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureContentFile() {
  ensureDir(path.dirname(contentPath));
  if (fs.existsSync(contentPath)) return;
  const source = fs.existsSync(defaultContentPath) ? defaultContentPath : legacyContentPath;
  fs.copyFileSync(source, contentPath);
}

function readCases() {
  ensureContentFile();
  const raw = fs.readFileSync(contentPath, "utf8");
  return JSON.parse(raw);
}

function writeCases(cases) {
  ensureContentFile();
  fs.writeFileSync(contentPath, `${JSON.stringify(cases, null, 2)}\n`, "utf8");
}

function safeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function safeFilename(originalName) {
  const ext = path.extname(originalName);
  const base = safeSlug(path.basename(originalName, ext)) || "asset";
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base}${ext.toLowerCase()}`;
}

function assertCaseId(caseId) {
  const id = safeSlug(caseId);
  if (!id) {
    const error = new Error("Missing case ID");
    error.status = 400;
    throw error;
  }
  return id;
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const index = item.indexOf("=");
      if (index === -1) return cookies;
      cookies[item.slice(0, index)] = decodeURIComponent(item.slice(index + 1));
      return cookies;
    }, {});
}

function setSessionCookie(res, token) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function requireAuth(req, res, next) {
  const token = parseCookies(req)[sessionCookieName];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function cosPublicPath(key) {
  if (cosConfig.publicBaseUrl) return `${cosConfig.publicBaseUrl}/${key}`;
  return `https://${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com/${key}`;
}

function putCosObject(params) {
  return new Promise((resolve, reject) => {
    cos.putObject(params, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function deleteCosObject(key) {
  return new Promise((resolve, reject) => {
    cos.deleteObject(
      {
        Bucket: cosConfig.bucket,
        Region: cosConfig.region,
        Key: key,
      },
      (error, data) => {
        if (error) reject(error);
        else resolve(data);
      },
    );
  });
}

function getCosKey(assetPath) {
  if (!assetPath) return "";
  if (cosConfig.publicBaseUrl && assetPath.startsWith(`${cosConfig.publicBaseUrl}/`)) {
    return assetPath.slice(cosConfig.publicBaseUrl.length + 1);
  }
  const defaultBase = `https://${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com/`;
  if (assetPath.startsWith(defaultBase)) return assetPath.slice(defaultBase.length);
  if (assetPath.startsWith("/assets/cases/")) return assetPath.replace(/^\//, "");
  return "";
}

const diskStorage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      const caseId = assertCaseId(req.body.caseId || req.query.caseId);
      const destination = path.join(assetsCasesDir, caseId);
      ensureDir(destination);
      cb(null, destination);
    } catch (error) {
      cb(error);
    }
  },
  filename(req, file, cb) {
    cb(null, safeFilename(file.originalname));
  },
});

const upload = multer({
  storage: useCos ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.post("/api/admin/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now() });
  setSessionCookie(res, token);
  res.json({ ok: true });
});

app.get("/api/admin/session", requireAuth, (req, res) => {
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const token = parseCookies(req)[sessionCookieName];
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.use("/api/admin", requireAuth);

app.get("/api/admin/cases", (req, res, next) => {
  try {
    res.json(readCases());
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/cases", (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Cases payload must be an array" });
    }
    writeCases(req.body);
    res.json({ ok: true, cases: req.body });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/upload", upload.array("files"), async (req, res, next) => {
  try {
    const caseId = assertCaseId(req.body.caseId || req.query.caseId);
    const files = [];

    for (const file of req.files || []) {
      const type = file.mimetype.startsWith("video/") ? "video" : "image";
      if (useCos) {
        const filename = safeFilename(file.originalname);
        const key = `assets/cases/${caseId}/${filename}`;
        await putCosObject({
          Bucket: cosConfig.bucket,
          Region: cosConfig.region,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        });
        files.push({
          originalName: file.originalname,
          path: cosPublicPath(key),
          type,
        });
      } else {
        files.push({
          originalName: file.originalname,
          path: `/assets/cases/${caseId}/${file.filename}`,
          type,
        });
      }
    }

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/file", async (req, res, next) => {
  try {
    const assetPath = String(req.query.path || "");
    if (useCos && (assetPath.startsWith("http://") || assetPath.startsWith("https://"))) {
      const key = getCosKey(assetPath);
      if (!key.startsWith("assets/cases/")) {
        return res.status(400).json({ error: "Invalid COS asset path" });
      }
      await deleteCosObject(key);
      return res.json({ ok: true });
    }

    if (!assetPath.startsWith("/assets/cases/")) {
      return res.status(400).json({ error: "Only case assets can be deleted" });
    }
    const absolutePath = path.resolve(rootDir, "public", assetPath.replace(/^\//, ""));
    if (!absolutePath.startsWith(assetsCasesDir)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Admin server error" });
});

app.listen(port, () => {
  ensureDir(assetsCasesDir);
  ensureContentFile();
  console.log(`Case admin server running at http://localhost:${port}`);
  console.log(`Case content file: ${contentPath}`);
  console.log(`Asset mode: ${useCos ? "Tencent COS" : "local disk"}`);
});
