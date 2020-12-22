import ffmpeg from "fluent-ffmpeg";
import path from "path";

export class AudioAdjuster {
  constructor(private fileName: string) {}

  public adjustVolumn(dbDegree: number) {
    const extName = path.extname(this.fileName);
    const basename = path.basename(this.fileName);
    const targetName = `${basename.replace(extName, "")}-vu-${extName}`;
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
      .output(targetName);
  }
}
