import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto("http://www.baidu.com");

  await page.screenshot({
    path: "./download/cs.png",
  });
})();
