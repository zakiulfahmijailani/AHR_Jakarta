# AHR Jakarta WebGIS

WebGIS sederhana untuk menjelajahi kandidat apartemen, hunian, dan rumah dalam koridor 500 meter, 700 meter, dan 1 kilometer dari jaringan MRT Jakarta dan LRT Jabodebek.

## Fitur

- Peta interaktif dan pengelompokan titik AHR.
- Filter jarak, jenis hunian, dan layanan terdekat.
- Pencarian nama atau alamat.
- Panel detail dengan tautan Google Maps dan petunjuk arah.
- Tampilan responsif untuk desktop dan perangkat seluler.

## Data

Data jaringan, stasiun, buffer, dan kandidat AHR berasal dari OpenStreetMap dan hasil pengolahan notebook AHR MRT/LRT. Kandidat AHR bukan bukti status sewa. Cantumkan atribusi © OpenStreetMap contributors (ODbL) ketika data digunakan kembali.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
