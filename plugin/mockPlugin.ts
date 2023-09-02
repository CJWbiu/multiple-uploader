import fs from "fs";
import path from "path";
import nodeUrl from "url";
import { Buffer } from "buffer";
import formidable from "formidable";
import type { Plugin } from "vite";

const UPLOAD_PATH = path.resolve(__dirname, "../upload");
const TEMP_PATH = path.resolve(UPLOAD_PATH, "temp");

const delayRep = (fn) => {
  setTimeout(() => {
    fn();
  }, 1500);
};

const mergeChunks = (fileName: string) => {
  const { name } = path.parse(fileName);
  const fileDir = path.resolve(TEMP_PATH, name);

  let len = 0;
  let partList: string[] = [];
  let bufferList = fs.readdirSync(fileDir).map((val, index) => {
    const partPath = path.resolve(fileDir, `${index}.part`);
    const buffer = fs.readFileSync(partPath);
    len += buffer.length;
    partList.push(partPath);
    return buffer;
  });

  const buffer = Buffer.concat(bufferList, len);
  const ws = fs.createWriteStream(path.resolve(UPLOAD_PATH, fileName));
  ws.write(buffer);
  ws.close();
  ws.on("finish", () => {
    partList.forEach((partPath) => {
      fs.unlinkSync(partPath);
    });
    fs.rmdirSync(fileDir);
  });
};

const handleSingleUpload = async (req, res, next) => {
  const url = nodeUrl.parse(req.originalUrl || "", true);

  if (!url.path?.includes("/upload")) {
    return next();
  }

  delayRep(async () => {
    if (url.path?.includes("/upload/merge")) {
      const fileName = url.query?.fileName || "";

      try {
        mergeChunks(fileName as string);
        res.end("upload successed");
      } catch (error) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("upload failed");
      }

      return;
    }

    const form = formidable({});
    let fields;
    let files;

    try {
      [fields, files] = await form.parse(req);

      const file = files.file[0];
      const chunk = +fields.chunk[0];
      const random = +fields.random?.[0];
      const fileName = path.parse(fields.fileName[0]).name;

      if (random == chunk) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: 10,
            message: "Chunk is error",
          })
        );
        return;
      }

      const dir = path.join(TEMP_PATH, fileName);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      fs.renameSync(file.filepath, path.resolve(dir, `${chunk}.part`));
    } catch (err) {
      console.error(err);
      res.writeHead(err.httpCode || 400, { "Content-Type": "text/plain" });
      res.end(String(err));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: 0,
        message: "success",
      })
    );
  });
};

export const mockPlugin = () => {
  return {
    configureServer(server) {
      server.middlewares.use(handleSingleUpload);
    },
  } as Plugin;
};
