import {
  MFile,
  MFILE_EVENTS,
  DEFAULT_OPTIONS as MFDEFAULT_OPTIONS,
} from "./file";
import { EventEmitter } from "./event";
import { MFileStatus, type MultiUploaderOptions } from "./types";

const DEFAULT_OPTIONS: Required<MultiUploaderOptions> = {
  ...MFDEFAULT_OPTIONS,
  // fileConcurrent: 1,
};

export default class MultiUploader extends EventEmitter {
  private options: Required<MultiUploaderOptions>;
  private mfileList: MFile[] = [];

  constructor(options: MultiUploaderOptions) {
    super();

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  private proxyEvents(mfile: MFile) {
    Object.values(MFILE_EVENTS).forEach((eventName) => {
      mfile.on(eventName, (...args) => {
        this.emit(eventName, ...args);
      });
    });
  }

  public getFile(fileID: string) {
    return this.mfileList.find((mfile) => mfile.getUUID() === fileID);
  }

  public addFiles(files: File | FileList) {
    const fileList = files instanceof File ? [files] : Array.from(files);

    fileList.forEach((file) => {
      const mfile = new MFile({
        ...this.options,
      });

      this.proxyEvents(mfile);
      mfile.setFile(file);
      this.mfileList.push(mfile);
    });
  }

  public upload(fileID?: string) {
    if (fileID) {
      const mfile = this.getFile(fileID);
      mfile && mfile.startUpload();
      return;
    }

    const that = this;

    let activeIndex = 0;

    const _next = () => {
      if (activeIndex >= that.mfileList.length) {
        return;
      }

      const mfile = that.mfileList[activeIndex++];

      if (mfile.status !== MFileStatus.INIT) {
        _next();
        return;
      }

      mfile.on(MFILE_EVENTS.complete, () => {
        _next();
      });

      mfile.startUpload();
    };

    _next();
  }

  public cancel(fileID?: string) {
    if (fileID) {
      const mfile = this.getFile(fileID);
      mfile?.cancelUpload();
      return;
    }

    this.mfileList.forEach((mfile) => {
      mfile.cancelUpload();
    });
  }

  public pause(fileID?: string) {
    if (fileID) {
      const mfile = this.getFile(fileID);
      mfile?.pauseUpload();
      return;
    }

    this.mfileList.forEach((mfile) => {
      mfile.pauseUpload();
    });
  }

  public continue(fileID?: string) {
    if (fileID) {
      const mfile = this.getFile(fileID);
      mfile?.continueUpload();
      return;
    }

    this.mfileList.forEach((mfile) => {
      mfile.continueUpload();
    });
  }

  public retry(opt?: { fileId?: string; skipSuccess?: boolean }) {
    if (opt?.fileId) {
      const mfile = this.getFile(opt.fileId);
      mfile?.retry(opt.skipSuccess);
      return;
    }

    this.mfileList.forEach((mfile) => {
      mfile.retry(opt?.skipSuccess);
    });
  }
}
