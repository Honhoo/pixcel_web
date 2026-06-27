const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const rootDir = path.resolve(__dirname, "..");
const contentPath = path.join(rootDir, "src", "content", "workCases.json");
const assetsCasesDir = path.join(rootDir, "public", "assets", "cases");
const port = Number(process.env.ADMIN_PORT || 5174);

app.use(express.json({ limit: "10mb" }));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readCases() {
  const raw = fs.readFileSync(contentPath, "utf8");
  return JSON.parse(raw);
}

function writeCases(cases) {
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

function assertCaseId(caseId) {
  const id = safeSlug(caseId);
  if (!id) {
    const error = new Error("缺少案例 ID");
    error.status = 400;
    throw error;
  }
  return id;
}

const storage = multer.diskStorage({
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
    const ext = path.extname(file.originalname);
    const base = safeSlug(path.basename(file.originalname, ext)) || "asset";
    cb(null, `${Date.now()}-${base}${ext.toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

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
      return res.status(400).json({ error: "案例数据必须是数组" });
    }
    writeCases(req.body);
    res.json({ ok: true, cases: req.body });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/upload", upload.array("files"), (req, res, next) => {
  try {
    const caseId = assertCaseId(req.body.caseId || req.query.caseId);
    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      path: `/assets/cases/${caseId}/${file.filename}`,
      type: file.mimetype.startsWith("video/") ? "video" : "image",
    }));
    res.json({ files });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/file", (req, res, next) => {
  try {
    const assetPath = String(req.query.path || "");
    if (!assetPath.startsWith("/assets/cases/")) {
      return res.status(400).json({ error: "只能删除案例素材目录中的文件" });
    }
    const absolutePath = path.resolve(rootDir, "public", assetPath.replace(/^\//, ""));
    if (!absolutePath.startsWith(assetsCasesDir)) {
      return res.status(400).json({ error: "文件路径不合法" });
    }
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "后台服务错误" });
});

app.listen(port, () => {
  ensureDir(assetsCasesDir);
  console.log(`Case admin server running at http://localhost:${port}`);
});
