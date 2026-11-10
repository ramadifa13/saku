# SAKU

SAKU adalah aplikasi desktop personal management offline untuk keuangan dan data privat.

## Arsitektur

- `src/main`: Electron main process, SQLite (`better-sqlite3`), dan AES-256-GCM.
- `src/preload`: API IPC terseleksi melalui `contextBridge`; renderer tidak memiliki akses Node.
- `src/renderer`: React UI dashboard, finance, dan vault.
- Database disimpan di folder `app.getPath('userData')` dengan WAL mode.

## Menjalankan

```bash
npm install
npm run dev
```

Build installer Windows:

```bash
npm run dist
```

## Catatan keamanan

Vault payload dienkripsi dengan AES-256-GCM menggunakan kunci lokal yang diturunkan dari lokasi user-data. Sebelum rilis produksi, implementasikan bootstrap PIN Argon2id/scrypt, lockout, auto-lock, recovery key, serta format backup `.saku` terenkripsi password sebelum distribusi. API renderer sudah dibatasi dengan `contextIsolation: true` dan `nodeIntegration: false`.

## Penggunaan rilis

- Development: `npm run dev`
- Production lokal: `npm run build` lalu `npm start`
- Installer Windows: `npm run dist`
- Pemeriksaan: `npm run typecheck` dan `npm test`

Recovery key hanya ditampilkan sekali saat PIN pertama dibuat. Simpan di password manager terpisah; aplikasi tidak dapat menampilkan ulang key tersebut.

## Status fitur

Dashboard, ringkasan cash-flow, pencatatan transaksi SQLite, budget, target tabungan, tema gelap/terang, Personal Vault terenkripsi, PIN lock, recovery key, auto-lock, serta backup/restore terenkripsi sudah tersedia. Installer Windows dibuat unsigned; code signing perlu dilakukan dengan sertifikat publisher sebelum distribusi publik.
