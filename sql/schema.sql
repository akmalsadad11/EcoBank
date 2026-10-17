-- =========================================================
-- EcoBank / Bank Sampah Digital - skema PostgreSQL
-- Aman dijalankan berulang (IF NOT EXISTS)
-- =========================================================

CREATE SEQUENCE IF NOT EXISTS seq_kode_user;
CREATE SEQUENCE IF NOT EXISTS seq_kode_jenis;
CREATE SEQUENCE IF NOT EXISTS seq_kode_penjemputan;
CREATE SEQUENCE IF NOT EXISTS seq_kode_setoran;
CREATE SEQUENCE IF NOT EXISTS seq_kode_penukaran;

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    kode          TEXT UNIQUE NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('nasabah', 'petugas', 'admin')),
    nama          TEXT NOT NULL,
    telepon       TEXT NOT NULL UNIQUE,
    email         TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    alamat        TEXT,
    saldo         BIGINT NOT NULL DEFAULT 0 CHECK (saldo >= 0),
    poin          INTEGER NOT NULL DEFAULT 0 CHECK (poin >= 0),
    aktif         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS jenis_sampah (
    id           SERIAL PRIMARY KEY,
    kode         TEXT UNIQUE NOT NULL DEFAULT ('SMP-' || lpad(nextval('seq_kode_jenis')::text, 3, '0')),
    nama         TEXT NOT NULL,
    harga_per_kg INTEGER NOT NULL CHECK (harga_per_kg >= 0),
    poin_per_kg  INTEGER NOT NULL DEFAULT 10 CHECK (poin_per_kg >= 0),
    aktif        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jenis_sampah_nama_uq ON jenis_sampah (lower(nama));

CREATE TABLE IF NOT EXISTS penjemputan (
    id             SERIAL PRIMARY KEY,
    kode           TEXT UNIQUE NOT NULL DEFAULT ('PCK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_kode_penjemputan')::text, 4, '0')),
    nasabah_id     INTEGER NOT NULL REFERENCES users (id),
    petugas_id     INTEGER REFERENCES users (id),
    alamat         TEXT NOT NULL,
    jenis          TEXT[] NOT NULL,
    estimasi_berat TEXT NOT NULL,
    estimasi_kg    NUMERIC(8,1) NOT NULL DEFAULT 0,
    tanggal        DATE NOT NULL,
    jam            TEXT NOT NULL,
    catatan        TEXT,
    lat            NUMERIC(9,6),
    lon            NUMERIC(9,6),
    status         TEXT NOT NULL DEFAULT 'baru'
                   CHECK (status IN ('baru', 'dalam_perjalanan', 'tiba', 'selesai', 'dibatalkan')),
    foto_bukti     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    selesai_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_penjemputan_nasabah ON penjemputan (nasabah_id);
CREATE INDEX IF NOT EXISTS idx_penjemputan_petugas ON penjemputan (petugas_id);
CREATE INDEX IF NOT EXISTS idx_penjemputan_status ON penjemputan (status);

CREATE TABLE IF NOT EXISTS setoran (
    id             SERIAL PRIMARY KEY,
    kode           TEXT UNIQUE NOT NULL DEFAULT ('TRX-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_kode_setoran')::text, 5, '0')),
    nasabah_id     INTEGER NOT NULL REFERENCES users (id),
    penjemputan_id INTEGER UNIQUE REFERENCES penjemputan (id),
    pencatat_id    INTEGER REFERENCES users (id),
    total_berat    NUMERIC(10,2) NOT NULL CHECK (total_berat > 0),
    total_nilai    BIGINT NOT NULL CHECK (total_nilai >= 0),
    total_poin     INTEGER NOT NULL CHECK (total_poin >= 0),
    status         TEXT NOT NULL DEFAULT 'selesai' CHECK (status IN ('selesai', 'dibatalkan')),
    foto_bukti     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    dibatalkan_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_setoran_nasabah ON setoran (nasabah_id);
CREATE INDEX IF NOT EXISTS idx_setoran_created ON setoran (created_at);

CREATE TABLE IF NOT EXISTS setoran_item (
    id           SERIAL PRIMARY KEY,
    setoran_id   INTEGER NOT NULL REFERENCES setoran (id) ON DELETE CASCADE,
    jenis_id     INTEGER REFERENCES jenis_sampah (id),
    nama_jenis   TEXT NOT NULL,
    berat        NUMERIC(10,2) NOT NULL CHECK (berat > 0),
    harga_per_kg INTEGER NOT NULL,
    subtotal     BIGINT NOT NULL,
    poin         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_setoran_item_setoran ON setoran_item (setoran_id);

CREATE TABLE IF NOT EXISTS rewards (
    id          SERIAL PRIMARY KEY,
    nama        TEXT NOT NULL,
    deskripsi   TEXT,
    ikon        TEXT NOT NULL DEFAULT 'bi-gift',
    biaya_poin  INTEGER NOT NULL CHECK (biaya_poin > 0),
    stok        INTEGER CHECK (stok >= 0),
    aktif       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS penukaran (
    id          SERIAL PRIMARY KEY,
    kode        TEXT UNIQUE NOT NULL DEFAULT ('TKR-' || lpad(nextval('seq_kode_penukaran')::text, 5, '0')),
    user_id     INTEGER NOT NULL REFERENCES users (id),
    reward_id   INTEGER REFERENCES rewards (id),
    nama_reward TEXT NOT NULL,
    poin        INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'diproses' CHECK (status IN ('diproses', 'selesai')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_penukaran_user ON penukaran (user_id);

CREATE TABLE IF NOT EXISTS notifikasi (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pesan      TEXT NOT NULL,
    ikon       TEXT NOT NULL DEFAULT 'bi-info-circle',
    dibaca     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifikasi_user ON notifikasi (user_id, dibaca);
