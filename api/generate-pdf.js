const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST method required" });

  let browser;
  try {
    const { html, css = "", filename = "due-installments.pdf" } = req.body || {};
    if (!html) return res.status(400).json({ error: "html is required" });
    if (String(html).length > 4 * 1024 * 1024 || String(css).length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: "report payload is too large" });
    }

    const safeFilename = String(filename).replace(/[\\/:*?"<>|\r\n]/g, "_");
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body class="printing-risk-report printing-due-installments-report" dir="rtl">${html}</body></html>`, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    await page.evaluate(() => document.fonts?.ready);
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeFilename)}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("PDF generation failed:", error);
    return res.status(500).json({ error: "PDF generation failed" });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
