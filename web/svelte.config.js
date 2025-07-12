//import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"
import adapter from "svelte-adapter-bun"

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess()],
  kit: {
    adapter: adapter({
      out: "build/web"
    }),
    alias: {
      "@/*": "./src/lib/components/ui",
      $components: "./src/lib/components",
      $ui: "./src/lib/components/ui",
      $content: "./src/content",
      $paraglide: "./src/lib/paraglide/messages"
    }
  },
  extensions: [".svelte", ".svx"]
};

export default config;
