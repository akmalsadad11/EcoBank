# EcoBank Backend

REST API untuk Bank Sampah Digital (EcoBank): Node.js + Express + PostgreSQL.
Mendukung 3 peran: **nasabah**, **petugas**, **admin**.

## Menjalankan (Windows / VS Code)

1. Buat database kosong bernama `ecobank` di PostgreSQL (lewat DBeaver atau `createdb ecobank`).
2. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` dan `JWT_SECRET`.
3. Jalankan:

```
npm install
npm run db:setup
npm run dev
```

API aktif di `http://localhost:4000`. Cek: `http://localhost:4000/api/health`.

`npm run db:setup` membuat tabel, 9 jenis sampah, 6 hadiah, akun admin, dan (jika `SEED_DEMO=true`) akun contoh:

| Peran   | Login                  | Kata sandi  |
|---------|------------------------|-------------|
| Admin   | admin@ecobank.local    | Admin12345  |
| Petugas | 081100000001           | petugas123  |
| Nasabah | 081234567890           | nasabah123  |

Ganti kata sandi admin sebelum dipakai sungguhan.

## Format

Sukses: `{ "ok": true, "data": ..., "pesan": "..." }`
Gagal: `{ "ok": false, "pesan": "...", "detail": [{ "field", "pesan" }] }`

Setelah login, kirim header `Authorization: Bearer <token>` di semua request.

```js
const API = 'http://localhost:4000/api';
const res = await fetch(API + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: '081234567890', password: 'nasabah123', ingat: true }),
});
const { data } = await res.json();
localStorage.setItem('token', data.token);
location.href = data.redirect;   // halaman sesuai peran
```

## Endpoint

### Auth (`/api/auth`)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/register` | Daftar nasabah: `nama, telepon, email, password, alamat` |
| POST | `/login` | `id` (telepon/email), `password`, `ingat` (opsional). Mengembalikan `token`, `user`, `redirect` |
| GET | `/me` | Data akun login |
| PUT | `/me` | Ubah `nama, alamat, telepon, email` |
| PUT | `/password` | `password_lama`, `password_baru` |

### Nasabah (butuh peran nasabah)
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/nasabah/dashboard` | Saldo, poin, total kg, penjemputan aktif, riwayat, notifikasi |
| GET | `/api/nasabah/riwayat?page=&limit=` | Semua transaksi |
| POST | `/api/penjemputan` | `jenis[]`, `estimasi_berat`, `tanggal` (YYYY-MM-DD), `jam`, `alamat?`, `catatan?`, `lat?`, `lon?` |
| GET | `/api/penjemputan` | Daftar penjemputan saya |
| GET | `/api/penjemputan/:id` | Detail |
| PATCH | `/api/penjemputan/:id/batal` | Hanya selama status `baru` |
| GET | `/api/rewards` | Daftar hadiah + `cukup` / `kurang_poin` |
| POST | `/api/rewards/:id/tukar` | Tukar poin |
| GET | `/api/rewards/riwayat` | Riwayat penukaran |

Nilai `estimasi_berat`: `Kurang dari 5 kg`, `5 - 10 kg`, `10 - 20 kg`, `20 - 50 kg`, `Lebih dari 50 kg`.
Nilai `jam`: `08:00 - 10:00`, `10:00 - 12:00`, `13:00 - 15:00`, `15:00 - 17:00`.

### Semua peran
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/notifikasi` | 30 notifikasi terbaru |
| POST | `/api/notifikasi/baca` | Tandai semua dibaca |
| GET | `/api/jenis-sampah` | Master jenis & harga (untuk form timbangan) |

### Petugas (butuh peran petugas)
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/petugas/tugas?kategori=baru\|diproses\|selesai&q=&sort=weight` | Daftar tugas + `jumlah` per kategori |
| GET | `/api/petugas/tugas/:id` | Detail (termasuk setoran jika sudah selesai) |
| PATCH | `/api/petugas/tugas/:id/status` | `{ "status": "dalam_perjalanan" }` lalu `{ "status": "tiba" }` |
| POST | `/api/petugas/tugas/:id/selesai` | "Selesai & setor": `items: [{ nama, berat }]` + foto bukti opsional |

Untuk `selesai` dengan foto, kirim `multipart/form-data` dengan field `items` (string JSON) dan `foto` (JPG/PNG/WebP, maks 5 MB). Tanpa foto, boleh JSON biasa.
Nama di `items` harus sama dengan master jenis sampah (tidak peka huruf besar/kecil), atau pakai `jenis_id`.

### Admin (butuh peran admin), prefix `/api/admin`
| Method | Path | Keterangan |
|---|---|---|
| GET | `/dashboard` | KPI, tren 6 bulan, daftar "perlu tindakan" |
| GET/POST | `/nasabah` | Daftar (`?q=`) / tambah |
| PUT/DELETE | `/nasabah/:id` | Ubah / nonaktifkan |
| GET/POST | `/petugas` | Daftar / tambah |
| DELETE | `/petugas/:id` | Nonaktifkan |
| GET/POST | `/jenis-sampah` | Master jenis & harga |
| PUT/DELETE | `/jenis-sampah/:id` | Ubah / hapus |
| GET | `/penjemputan?tab=Semua\|Baru\|Dijemput\|Selesai` | Daftar + `jumlah` per tab |
| PATCH | `/penjemputan/:id/petugas` | Tugaskan petugas: `{ "petugas_id": 2 }` |
| PATCH | `/penjemputan/:id/batal` | Batalkan |
| GET | `/setoran?tanggal=&status=` | Riwayat transaksi |
| POST | `/setoran` | Catat manual: `{ nasabah_id, items: [{ nama, berat }] }` |
| PATCH | `/setoran/:id/batal` | Batalkan + koreksi saldo/poin |
| GET | `/setoran/export` | Unduh CSV (tombol Export) |
| GET | `/penukaran` | Daftar penukaran poin |
| PATCH | `/penukaran/:id/selesai` | Tandai hadiah sudah diproses |

## Aturan bisnis

- Nilai setoran = berat x harga/kg, poin = berat x poin/kg (dibulatkan ke bawah), per jenis sampah.
- Saldo dan poin nasabah bertambah otomatis saat petugas menyelesaikan tugas atau admin mencatat setoran.
- Membatalkan setoran ditolak jika saldo/poin nasabah sudah terpakai.
- Status penjemputan: `baru` -> `dalam_perjalanan` -> `tiba` -> `selesai` (atau `dibatalkan`).
  Respons memuat `tahap_nasabah` (0-2) dan `langkah_petugas` (-1 sampai 2) untuk stepper di frontend.
- Petugas melihat tugas `baru` yang belum diambil, dan tugas miliknya. Menekan "Mulai perjalanan" otomatis mengambil tugas itu.

## Deploy

- Backend butuh server Node yang berjalan terus (Render, Railway, VPS). Vercel hanya cocok untuk frontend statis.
- Foto bukti disimpan di folder `uploads/`. Di hosting dengan disk sementara, foto bisa hilang saat redeploy; pakai volume persisten atau layanan penyimpanan objek.
- Di production: isi `NODE_ENV=production`, `JWT_SECRET` acak panjang, `CORS_ORIGIN` berisi domain frontend, `DATABASE_SSL=true` bila diwajibkan penyedia database, dan `PUBLIC_URL` dengan URL backend.
