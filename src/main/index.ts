import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import log from "electron-log/main";

let db: Database.Database;
const vaultKey = () =>
  crypto
    .createHash("sha256")
    .update(app.getPath("userData") + ":vault-key")
    .digest();
function initDb() {
  db = new Database(path.join(app.getPath("userData"), "saku.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL, note TEXT, date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS vault (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS budgets (month TEXT PRIMARY KEY, amount INTEGER NOT NULL);`);
  db.exec("CREATE TABLE IF NOT EXISTS savings_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, target INTEGER NOT NULL, current INTEGER NOT NULL DEFAULT 0, deadline TEXT)");
}
function encrypt(value: unknown) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}
function decrypt(raw: string) {
  const b = Buffer.from(raw, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", vaultKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
}
function derivePin(pin: string, salt: Buffer) {
  return crypto.scryptSync(pin, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
}
function setting(key: string) {
  return (db.prepare("SELECT value FROM settings WHERE key=?").get(key) as any)?.value;
}
function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
function backupKey(password: string, salt: Buffer) {
  return crypto.scryptSync(password, salt, 32, { N: 65536, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}
function snapshot() {
  const vault = (db.prepare("SELECT kind,title,payload,created_at FROM vault").all() as any[]).map((x) => ({ ...x, payload: decrypt(x.payload) }));
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    transactions: db.prepare("SELECT type,category,amount,note,date FROM transactions").all(),
    vault,
  };
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    icon: path.join(__dirname, "../renderer/icon-only.png"),
    webPreferences: { preload: path.join(__dirname, "../preload/index.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    if (process.env.SAKU_DEVTOOLS === "1") win.webContents.openDevTools();
  } else win.loadFile(path.join(__dirname, "../renderer/index.html"));
}
app.whenReady().then(() => {
  log.initialize();
  log.info("SAKU starting", { version: app.getVersion() });
  initDb();
  ipcMain.handle("app:summary", () => {
    const rows = db.prepare("SELECT type, SUM(amount) total FROM transactions GROUP BY type").all() as any[];
    return { income: rows.find((r) => r.type === "income")?.total ?? 0, expense: rows.find((r) => r.type === "expense")?.total ?? 0 };
  });
  ipcMain.handle("transactions:list", () => db.prepare("SELECT * FROM transactions ORDER BY date DESC, id DESC").all());
  ipcMain.handle("transactions:delete", (_e, id: number) => db.prepare("DELETE FROM transactions WHERE id=?").run(id));
  ipcMain.handle("transactions:update", (_e, tx: any) => { if (!Number.isInteger(tx.id) || !["income", "expense"].includes(tx.type) || !tx.category || !Number.isSafeInteger(tx.amount) || tx.amount < 0) throw new Error("Transaksi tidak valid"); return db.prepare("UPDATE transactions SET type=?,category=?,amount=?,note=?,date=? WHERE id=?").run(tx.type, tx.category, tx.amount, tx.note ?? "", tx.date, tx.id); });
  ipcMain.handle("budget:get", () => {
    const month = new Date().toISOString().slice(0, 7);
    return db.prepare("SELECT month, amount FROM budgets WHERE month=?").get(month) ?? { month, amount: 0 };
  });
  ipcMain.handle("budget:set", (_e, amount: number) => {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Budget tidak valid");
    const month = new Date().toISOString().slice(0, 7);
    return db.prepare("INSERT INTO budgets(month,amount) VALUES(?,?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount").run(month, amount);
  });
  ipcMain.handle("savings:list", () => db.prepare("SELECT * FROM savings_goals ORDER BY id DESC").all());
  ipcMain.handle("savings:add", (_e, goal: any) => { if (!goal.title || !Number.isSafeInteger(goal.target) || goal.target <= 0 || !Number.isSafeInteger(goal.current) || goal.current < 0) throw new Error("Target tabungan tidak valid"); return db.prepare("INSERT INTO savings_goals(title,target,current,deadline) VALUES(?,?,?,?)").run(goal.title, goal.target, goal.current, goal.deadline ?? null); });
  ipcMain.handle("savings:update", (_e, goal: any) => { if (!Number.isInteger(goal.id) || !goal.title || !Number.isSafeInteger(goal.target) || goal.target <= 0 || !Number.isSafeInteger(goal.current) || goal.current < 0) throw new Error("Target tabungan tidak valid"); return db.prepare("UPDATE savings_goals SET title=?,target=?,current=?,deadline=? WHERE id=?").run(goal.title, goal.target, goal.current, goal.deadline ?? null, goal.id); });
  ipcMain.handle("savings:delete", (_e, id: number) => db.prepare("DELETE FROM savings_goals WHERE id=?").run(id));
  ipcMain.handle("transactions:add", (_e, tx) =>
    db
      .prepare("INSERT INTO transactions(type,category,amount,note,date) VALUES(?,?,?,?,?)")
      .run(tx.type, tx.category, tx.amount, tx.note ?? "", tx.date),
  );
  ipcMain.handle("vault:list", () => db.prepare("SELECT id,kind,title,created_at FROM vault ORDER BY id DESC").all());
  ipcMain.handle("vault:add", (_e, item) =>
    db
      .prepare("INSERT INTO vault(kind,title,payload,created_at) VALUES(?,?,?,?)")
      .run(item.kind, item.title, encrypt(item.payload), new Date().toISOString()),
  );
  ipcMain.handle("vault:read", (_e, id) => {
    const row = db.prepare("SELECT * FROM vault WHERE id=?").get(id) as any;
    return row ? { ...row, payload: decrypt(row.payload) } : null;
  });
  ipcMain.handle("vault:delete", (_e, id: number) => db.prepare("DELETE FROM vault WHERE id=?").run(id));
  ipcMain.handle("vault:update", (_e, item: any) => { if (!Number.isInteger(item.id) || !item.title || !item.kind) throw new Error("Item vault tidak valid"); return db.prepare("UPDATE vault SET kind=?,title=?,payload=? WHERE id=?").run(item.kind, item.title, encrypt(item.payload), item.id); });
  ipcMain.handle("auth:status", () => ({ configured: Boolean(setting("pin_hash")), lockedUntil: Number(setting("locked_until") || 0) }));
  ipcMain.handle("auth:setup", (_e, pin: string) => {
    if (!/^\d{6}$/.test(pin)) throw new Error("PIN harus 6 digit");
    const salt = crypto.randomBytes(16), recoverySalt = crypto.randomBytes(16), recovery = crypto.randomBytes(18).toString("base64url");
    setSetting("pin_salt", salt.toString("base64"));
    setSetting("pin_hash", derivePin(pin, salt).toString("base64"));
    setSetting("recovery_salt", recoverySalt.toString("base64"));
    setSetting("recovery_hash", derivePin(recovery, recoverySalt).toString("base64"));
    setSetting("pin_attempts", "0");
    setSetting("locked_until", "0");
    return { recovery };
  });
  ipcMain.handle("auth:verify", (_e, pin: string) => {
    const until = Number(setting("locked_until") || 0);
    if (Date.now() < until) return { ok: false, lockedUntil: until };
    const salt = Buffer.from(setting("pin_salt"), "base64"),
      expected = Buffer.from(setting("pin_hash"), "base64"),
      actual = derivePin(pin, salt);
    const ok = crypto.timingSafeEqual(actual, expected);
    if (ok) {
      setSetting("pin_attempts", "0");
      return { ok: true };
    }
    const attempts = Number(setting("pin_attempts") || 0) + 1;
    setSetting("pin_attempts", String(attempts));
    if (attempts >= 5) {
      const lock = Date.now() + 30_000;
      setSetting("locked_until", String(lock));
      setSetting("pin_attempts", "0");
      return { ok: false, lockedUntil: lock };
    }
    return { ok: false, remaining: 5 - attempts };
  });
  ipcMain.handle("auth:recover", (_e, recovery: string, newPin: string) => { if (!/^\d{6}$/.test(newPin) || !recovery) throw new Error("Recovery key atau PIN tidak valid"); const salt = Buffer.from(setting("recovery_salt"), "base64"), expected = Buffer.from(setting("recovery_hash"), "base64"), actual = derivePin(recovery, salt); if (!crypto.timingSafeEqual(actual, expected)) throw new Error("Recovery key salah"); const pinSalt = crypto.randomBytes(16); setSetting("pin_salt", pinSalt.toString("base64")); setSetting("pin_hash", derivePin(newPin, pinSalt).toString("base64")); setSetting("pin_attempts", "0"); setSetting("locked_until", "0"); return true; });
  ipcMain.handle("auth:change", (_e, currentPin: string, newPin: string) => { if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)) throw new Error("PIN harus 6 digit"); const salt = Buffer.from(setting("pin_salt"), "base64"), expected = Buffer.from(setting("pin_hash"), "base64"), actual = derivePin(currentPin, salt); if (!crypto.timingSafeEqual(actual, expected)) throw new Error("PIN lama salah"); const pinSalt = crypto.randomBytes(16); setSetting("pin_salt", pinSalt.toString("base64")); setSetting("pin_hash", derivePin(newPin, pinSalt).toString("base64")); setSetting("pin_attempts", "0"); setSetting("locked_until", "0"); return true; });
  ipcMain.handle("backup:export", async (_e, password: string) => {
    if (!password || password.length < 10) throw new Error("Password backup minimal 10 karakter");
    const salt = crypto.randomBytes(16),
      iv = crypto.randomBytes(12),
      c = crypto.createCipheriv("aes-256-gcm", backupKey(password, salt), iv);
    const body = Buffer.concat([c.update(JSON.stringify(snapshot())), c.final()]);
    const payload = JSON.stringify({
      format: "SAKU",
      version: 2,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: c.getAuthTag().toString("base64"),
      data: body.toString("base64"),
    });
    const result = await dialog.showSaveDialog({ defaultPath: "saku-backup.saku", filters: [{ name: "SAKU Backup", extensions: ["saku"] }] });
    if (result.canceled || !result.filePath) return false;
    const fs = await import("node:fs");
    fs.writeFileSync(result.filePath, payload, "utf8");
    return true;
  });
  ipcMain.handle("backup:import", async (_e, password: string, mode: "merge" | "replace") => {
    if (!password || password.length < 10) throw new Error("Password backup minimal 10 karakter");
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "SAKU Backup", extensions: ["saku"] }] });
    if (result.canceled || !result.filePaths[0]) return false;
    const fs = await import("node:fs");
    const raw = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    if (raw.format !== "SAKU" || ![1, 2].includes(raw.version)) throw new Error("Format backup tidak valid");
    const d = crypto.createDecipheriv("aes-256-gcm", backupKey(password, Buffer.from(raw.salt, "base64")), Buffer.from(raw.iv, "base64"));
    d.setAuthTag(Buffer.from(raw.tag, "base64"));
    const data = JSON.parse(Buffer.concat([d.update(Buffer.from(raw.data, "base64")), d.final()]).toString());
    const tx = data.transactions ?? [],
      vault = data.vault ?? [];
    const transaction = db.transaction(() => {
      if (mode === "replace") {
        const backupPath = path.join(app.getPath("userData"), `saku-before-restore-${Date.now()}.sqlite`);
        db.pragma("wal_checkpoint(TRUNCATE)");
        fs.copyFileSync(path.join(app.getPath("userData"), "saku.sqlite"), backupPath);
        db.exec("DELETE FROM transactions; DELETE FROM vault;");
      }
      const addTx = db.prepare("INSERT INTO transactions(type,category,amount,note,date) VALUES(?,?,?,?,?)");
      const existingTx = new Set((db.prepare("SELECT type,category,amount,note,date FROM transactions").all() as any[]).map((x) => JSON.stringify(x)));
      for (const x of tx) { const key = JSON.stringify({ type: x.type, category: x.category, amount: x.amount, note: x.note ?? "", date: x.date }); if (mode === "merge" && existingTx.has(key)) continue; addTx.run(x.type, x.category, x.amount, x.note ?? "", x.date); }
      const addVault = db.prepare("INSERT INTO vault(kind,title,payload,created_at) VALUES(?,?,?,?)");
      const existingVault = new Set((db.prepare("SELECT kind,title,created_at FROM vault").all() as any[]).map((x) => JSON.stringify(x)));
      for (const x of vault) { const key = JSON.stringify({ kind: x.kind, title: x.title, created_at: x.created_at }); if (mode === "merge" && existingVault.has(key)) continue; addVault.run(x.kind, x.title, encrypt(x.payload), x.created_at); }
    });
    transaction();
    return true;
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
process.on("uncaughtException", (error) => log.error("Uncaught exception", error));
process.on("unhandledRejection", (error) => log.error("Unhandled rejection", error));
app.on("before-quit", () => { if (db) db.close(); });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
