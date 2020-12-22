import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const fsUnlink = promisify(fs.unlink);
const fsCopyFile = promisify(fs.copyFile);

export class VolumeAdjuster {
  constructor(private fileName: string) {}

  public async adjustVolume(dbDegree: number) {
    const targetFileName = path.join(os.tmpdir(), path.basename(this.fileName));
    try {
      await fsUnlink(targetFileName);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw new Error(`Failed to delete file ${targetFileName}`);
      }
    }
    await this.transform(dbDegree, targetFileName);
    await fsUnlink(this.fileName);
    await fsCopyFile(targetFileName, this.fileName);
    await fsUnlink(targetFileName);
  }

  private transform(dbDegree: number, targetName: string) {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(this.fileName)
        .audioFilter([
          {
            filter: "volume",
            options: `${dbDegree}dB`,
          },
          {
            filter: "silencedetect",
            options: "n=-50dB:d=5",
          },
        ])
        .output(targetName)
        .on("error", (err: any) => {
          reject(err);
        })
        .on("end", () => {
          resolve();
        })
        .run();
    });
  }
}
