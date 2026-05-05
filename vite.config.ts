import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/mortal-realm-rpg/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Mortal Realm",
        short_name: "MortalRealm",
        description: "A personal life-tracking RPG.",
        theme_color: "#1a1420",
        background_color: "#1a1420",
        display: "fullscreen",
        orientation: "any",
        start_url: base,
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
});
