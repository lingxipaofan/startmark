import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw3rMVSe2dgNn4zj7TYKnEtQetnZ+kuyz1Ka1RblzUyzI8AfspKbK28ondN04UU8LjJiGiKOZqCRuwIctTJ1DKW/dNAAYAH3svjsg/aJ4q8p2WqP1E9UdShYtNGlPJbcZi4lq31j5M2TgnON3lRQXZWRq25GcGNqA5IC+oXUP+DCpl6la9PxjhZUFb2xhH9jlXlu1mGrO/gaXfflror1Arnn1bkddqWDGuXqX+XwN3ClJ/OxSUun29frNGQn2dqPgooavD7Ifflz6ZeZWVEhhgsS20fW8mu9iqBh61EPQIAi4GFIfuQl0yAcr3BiCv0Pa9JWwCMA89aTMRvhgkKyTkwIDAQAB",
    name: "Startmark",
    description: "Turn Chrome bookmarks into a clean new-tab start page with quick navigation, search, sorting, and drag-and-drop organization.",
    permissions: ["bookmarks", "storage", "tabs", "tabGroups"],
    host_permissions: ["<all_urls>"],
    action: {},
    chrome_url_overrides: {
      newtab: "manager.html",
    },
    icons: {
      "16": "/icon/icon16.png",
      "48": "/icon/icon48.png",
      "128": "/icon/icon128.png",
    },
  },
});
