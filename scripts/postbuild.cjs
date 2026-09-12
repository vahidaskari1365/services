/**
 * postbuild — کپی فایل‌های استاتیک داخل standalone (فقط اگر standalone موجود باشد).
 * روی Vercel این مرحله لازم نیست و به‌صورت خودکار رد می‌شود.
 */
const fs = require("fs");
const path = require("path");

const standalone = path.join(".next", "standalone");
if (fs.existsSync(standalone)) {
  const staticDir = path.join(".next", "static");
  if (fs.existsSync(staticDir)) {
    fs.cpSync(staticDir, path.join(standalone, ".next", "static"), { recursive: true });
    console.log("[postbuild] static → standalone copied");
  }
  if (fs.existsSync("public")) {
    fs.cpSync("public", path.join(standalone, "public"), { recursive: true });
    console.log("[postbuild] public → standalone copied");
  }
} else {
  console.log("[postbuild] no standalone output — skipped");
}
