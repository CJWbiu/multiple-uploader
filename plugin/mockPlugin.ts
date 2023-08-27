import fs from "fs";
import path from "path";
import formidable from "formidable";
import type { Plugin } from "vite";

const UPLOAD_PATH = path.resolve(__dirname, "../upload");
const delayRep = (fn) => {
  setTimeout(() => {
    fn();
  }, 2000);
};

const mergeChunks = (fileName: string) => {
  const chunks = fs.readdirSync(UPLOAD_PATH);
  const filePath = path.resolve(UPLOAD_PATH, fileName);

  // 创建存储文件
  fs.writeFileSync(filePath, "");

  for (let i = 0; i < chunks.length; i++) {
    let chunkPath = path.resolve(UPLOAD_PATH, chunks[i]);

    // 追加写入到文件中
    fs.appendFileSync(filePath, fs.readFileSync(chunkPath));
    // 删除本次使用的chunk
    fs.unlinkSync(chunkPath);
  }
};

let fileName = "";

const handleSingleUpload = async (req, res, next) => {
  let isAborted = false;

  req.on("aborted", () => {
    isAborted = true;
  });

  const url = req.originalUrl || "";

  if (!url.includes("/upload")) {
    return next();
  }

  delayRep(async () => {
    if (res.destroyed || isAborted) {
      return;
    }

    if (url.includes("/upload/merge")) {
      try {
        mergeChunks(fileName);
        res.end("upload successed");
      } catch (error) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("upload failed");
      }

      return;
    }

    if (!req.headers.token) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Access Denied");
      return;
    }

    const form = formidable({});
    let fields;
    let files;

    try {
      [fields, files] = await form.parse(req);

      const file = files.file[0];
      const chunk = +fields.chunk[0];
      const chunks = +fields.chunks[0];
      const random = +fields.random[0];
      fileName = path.basename(fields.fileName[0]);

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

      fs.renameSync(
        file.filepath,
        path.resolve(UPLOAD_PATH, `${fileName}-part${chunk}.part`)
      );
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
      let fileName = "";
      server.middlewares.use(handleSingleUpload);
    },
  } as Plugin;
};
