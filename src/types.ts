export type UploaderMethod = "POST" | "GET";

export interface MFileOptions {
  chunkSize?: number;

  /**Number of trials after failure */
  chunkRetry?: number;

  /**Concurrent number */
  threads?: number;

  method?: UploaderMethod;
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

export interface MultiUploaderOptions extends MFileOptions {
  /** Number of files uploaded at the same time */
  // fileConcurrent?: number;
}
