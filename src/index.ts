import axios from "axios";
import cheerio from "cheerio";
import fs from "fs";
import pLimit from "p-limit";
import puppeteer, { Browser } from "puppeteer";
import { AudioAdjuster } from "./AudioAdjuster";

const limit = pLimit(2);
interface Chapter {
  chapterIndex: number;
  chapterName: string;
  chapterPageUrl: string;
}

const url = "https://ting55.com/book/20";
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream"],
    ignoreDefaultArgs: ["--mute-audio"],
  });

  const chapters = await getChapters(url);

  const downloadTasks = chapters.map((c) => {
    limit(() => downloadChapter(browser, c));
  });

  await Promise.all(downloadTasks);

  console.log("All chapters are downloaded");
})();
async function downloadChapter(browser: Browser, chapter: Chapter) {
  const fileName = `./download/${chapter.chapterName}.mp3`;
  const isExist = await checkIfDownload(fileName);
  if (!isExist) {
    console.log(`Start to analyse chapter ${chapter.chapterName}`);
    const downloadUrl = await getChapterDownloadUrl(browser, chapter);

    await downloadAudio(downloadUrl, fileName);

    new AudioAdjuster(fileName).adjustVolumn(5);
  }
}

async function checkIfDownload(fileName: string) {
  return new Promise<boolean>((resolve, reject) => {
    fs.stat(fileName, (err, stat) => {
      if (err) {
        if (err.code === "ENOENT") {
          resolve(false);
        } else {
          reject(err);
        }
      } else if (stat.isFile && stat.size > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function getChapterDownloadUrl(browser: Browser, chapter: Chapter) {
  const page = await browser.newPage();

  await page.goto(chapter.chapterPageUrl, { waitUntil: "domcontentloaded" });

  let audioUrl: string | null = null;
  let retryCounter = 0;
  while (!audioUrl) {
    await delayMs(60000 * Math.random());

    if (retryCounter % 5 === 0) {
      await page.reload();
    }
    console.log(
      `Try to get chapter ${
        chapter.chapterName
      } audio element for ${++retryCounter} times`
    );
    const audioEle = await page.$("audio");
    if (audioEle) {
      audioUrl = await audioEle.evaluate((ele) => ele.getAttribute("src"));
    }
  }

  await page.close();

  return audioUrl;
}

async function getChapters(listUrl: string): Promise<Chapter[]> {
  const res = await axios.get<string>(listUrl, {
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    },
  });
  const $ = cheerio.load(res.data);
  const bookName = $(".binfo h1").text();
  const chapters = $(".playlist .plist ul a")
    .toArray()
    .map((playItem: any, index) => {
      const href = playItem.attribs.href;
      const itemPageUrl = `${new URL(url).origin}/${href}`;
      return {
        chapterPageUrl: itemPageUrl,
        chapterIndex: index,
        chapterName: `${bookName}-${index + 1}`,
      };
    });

  console.log(`Got ${chapters.length} chapters.`);
  return [chapters[0]];
}

function downloadAudio(url: string, fileName: string) {
  console.log(`Start downloading ${fileName} at ${url}`);
  return new Promise<void>((resolve, reject) => {
    fs.unlink(fileName, () => {
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
          return delayMs(60000 * Math.random()).then(() => {
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
