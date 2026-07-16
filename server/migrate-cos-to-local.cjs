const fs = require("fs");
const https = require("https");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contentPath = path.resolve(process.env.CASES_CONTENT_PATH || path.join(rootDir, "public", "content", "workCases.json"));
const assetsCasesDir = path.resolve(process.env.CASES_ASSETS_DIR || path.join(rootDir, "public", "assets", "cases"));
const cosBaseUrl = String(process.env.COS_PUBLIC_BASE_URL || "").replace(/\/$/, "");

if (!cosBaseUrl) {
  console.error("Missing COS_PUBLIC_BASE_URL. Example: COS_PUBLIC_BASE_URL=https://bucket.cos.region.myqcloud.com");
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isCosAsset(value) {
  return typeof value === "string" && value.startsWith(`${cosBaseUrl}/assets/cases/`);
}

function toLocalAssetPath(url) {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname);
}

function toDiskPath(assetPath) {
  const relativePath = assetPath.replace(/^\/assets\/cases\/?/, "");
  return path.resolve(assetsCasesDir, relativePath);
}

function isInsideDir(filePath, dirPath) {
  const relativePath = path.relative(dirPath, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function collectCosUrls(value, urls = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCosUrls(item, urls));
    return urls;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectCosUrls(item, urls));
    return urls;
  }

  if (isCosAsset(value)) urls.add(value);
  return urls;
}

function replaceCosUrls(value) {
  if (Array.isArray(value)) return value.map(replaceCosUrls);

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceCosUrls(item)]));
  }

  return isCosAsset(value) ? toLocalAssetPath(value) : value;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destination)) {
      resolve("skipped");
      return;
    }

    ensureDir(path.dirname(destination));
    const file = fs.createWriteStream(destination);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close(() => fs.rmSync(destination, { force: true }));
          reject(new Error(`Download failed ${response.statusCode}: ${url}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => file.close(() => resolve("downloaded")));
      })
      .on("error", (error) => {
        file.close(() => fs.rmSync(destination, { force: true }));
        reject(error);
      });
  });
}

async function main() {
  const cases = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  const urls = Array.from(collectCosUrls(cases));

  console.log(`Found ${urls.length} COS asset url(s).`);

  for (const url of urls) {
    const assetPath = toLocalAssetPath(url);
    const diskPath = toDiskPath(assetPath);
    if (!isInsideDir(diskPath, assetsCasesDir)) {
      throw new Error(`Invalid asset path: ${assetPath}`);
    }
    const result = await download(url, diskPath);
    console.log(`${result}: ${assetPath}`);
  }

  const migratedCases = replaceCosUrls(cases);
  fs.writeFileSync(contentPath, `${JSON.stringify(migratedCases, null, 2)}\n`, "utf8");
  console.log(`Updated content file: ${contentPath}`);
  console.log(`Local assets directory: ${assetsCasesDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
