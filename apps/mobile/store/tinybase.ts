import * as SQLite from "expo-sqlite";
import { createStore, type Store } from "tinybase";
import { createExpoSqlitePersister } from "tinybase/persisters/persister-expo-sqlite";

/**
 * Reactive local store: TinyBase (in-memory, reactive UI binding) persisted to
 * expo-sqlite. Both are bundled into Expo Go, so the app runs WITHOUT a custom
 * development build (this replaced WatermelonDB, which needed native C++).
 *
 * The store holds one TinyBase table per sync table (see shared SYNC_TABLES).
 * Rows carry the server fields plus local sync bookkeeping cells:
 *   _dirty   1 = changed locally since last successful push
 *   _deleted 1 = tombstoned locally, pending deletion on the server
 *   created_at / updated_at = server-stamped epoch ms (0 until first sync)
 */
export const store: Store = createStore();

let ready: Promise<void> | null = null;

export function initStore(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      if (typeof SQLite?.openDatabaseSync === "function") {
        const db = SQLite.openDatabaseSync("monitoring.db");
        const persister = createExpoSqlitePersister(store, db, "tinybase_store");
        await persister.load();
        await persister.startAutoSave();
      }
    } catch (e) {
      console.warn("SQLite persistence unavailable, using in-memory store:", e);
    }
  })();
  return ready;
}
