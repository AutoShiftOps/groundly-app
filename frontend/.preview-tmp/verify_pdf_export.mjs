import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));
await page.goto("http://localhost:5174");

await page.getByPlaceholder(/subscription box/i).click();
await page.keyboard.type("an EV charging network startup");
await page.getByRole("button", { name: "Launch Analysis" }).click();

await page.waitForFunction(
  () => document.body.innerText.includes("Frameworks verified"),
  { timeout: 90000 }
);
console.log("report ready");

const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 30000 }),
  page.getByRole("button", { name: /Export PDF/i }).click(),
]);

const savePath = ".preview-tmp/exported-report.pdf";
await download.saveAs(savePath);
console.log("downloaded suggested filename:", download.suggestedFilename());
console.log("file size:", fs.statSync(savePath).size, "bytes");

// Confirm no console errors happened during generation.
await page.waitForTimeout(500);
console.log("console errors:", JSON.stringify(consoleErrors));

await browser.close();
console.log("done");
