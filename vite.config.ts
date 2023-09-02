import path from "path";
import { defineConfig } from "vite";
import { mockPlugin } from "./plugin/mockPlugin";

export default defineConfig({
  resolve: {
    extensions: [".ts"],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "MultiUploader",
      fileName: "multi-uploader",
      formats: ["es", "umd", "iife"],
    },
  },
  plugins: [mockPlugin()],
  server: {
    port: 3000,
  },
});
