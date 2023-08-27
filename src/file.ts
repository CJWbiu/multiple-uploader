import { EventEmitter } from "./event";

export interface MFileOptions {
  file?: File;
  chunkSize?: number;

  /**Number of trials after failure */
  chunkRetry?: number;

  /**Concurrent number */
  threads?: number;

  method?: "POST" | "GET";
  server: string;
  xhrTimeout?: number;
  checkRes?: (status: number, resData: Record<string, any> | string) => boolean;
}

export interface MFileChunk {
  index: number;

  /** start Byte */
  start: number;

  /** end Byte */
  end: number;

  loaded: number;

  retryCount: number;

  xhr: XMLHttpRequest | null;
}

export enum MFileStatus {
  INIT = "INIT",
  UPLOADING = "UPLOADING",
  PAUSED = "PAUSED",
  CANCELED = "CANCELED",
  SUCCESSED = "SUCCESSED",
  FAILED = "FAILED",
}

const DEFAULT_OPTIONS: Omit<Required<MFileOptions>, "file" | "server"> = {
  chunkSize: 5 * 1024 * 1024,
  chunkRetry: 3,
  threads: 1,
  method: "POST",
  xhrTimeout: 10000,
  checkRes: (status) => {
    return status === 200;
  },
};

export class MFile extends EventEmitter {
  private options: Required<MFileOptions>;
  private chunks!: MFileChunk[];
  private successedChunks!: MFileChunk[];
  private status!: MFileStatus;
  private activeChunkIndex!: number;

  constructor(options: MFileOptions) {
    super();

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    } as Required<MFileOptions>;

    if (this.options.file) {
      this.init();
    }
  }

  private init() {
    this.chunks = [];
    this.successedChunks = [];
    this.activeChunkIndex = 0;

    this.setStatus(MFileStatus.INIT);
    this.initChunks();

    this.emit("file-inited", this.options.file);
  }

  private initChunks() {
    const { chunkSize, file } = this.options;

    let fileSize = file.size;
    let originSize = file.size;
    let index = 0;

    while (fileSize > 0) {
      this.chunks.push({
        index,
        start: index * chunkSize,
        end: Math.min(originSize, (index + 1) * chunkSize),
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
    this.options.file = file;
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

    console.log(`start to send chunk: ${chunkIndex}/${this.chunks.length}`);

    if (
      skipSuccess &&
      this.successedChunks.find((item) => item.index === chunkIndex)
    ) {
      console.log(`skip successed chunk: ${chunkIndex}`);
      this.sendNext(skipSuccess);
      return;
    }

    const { file, chunkRetry, checkRes, method, server, xhrTimeout } =
      this.options;
    const totalSize = file.size;
    const chunk = this.chunks[chunkIndex];

    const toRun = () => {
      chunk.xhr = new XMLHttpRequest();
      let blob: Blob | null = file.slice(chunk.start, chunk.end);

      const onSuccessed = () => {
        this.successedChunks.push(chunk);
        console.log(`chunk ${chunkIndex} successed`);

        if (this.isStopped()) {
          return;
        }

        if (this.isCompleted()) {
          this.setStatus(MFileStatus.SUCCESSED);
          console.log(`file ${file.name} upload successed`);
          this.emit("upload-successed", file);
          return;
        }

        this.sendNext(skipSuccess);
      };

      const onFailed = () => {
        if (!this.isStopped() && chunk.retryCount < chunkRetry) {
          toRun();
          return;
        }

        console.error(`chunk ${chunkIndex} failed`);
        this.setStatus(MFileStatus.FAILED);
        this.emit("upload-failed", file, this.getResponseData(xhr.response));
      };

      const onProgress = (event: ProgressEvent<EventTarget>) => {
        if (this.isStopped()) {
          return;
        }

        chunk.loaded = event.loaded;

        const loaded = this.getLoaded();
        const percentage = Math.round((loaded / totalSize) * 10000) / 100;

        this.emit("upload-progress", file, percentage, loaded, totalSize);
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

      const formData = new FormData();

      formData.append("file", blob);
      formData.append("chunks", this.chunks.length.toString());
      formData.append("chunk", chunk.index.toString());
      formData.append("fileName", file.name);

      let headers: Record<string, string> = {};

      this.emit("upload-before-send", blob, formData, headers);

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
        console.log(`chunk ${chunk.index} is aborted`);
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
    this.emit("upload-paused", this.options.file);
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

    this.emit("upload-canceled", this.options.file);
  }

  /**
   * Set successed chunks
   * @param {MFileChunk} chunks
   */
  public setSkipChunks(chunks: MFileChunk[]) {
    this.successedChunks = chunks;
  }

  public updateOptions(options: Partial<Omit<MFileOptions, "file">>) {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
