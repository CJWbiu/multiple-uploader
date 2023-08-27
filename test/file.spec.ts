import { describe, beforeEach, it, expect } from "vitest";
import { MFile, MFileChunk, MFileOptions, MFileStatus } from "../src";

describe("MFile", () => {
  let mockFile: File;
  let mockOptions: MFileOptions;
  let mFile: MFile;

  beforeEach(() => {
    // Create a mock file and options for testing
    mockFile = new File(["dummy content"], "test-file.txt");
    mockOptions = {
      file: mockFile,
      chunkSize: 1024,
      chunkRetry: 2,
      threads: 2,
      method: "POST",
      server: "/upload",
      xhrTimeout: 5000,
    };

    // Initialize MFile with mock options
    mFile = new MFile(mockOptions);
  });

  it("should initialize MFile and chunks", () => {
    // Assert initial state after initialization
    expect(mFile["options"]).toEqual(expect.objectContaining(mockOptions));

    // Number of chunks based on mock options
    expect(mFile["chunks"]).toHaveLength(1);
    expect(mFile["successedChunks"]).toHaveLength(0);
    expect(mFile["status"]).toBe(MFileStatus.INIT);
    expect(mFile["activeChunkIndex"]).toBe(0);
  });

  it("should set a new file", () => {
    const newMockFile = new File(["new dummy content"], "new-test-file.txt");
    mFile.setFile(newMockFile);

    // Assert that new file is set and initialization is called
    expect(mFile["options"].file).toBe(newMockFile);
    expect(mFile["chunks"]).toHaveLength(1);
  });

  it("should set and update options", () => {
    const newOptions = {
      chunkSize: 2048,
      threads: 3,
    };
    mFile.updateOptions(newOptions);

    // Assert that options are updated
    expect(mFile["options"]).toEqual(
      expect.objectContaining({ ...mockOptions, ...newOptions })
    );
  });
});
