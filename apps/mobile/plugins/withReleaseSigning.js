/**
 * Expo config plugin: durable Android **release** signing for the bare-Gradle
 * build path (`npx expo prebuild` + `./gradlew assembleRelease`).
 *
 * `expo prebuild --clean` regenerates android/ from scratch every time, wiping
 * any hand-edits to build.gradle. This plugin re-applies the release signing
 * wiring on every prebuild, so the native project is reproducible from one
 * command. It does NOT contain any secrets — the keystore path and passwords
 * are read at build time from Gradle properties you keep OUTSIDE the repo:
 *
 *   ~/.gradle/gradle.properties
 *     MONITORING_STORE_FILE=/abs/path/monitoring-release.jks
 *     MONITORING_STORE_PASSWORD=********
 *     MONITORING_KEY_ALIAS=********
 *     MONITORING_KEY_PASSWORD=********
 *
 * When those properties are present, release builds are signed with your real
 * keystore; when they're absent (e.g. a quick dev build), it falls back to the
 * debug key so the build still succeeds.
 */
// Resolve @expo/config-plugins WITHOUT making it a direct dependency: in a pnpm
// workspace it's a transitive dep (not directly resolvable from here), and
// adding it to package.json disturbs @types/react hoisting for sibling apps.
// Try a normal require first, then locate it in the pnpm store by walking up.
function requireConfigPlugins() {
  try {
    return require("@expo/config-plugins");
  } catch {
    const fs = require("fs");
    const path = require("path");
    let dir = __dirname;
    for (let i = 0; i < 7; i++) {
      const store = path.join(dir, "node_modules", ".pnpm");
      if (fs.existsSync(store)) {
        const match = fs.readdirSync(store).find((d) => d.startsWith("@expo+config-plugins@"));
        if (match) return require(path.join(store, match, "node_modules", "@expo", "config-plugins"));
      }
      dir = path.dirname(dir);
    }
    throw new Error("withReleaseSigning: could not locate @expo/config-plugins");
  }
}

const { withAppBuildGradle } = requireConfigPlugins();

const RELEASE_SIGNING_CONFIG = `
        release {
            // Injected by ./plugins/withReleaseSigning.js — set MONITORING_* in
            // ~/.gradle/gradle.properties to sign with your real keystore.
            if (project.hasProperty('MONITORING_STORE_FILE')) {
                storeFile file(MONITORING_STORE_FILE)
                storePassword MONITORING_STORE_PASSWORD
                keyAlias MONITORING_KEY_ALIAS
                keyPassword MONITORING_KEY_PASSWORD
            }
        }`;

function patchBuildGradle(contents) {
  // Idempotent: prebuild may run this more than once.
  if (contents.includes("MONITORING_STORE_FILE")) return contents;

  // 1) Point the release buildType at the (conditional) release signingConfig.
  //    Done first, while `release {` only refers to the buildType block.
  contents = contents.replace(
    /(buildTypes\s*\{[^]*?release\s*\{[^]*?)signingConfig\s+signingConfigs\.debug/,
    "$1signingConfig project.hasProperty('MONITORING_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
  );

  // 2) Add the release signingConfig next to the generated debug one.
  contents = contents.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_SIGNING_CONFIG}`);

  return contents;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === "groovy") {
      cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    } else {
      throw new Error(
        "withReleaseSigning expected a Groovy build.gradle; got " + cfg.modResults.language,
      );
    }
    return cfg;
  });
};
