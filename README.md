# AHR Jakarta WebGIS

WebGIS sederhana untuk menjelajahi apartemen, hunian, dan rumah terkurasi dalam koridor 500 meter, 700 meter, dan 1 kilometer dari jaringan MRT Jakarta dan LRT Jabodebek.

Layer GeoJSON disimpan sebagai JSONB di Neon Postgres dan disajikan melalui API Vercel dengan cache CDN.

## Fitur

- Peta interaktif dengan 252 titik AHR bernama hasil penyaringan 3.195 kandidat mentah.
- Filter jarak, jenis hunian, layanan terdekat, dan ketersediaan kontak.
- Pencarian nama atau alamat.
- Panel detail dengan nomor telepon publik yang terverifikasi, sumber resmi, Google Maps, dan petunjuk arah.
- Tampilan responsif untuk desktop dan perangkat seluler.

## Data

Data jaringan, stasiun, buffer, dan kandidat awal berasal dari OpenStreetMap dan hasil pengolahan notebook AHR MRT/LRT. Objek umum, kandidat tanpa nama, dan tipe non-hunian dikeluarkan dari layer WebGIS. Kontak hanya diambil dari sumber publik gratis yang dicantumkan pada setiap objek; ketersediaannya tidak dijamin. Cantumkan atribusi © OpenStreetMap contributors (ODbL) ketika data digunakan kembali.

Untuk mereproduksi layer gratis:

```bash
node scripts/clean-ahr.mjs
node scripts/enrich-osm-contacts.mjs
node scripts/apply-free-contacts.mjs
```

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
