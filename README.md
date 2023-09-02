# MultiUploader

MultiUploader 是一个轻量的多文件分片上传库，能够帮助你轻松实现多文件的分片上传和断点续传功能。事件的命名参考了 [webuploader](https://fex.baidu.com/webuploader/)。

## 主要特性

- [x] **并发分片上传：** 该库允许同时上传一个文件的多个分片，从而加快上传速度，特别是对于大文件而言。
- [x] **断点续传：** 支持暂停、续传、失败重试。
- [x] **多文件上传：** 支持多文件上传

## 基本使用

```javascript
// html
<input type="file" name="file" id="file" multiple />;

// js
import MultiUploader from "multi-uploder";

const uploader = new MultiUploader({
  chunkSize: 5 * 1024 * 1024,
  threads: 2,
  server: "/upload",
  method: "POST",
  xhrTimeout: 10000,
});

uploader.on("upload-successed", () => {
  console.log("successed");
});

document.getElementById("file").addEventListener("change", (event) => {
  uploader.addFiles(event.target.files);
  uploader.upload();
});
```

## API

### options

| 属性       | 类型                                               | 描述                                      |
| ---------- | -------------------------------------------------- | ----------------------------------------- |
| chunkSize  | number ([optional] default 5MB)                    | 每个分片的大小，单位 Byte                 |
| chunkRetry | number ([optional] default 3)                      | 每个分片失败重试的次数                    |
| threads    | number ([optional] default 1)                      | 上传分片并发数                            |
| method     | 'GET'\|'POST' ([optional] default 'POST')          | 请求方式                                  |
| server     | string ([required])                                | 请求地址                                  |
| xhrTimeout | number ([optional] default 10000)                  | xhr 超时时间                              |
| checkRes   | (status: number, res: any) => boolean ([optional]) | 校验请求是否成功，默认状态码为 200 时成功 |

### methods

| 属性     | 类型                                                     | 描述                                                                                                                |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| getFile  | (id: string) => MFile                                    | 根据 id 获取 MFile 实例                                                                                             |
| addFiles | (files: File \| FileList) => void                        | 添加待上传的文件                                                                                                    |
| upload   | (id?: string) => void                                    | 开始上传，如果没传 id 则上传全部文件，有 id 则上传指定文件                                                          |
| cancel   | (id?: string) => void                                    | 取消上传，如果没传 id 则取消全部文件，有 id 则取消指定文件                                                          |
| pause    | (id?: string) => void                                    | 暂停上传，如果没传 id 则暂停全部文件，有 id 则暂停指定文件                                                          |
| continue | (id?: string) => void                                    | 继续上传，如果没传 id 则继续上传全部文件，有 id 继续上传指定文件                                                    |
| retry    | (opt?: {fileId?: string; skipSuccess?: boolean}) => void | 重新上传，如果没传 id 则继续上传全部文件，有 id 继续上传指定文件。其中 skipSuccess 用于指定是否需要跳过已成功的分片 |

### events

| 事件名称           | 参数                                                                                   | 描述                                    |
| ------------------ | -------------------------------------------------------------------------------------- | --------------------------------------- |
| file-inited        | file: MFile                                                                            | 文件已初始化，可以执行上传操作          |
| upload-successed   | file: MFile                                                                            | 文件上传成功                            |
| upload-failed      | file: MFile, res: any                                                                  | 文件上传失败，res 为后台响应数据        |
| upload-completed   | file: MFile                                                                            | 文件上传结束，可能是失败，也可能是成功  |
| upload-progress    | file: MFile, percentage: number, loaded: number, total: number                         | 文件上传中，用于提示上传进度            |
| upload-before-send | file: MFile, blob: Blob, formData: Record<string, any>, header: Record<string, string> | 分片发送前，可以修改上传参数以及 header |
| ｜ upload-paused   | file: MFile                                                                            | 文件上传暂停                            |
| ｜ upload-canceled | file: MFile                                                                            | 文件取消                                |
