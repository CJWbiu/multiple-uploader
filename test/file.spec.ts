import { describe, beforeEach, it, expect, vi } from "vitest";
import { MFile, MFILE_EVENTS } from "../src/file";
import { MFileStatus } from "../src/types";

function mockFile(fileName: string, size: number) {
  return new File(new Array(size).fill("0"), fileName, {
    type: "text/plain",
  });
}

describe("MFile", () => {
  let mFile: MFile;

  beforeEach(() => {
    const originSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      let that = this;
      originSend.call(that);
    };

    mFile = new MFile({
      chunkSize: 1024,
      chunkRetry: 2,
      threads: 2,
      method: "POST",
      server: "/upload",
      xhrTimeout: 5000,
    });
  });

  it("初始值检测", () => {
    expect(mFile.status).toBe(MFileStatus.NONE);
    expect(mFile.id).toBeUndefined();
    expect(mFile.chunks).toBeUndefined();
    expect(mFile.file).toBeUndefined();
  });

  it("设置文件后，初始化结果正确", () => {
    const file = mockFile("test.txt", 3079);
    const emitFn = vi.fn();

    mFile.on(MFILE_EVENTS.init, emitFn);

    mFile.setFile(file);
    expect(mFile.file).toBe(file);
    expect(mFile.id).not.toBeUndefined();
    expect(mFile.status).toBe(MFileStatus.INIT);
    expect(mFile.chunks).toHaveLength(4);
    expect(emitFn).toHaveBeenCalledTimes(1);
  });

  it("执行开始上传，设置下发参数正确并发送成功", () => {
    const file = mockFile("test.txt", 2048);
    const emitFn = vi.fn().mockImplementation((f, blob, formData, headers) => {
      headers.token = "token";
      headers["Content-Type"] = "multipart/form-data";
      formData.test = "test";
    });
    const xhrFn = vi.spyOn(XMLHttpRequest.prototype, "send");

    mFile.setFile(file);
    mFile.on(MFILE_EVENTS.beforeChunkSend, emitFn);

    mFile.startUpload();
    expect(mFile.status).toBe(MFileStatus.UPLOADING);
    expect(emitFn).toBeCalledTimes(2);
    expect(xhrFn).toBeCalledTimes(2);
  });
});
