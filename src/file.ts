import { EventEmitter } from "./event";
import type { MFileChunk, MFileOptions } from "./types";
import { MFileStatus } from "./types";
import logger from "./logger";

export const MFILE_EVENTS = {
  init: "file-inited",
  progress: "upload-progress",
  failed: "upload-failed",
  success: "upload-successed",
  beforeChunkSend: "upload-before-send",
  pause: "upload-paused",
  cancel: "upload-canceled",
  complete: "upload-completed",
};

export const DEFAULT_OPTIONS: Required<MFileOptions> = {
  chunkSize: 5 * 1024 * 1024,
  chunkRetry: 3,
  threads: 1,
  method: "POST",
  xhrTimeout: 10000,
  server: "",
  checkRes: (status) => {
    return status === 200;
  },
};

let id = 0;

function getUUID() {
  return `${Date.now()}_${id++}`;
}

export class MFile extends EventEmitter {
  private activeChunkIndex!: number;
  private successedChunks!: MFileChunk[];
  public options: Required<MFileOptions>;
  public chunks!: MFileChunk[];
  public status = MFileStatus.NONE;
  public id!: string;
  public file!: File;
  public fileName!: string;

  constructor(options: MFileOptions) {
    super();

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    } as Required<MFileOptions>;
  }

  private init() {
    this.chunks = [];
    this.successedChunks = [];
    this.activeChunkIndex = 0;
    this.id = getUUID();

    this.setStatus(MFileStatus.INIT);
    this.initChunks();

    this.emit(MFILE_EVENTS.init, this);
  }

  private initChunks() {
    const { chunkSize } = this.options;

    let fileSize = this.file.size;
    let index = 0;

    while (fileSize > 0) {
      this.chunks.push({
        index,
        start: index * chunkSize,
        end: (index + 1) * chunkSize,
        xhr: null,
        loaded: 0,
        retryCount: 0,
      });

      index++;
      fileSize -= chunkSize;
    }
  }

  private isStopped() {
    return [
      MFileStatus.CANCELED,
      MFileStatus.FAILED,
      MFileStatus.PAUSED,
    ].includes(this.status);
  }

  public setFile(file: File) {
    this.file = file;
    this.fileName = file.name;
    this.init();
  }

  private setStatus(status: MFileStatus) {
    this.status = status;
  }

  private isCompleted() {
    return this.successedChunks.length === this.chunks.length;
  }

  private getResponseData(res: string) {
    let resData: Record<string, any> | string;

    try {
      resData = JSON.parse(res);
    } catch {
      resData = res;
    }

    return resData;
  }

  private getLoaded() {
    return this.chunks.reduce((total, chunk) => {
      return total + chunk.loaded;
    }, 0);
  }

  private sendNext(skipSuccess = false) {
    if (this.activeChunkIndex >= this.chunks.length) {
      return;
    }

    const chunkIndex = this.activeChunkIndex++;

    logger.info(
      `[${this.fileName}] start to send chunk: ${chunkIndex + 1}/${
        this.chunks.length
      }`
    );

    if (
      skipSuccess &&
      this.successedChunks.find((item) => item.index === chunkIndex)
    ) {
      logger.info(`[${this.fileName}] skip successed chunk: ${chunkIndex + 1}`);
      this.sendNext(skipSuccess);
      return;
    }

    const { chunkRetry, checkRes, method, server, xhrTimeout } = this.options;
    const file = this.file;
    const totalSize = file.size;
    const chunk = this.chunks[chunkIndex];

    const toRun = () => {
      chunk.xhr = new XMLHttpRequest();
      let blob: Blob | null = file.slice(chunk.start, chunk.end);

      const onSuccessed = () => {
        this.successedChunks.push(chunk);
        logger.info(`[${this.fileName}] chunk ${chunkIndex + 1} successed`);

        if (this.isStopped()) {
          return;
        }

        if (this.isCompleted()) {
          this.setStatus(MFileStatus.SUCCESSED);
          logger.info(`[${this.fileName}] upload successed`);
          this.emit(MFILE_EVENTS.success, this);
          this.emit(MFILE_EVENTS.complete, this);
          return;
        }

        this.sendNext(skipSuccess);
      };

      const onFailed = () => {
        if (!this.isStopped() && chunk.retryCount < chunkRetry) {
          toRun();
          return;
        }

        logger.error(`[${this.fileName}] chunk ${chunkIndex + 1} failed`);
        this.setStatus(MFileStatus.FAILED);
        this.emit(
          MFILE_EVENTS.failed,
          this,
          this.getResponseData(chunk.xhr!.response)
        );
        this.emit(MFILE_EVENTS.complete, this);
      };

      const onProgress = (event: ProgressEvent<EventTarget>) => {
        if (this.isStopped()) {
          return;
        }

        chunk.loaded = event.loaded;

        const loaded = this.getLoaded();
        const percentage = Math.round((loaded / totalSize) * 10000) / 100;

        this.emit(MFILE_EVENTS.progress, this, percentage, loaded, totalSize);
      };

      const onReadyStateChange = () => {
        if (chunk.xhr!.readyState < 4 || chunk.xhr!.status === 0) {
          return;
        }

        const isSuccessed = checkRes(
          chunk.xhr!.status,
          this.getResponseData(chunk.xhr!.response)
        );

        chunk.xhr!.removeEventListener("readystatechange", onReadyStateChange);
        chunk.xhr!.upload.removeEventListener("progress", onProgress);
        blob = null;
        chunk.xhr = null;

        if (isSuccessed) {
          onSuccessed();
          return;
        }

        onFailed();
      };

      chunk.xhr!.addEventListener(
        "readystatechange",
        onReadyStateChange,
        false
      );
      chunk.xhr!.upload.addEventListener("progress", onProgress, false);

      let headers: Record<string, string> = {};
      let formDataObj: Record<string, string | Blob> = {
        file: blob,
        chunks: this.chunks.length.toString(),
        chunk: chunk.index.toString(),
        fileName: file.name,
      };

      this.emit(MFILE_EVENTS.beforeChunkSend, this, blob, formDataObj, headers);
      const formData = new FormData();

      Object.keys(formDataObj).forEach((key) => {
        formData.append(key, formDataObj[key]);
      });

      chunk.xhr!.open(method, server);

      Object.keys(headers).forEach((key) => {
        chunk.xhr!.setRequestHeader(key, headers[key]);
      });

      chunk.xhr!.timeout = xhrTimeout;
      chunk.xhr!.send(formData);

      chunk.retryCount++;
    };

    toRun();
  }

  /**
   * Start upload
   * @param {boolean} skipSuccess Whether to skip uploaded chunks
   */
  public startUpload(skipSuccess = false) {
    if (!this.options.server) {
      throw new Error("Missing parameter: server");
    }

    let count = 0;
    let threads = Math.min(this.options.threads, this.chunks.length);

    this.setStatus(MFileStatus.UPLOADING);

    while (count < threads) {
      this.sendNext(skipSuccess);
      count++;
    }
  }

  private abort() {
    this.chunks.forEach((chunk) => {
      const xhr = chunk.xhr;

      if (xhr && xhr.readyState < 4) {
        xhr.abort();
        chunk.xhr = null;
        logger.info(`[${this.fileName}] chunk ${chunk.index} is aborted`);
      }
    });
  }

  /**
   * Pause the upload, cancel the currently uploading chunk,
   * and keep the current upload progress
   */
  public pauseUpload() {
    this.setStatus(MFileStatus.PAUSED);
    this.abort();
    this.activeChunkIndex = 0;
    this.emit(MFILE_EVENTS.pause, this);
  }

  /**
   * Try uploading again
   * @param {boolean} skipSuccess Whether to skip uploaded chunks
   */
  public retry(skipSuccess = false) {
    if (!skipSuccess) {
      this.successedChunks = [];
      this.activeChunkIndex = 0;
    }

    this.startUpload(skipSuccess);
  }

  /**
   * Continue uploading and skip uploaded chunks
   */
  public continueUpload() {
    this.retry(true);
  }

  /**
   * Cancel the upload and reset the chunks, and upload again from the first chunk
   */
  public cancelUpload() {
    this.setStatus(MFileStatus.CANCELED);
    this.abort();

    this.successedChunks = [];
    this.activeChunkIndex = 0;

    this.emit(MFILE_EVENTS.cancel, this);
  }

  /**
   * Set successed chunks
   * @param {MFileChunk} chunks
   */
  public setSkipChunks(chunks: MFileChunk[]) {
    this.successedChunks = chunks;
  }

  public updateOptions(options: Partial<MFileOptions>) {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public getUUID() {
    return this.id;
  }
}
