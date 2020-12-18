import puppeteer, { Browser, ElementHandle } from "puppeteer";
import cheerio from "cheerio";
import axios from "axios";
import pLimit from "p-limit";
import fs from "fs";

const limit = pLimit(2);
interface Capter {
  capterIndex: number;
  capterName: string;
  capterPageUrl: string;
}

const url = "https://ting55.com/book/20";
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--use-fake-ui-for-media-stream"],
    ignoreDefaultArgs: ["--mute-audio"],
  });

  const capters = await getCapters(url);

  const downloadTasks = capters.map((c) => {
    limit(() => downloadCapter(browser, c));
  });

  await Promise.all(downloadTasks);

  console.log("All capters are downloaded");
})();
async function downloadCapter(browser: Browser, capter: Capter) {
  console.log(`Start to analyse capter ${capter.capterName}`);
  const downloadUrl = await getCapterDownloadUrl(browser, capter.capterPageUrl);
  await downloadAudio(downloadUrl, `./download/${capter.capterName}.mp3`);
}

async function getCapterDownloadUrl(browser: Browser, capterPageUrl: string) {
  const page = await browser.newPage();

  await page.goto(capterPageUrl);

  let audioUrl: string | null = null;
  while (!audioUrl) {
    delayMs(5000 * Math.random());

    const audioEle = await page.$("audio");
    if (audioEle) {
      audioUrl = await audioEle.evaluate((ele) => ele.getAttribute("src"));
    }
  }

  await page.close();

  return audioUrl;
}

async function getCapters(listUrl: string): Promise<Capter[]> {
  const res = await axios.get<string>(listUrl, {
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    },
  });
  const $ = cheerio.load(res.data);
  const bookName = $(".binfo h1").text();
  const capters = $(".playlist .plist ul a")
    .toArray()
    .map((playItem: any, index) => {
      const href = playItem.attribs.href;
      const itemPageUrl = `${new URL(url).origin}/${href}`;
      return {
        capterPageUrl: itemPageUrl,
        capterIndex: index,
        capterName: `${bookName}-${index + 1}`,
      };
    });

  return capters;
}

function downloadAudio(url: string, fileName: string) {
  console.log(`Start downloading ${fileName} at ${url}`);
  return new Promise<void>((resolve, reject) => {
    fs.truncate(fileName, () => {
      axios({
        method: "get",
        url,
        responseType: "stream",
      })
        .then((res) => {
          const stream = fs.createWriteStream(fileName);
          res.data.pipe(stream);

          stream.on("error", (err) => {
            console.log(`Failed to download ${fileName} at ${url}`);

            reject(err);
          });
          stream.on("close", () => {
            console.log(`Complete download ${fileName} at ${url}`);
            resolve();
          });
        })
        .catch((err) => {
          console.error(err);
          return delayMs(5000 * Math.random()).then(() => {
            console.log(`Download ${fileName} failed, retrying`);
            downloadAudio(url, fileName);
          });
        });
    });
  });
}

function delayMs(number: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, number);
  });
}
