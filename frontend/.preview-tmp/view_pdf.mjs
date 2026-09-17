import { chromium } from "playwright";
import path from "node:path";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
const pdfPath = path.resolve(".preview-tmp/exported-report.pdf");
await page.goto(`file://${pdfPath.replace(/\\/g, "/")}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: ".preview-tmp/pdf_page1.png" });
await browser.close();
console.log("done");
