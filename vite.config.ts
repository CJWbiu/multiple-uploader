import { defineConfig } from "vite";
import { mockPlugin } from "./plugin/mockPlugin";

export default defineConfig({
  resolve: {
    extensions: [".ts"],
  },
  plugins: [mockPlugin()],
  server: {
    port: 3000,
  },
});
