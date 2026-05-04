// PDF 생성에 필요한 NanumGothic 폰트(ttf)를 자동 다운로드한다.
// 라이센스: SIL Open Font License (Naver/Google Fonts 공식 배포)
// 정상적인 ttf가 이미 있으면 스킵한다. 네트워크 실패 시에도 install은 실패시키지 않는다.

const fs = require("fs");
const path = require("path");
const https = require("https");

const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts");
const FONTS = [
  {
    name: "NanumGothic-Regular.ttf",
    url: "https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Regular.ttf",
  },
  {
    name: "NanumGothic-Bold.ttf",
    url: "https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Bold.ttf",
  },
];

function isValidTtf(file) {
  if (!fs.existsSync(file)) return false;
  if (fs.statSync(file).size < 50000) return false;
  const buf = Buffer.alloc(4);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  // TTF magic numbers: 00 01 00 00 (TrueType), "true", "OTTO" (OpenType)
  const hex = buf.toString("hex");
  const ascii = buf.toString("ascii");
  return hex === "00010000" || ascii === "true" || ascii === "OTTO";
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Too many redirects"));
    https
      .get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          return download(res.headers.location, dest, redirects + 1).then(
            resolve,
            reject,
          );
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

  for (const font of FONTS) {
    const dest = path.join(FONTS_DIR, font.name);
    if (isValidTtf(dest)) {
      console.log(`[fonts] ${font.name} already valid, skip`);
      continue;
    }
    if (fs.existsSync(dest)) {
      console.log(`[fonts] ${font.name} invalid, redownloading`);
      fs.unlinkSync(dest);
    }
    try {
      console.log(`[fonts] downloading ${font.name}...`);
      await download(font.url, dest);
      if (!isValidTtf(dest)) {
        fs.unlinkSync(dest);
        throw new Error("downloaded file is not a valid TTF");
      }
      const size = fs.statSync(dest).size;
      console.log(`[fonts] ${font.name} ok (${size} bytes)`);
    } catch (err) {
      // postinstall 단계에서 실패해도 npm install 자체는 통과시킨다.
      // 폰트 누락 시 PDF 생성 시점에 명확한 에러가 발생한다.
      console.warn(`[fonts] failed: ${err.message}`);
    }
  }
}

main();
