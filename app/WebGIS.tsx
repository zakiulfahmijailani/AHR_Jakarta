"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { GeoJSON as LeafletGeoJSON, Map as LeafletMap } from "leaflet";
import { Building2, ExternalLink, House, MapPin, Phone, Search, ShieldCheck, TrainFront, X } from "lucide-react";

type AhrProperties = {
  nama_ahr?: string;
  tipe_ahr?: string;
  alamat?: string;
  status_sewa?: string;
  kontak_telepon?: string;
  url_sumber?: string;
  jarak_ke_jalur_m?: number;
  layanan_terdekat?: string;
  google_maps_url?: string;
  google_maps_pin_url?: string;
  google_directions_url?: string;
  google_place_id?: string;
  tingkat_kepercayaan?: "tinggi" | "menengah";
  status_verifikasi?: string;
  sumber_kontak?: string;
  jenis_kontak?: string;
  kontak_tambahan?: string[];
  url_resmi?: string;
  url_kontak?: string;
  tanggal_verifikasi_kontak?: string;
};

type AhrFeature = Feature<Point, AhrProperties>;
type AhrCollection = FeatureCollection<Point, AhrProperties>;
type MapCollection = FeatureCollection<Geometry, Record<string, unknown>>;

const EMPTY_COLLECTION: AhrCollection = { type: "FeatureCollection", features: [] };
const formatNumber = new Intl.NumberFormat("id-ID");

function propertyGroup(value = "") {
  const type = value.toLowerCase();
  if (type.includes("apartment")) return "apartemen";
  if (["house", "detached", "terrace", "bungalow", "semidetached_house"].some((item) => type.includes(item))) return "rumah";
  return "hunian";
}

function cleanText(value?: string, fallback = "Belum tersedia") {
  if (!value || ["<NA>", "nan", "None"].includes(String(value))) return fallback;
  return String(value);
}

function googlePlacePageUrl(feature: AhrFeature) {
  const properties = feature.properties;
  const name = cleanText(properties.nama_ahr, "").trim();
  const address = cleanText(properties.alamat, "").trim();
  const query = [name, address, "Jakarta, Indonesia"].filter(Boolean).join(", ");
  const baseUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return properties.google_place_id
    ? `${baseUrl}&query_place_id=${encodeURIComponent(properties.google_place_id)}`
    : baseUrl;
}

async function fetchLayer<T>(name: string): Promise<T> {
  const response = await fetch(`/api/layers?name=${name}`);
  if (!response.ok) throw new Error(`Layer ${name} gagal dimuat dari Neon.`);
  return response.json() as Promise<T>;
}

export default function WebGIS() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const ahrLayerRef = useRef<LeafletGeoJSON | null>(null);
  const allAhrRef = useRef<AhrCollection>(EMPTY_COLLECTION);
  const [ahr, setAhr] = useState<AhrCollection>(EMPTY_COLLECTION);
  const [stationsCount, setStationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [buffer, setBuffer] = useState(1000);
  const [type, setType] = useState("semua");
  const [service, setService] = useState("semua");
  const [contact, setContact] = useState("semua");
  const [services, setServices] = useState<string[]>([]);
  const [selected, setSelected] = useState<AhrFeature | null>(null);

  const showFeature = useCallback((feature: AhrFeature) => {
    const map = mapRef.current;
    if (!map) return;
    const [longitude, latitude] = feature.geometry.coordinates;
    setSelected(feature);
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let disposed = false;
    let localMap: LeafletMap | null = null;

    async function initializeMap() {
      try {
        const L = await import("leaflet");
        if (disposed || !mapContainer.current) return;

        const map = L.map(mapContainer.current, {
          center: [-6.245, 106.855],
          zoom: 11,
          minZoom: 9,
          maxZoom: 19,
          preferCanvas: true,
          zoomControl: false,
        });
        localMap = map;
        mapRef.current = map;

        L.control.zoom({ position: "topright" }).addTo(map);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors © CARTO",
        }).addTo(map);

        const [ahrData, networkData, buffersData, stationsData] = await Promise.all([
          fetchLayer<AhrCollection>("ahr"),
          fetchLayer<MapCollection>("network"),
          fetchLayer<MapCollection>("buffers"),
          fetchLayer<MapCollection>("stations"),
        ]);
        if (disposed) return;

        allAhrRef.current = ahrData;
        setAhr(ahrData);
        setStationsCount(stationsData.features.length);
        setServices([...new Set(ahrData.features.map((feature) => cleanText(feature.properties.layanan_terdekat, "Lainnya")))].sort());

        L.geoJSON(buffersData, {
          style: (feature) => {
            const distanceValue = Number(feature?.properties?.buffer_m || 1000);
            const color = distanceValue === 500 ? "#ee6c36" : distanceValue === 700 ? "#e4a72b" : "#3687b8";
            return { color, weight: 1.5, fillColor: color, fillOpacity: 0.09 };
          },
        }).addTo(map);

        L.geoJSON(networkData, {
          style: (feature) => ({
            color: String(feature?.properties?.service || "").includes("MRT") ? "#0b6b4f" : "#7047a3",
            weight: 5,
            opacity: 0.95,
          }),
        }).addTo(map);

        L.geoJSON(stationsData, {
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: 5,
            color: "#17211d",
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 1,
          }),
        }).addTo(map);

        const sharedCanvas = L.canvas({ padding: 0.5 });
        const ahrLayer = L.geoJSON(ahrData, {
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            renderer: sharedCanvas,
            radius: 4,
            color: "#ffffff",
            weight: 1,
            fillColor: feature?.properties?.tingkat_kepercayaan === "tinggi" ? "#0b7a59" : "#ee6c36",
            fillOpacity: 0.9,
          }),
          onEachFeature: (feature, layer) => {
            layer.on("click", () => showFeature(feature as AhrFeature));
          },
        }).addTo(map);
        ahrLayerRef.current = ahrLayer;

        map.fitBounds([[-6.43, 106.74], [-6.14, 107.15]], { padding: [32, 32] });
        window.setTimeout(() => map.invalidateSize(), 50);
        setLoading(false);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Data peta gagal dimuat.");
        setLoading(false);
      }
    }

    initializeMap();
    return () => {
      disposed = true;
      ahrLayerRef.current = null;
      localMap?.remove();
      mapRef.current = null;
    };
  }, [showFeature]);

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = allAhrRef.current.features.filter((feature) => {
      const properties = feature.properties;
      const distanceMatch = Number(properties.jarak_ke_jalur_m || 0) <= buffer;
      const typeMatch = type === "semua" || propertyGroup(properties.tipe_ahr) === type;
      const serviceMatch = service === "semua" || cleanText(properties.layanan_terdekat, "Lainnya") === service;
      const hasContact = Boolean(properties.kontak_telepon);
      const contactMatch = contact === "semua" || (contact === "tersedia" ? hasContact : !hasContact);
      const searchText = `${properties.nama_ahr || ""} ${properties.alamat || ""} ${properties.kontak_telepon || ""}`.toLowerCase();
      return distanceMatch && typeMatch && serviceMatch && contactMatch && (!normalizedQuery || searchText.includes(normalizedQuery));
    });
    const nextCollection: AhrCollection = { type: "FeatureCollection", features: filtered };
    setAhr(nextCollection);
    ahrLayerRef.current?.clearLayers();
    ahrLayerRef.current?.addData(nextCollection);
  }, [buffer, contact, query, service, type]);

  const visibleResults = useMemo(() => ahr.features.slice(0, 60), [ahr]);
  const contactsCount = useMemo(() => allAhrRef.current.features.filter((feature) => feature.properties.kontak_telepon).length, [ahr]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><TrainFront size={21} aria-hidden="true" /></div>
          <div><h1>AHR Jakarta</h1><p>Hunian dalam koridor MRT & LRT Jabodebek</p></div>
        </div>
        <div className="top-stats" aria-label="Ringkasan data">
          <div className="top-stat"><strong>{formatNumber.format(ahr.features.length)}</strong><span>AHR terlihat</span></div>
          <div className="top-stat"><strong>{formatNumber.format(contactsCount)}</strong><span>Nomor kontak</span></div>
          <div className="top-stat"><strong>{formatNumber.format(stationsCount)}</strong><span>Stasiun</span></div>
          <div className="top-stat"><strong>{buffer} m</strong><span>Koridor</span></div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Pencarian dan daftar AHR">
          <div className="controls">
            <label className="section-label" htmlFor="search-ahr">Temukan hunian</label>
            <div className="search-wrap">
              <Search size={17} aria-hidden="true" />
              <input id="search-ahr" className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau alamat..." />
            </div>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="buffer">Jarak dari jalur</label>
                <select id="buffer" className="select" value={buffer} onChange={(event) => setBuffer(Number(event.target.value))}>
                  <option value={500}>≤ 500 meter</option><option value={700}>≤ 700 meter</option><option value={1000}>≤ 1 kilometer</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="type">Jenis hunian</label>
                <select id="type" className="select" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="semua">Semua jenis</option><option value="apartemen">Apartemen</option><option value="hunian">Hunian</option><option value="rumah">Rumah</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="service">Layanan terdekat</label>
                <select id="service" className="select" value={service} onChange={(event) => setService(event.target.value)}>
                  <option value="semua">Semua MRT & LRT</option>{services.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="contact">Ketersediaan kontak</label>
                <select id="contact" className="select" value={contact} onChange={(event) => setContact(event.target.value)}>
                  <option value="semua">Semua AHR terkurasi</option><option value="tersedia">Nomor tersedia</option><option value="cari">Cari melalui Google Maps</option>
                </select>
              </div>
            </div>
          </div>

          <div className="result-head"><h2>AHR terkurasi</h2><span>{contactsCount} nomor tersedia · maks. 60 hasil</span></div>
          <div className="result-list">
            {visibleResults.map((feature, index) => {
              const properties = feature.properties;
              const key = `${properties.url_sumber || "ahr"}-${index}`;
              const active = selected?.properties.url_sumber === properties.url_sumber;
              return (
                <button className={`result-card${active ? " active" : ""}`} key={key} onClick={() => showFeature(feature)}>
                  <span className="result-icon">{propertyGroup(properties.tipe_ahr) === "rumah" ? <House size={16} /> : <Building2 size={16} />}</span>
                  <span className="result-main"><strong>{cleanText(properties.nama_ahr, "Kandidat AHR")}</strong><small>{cleanText(properties.alamat)} · {cleanText(properties.layanan_terdekat)}</small></span>
                  <span className="distance">{properties.kontak_telepon && <Phone size={10} aria-label="Nomor tersedia" />}{Math.round(Number(properties.jarak_ke_jalur_m || 0))} m</span>
                </button>
              );
            })}
            {!loading && visibleResults.length === 0 && <div className="empty-state">Tidak ada AHR yang cocok. Coba perluas jarak atau hapus kata pencarian.</div>}
          </div>
        </aside>

        <section className="map-wrap" aria-label="Peta kandidat AHR">
          <div ref={mapContainer} className="map" />
          {loading && <div className="map-status">Memuat jaringan dan kandidat AHR…</div>}
          {error && <div className="map-status error">{error}</div>}
          <div className="legend" aria-label="Legenda peta">
            <h3>Legenda</h3>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "#0b6b4f" }} /> MRT Jakarta</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "#7047a3" }} /> LRT Jabodebek</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: "#0b7a59" }} /> Kepercayaan tinggi</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: "#ee6c36" }} /> Kepercayaan menengah</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: "white", border: "2px solid #17211d" }} /> Stasiun</div>
          </div>

          {selected && (
            <article className="detail-card">
              <button className="detail-close" aria-label="Tutup detail" onClick={() => setSelected(null)}><X size={15} /></button>
              <span className="detail-kicker">{cleanText(selected.properties.tipe_ahr, "Hunian")}</span>
              <h2>{cleanText(selected.properties.nama_ahr, "Kandidat AHR")}</h2>
              <p className="detail-address"><MapPin size={11} style={{ verticalAlign: "-2px", marginRight: 3 }} />{cleanText(selected.properties.alamat)}</p>
              <div className="detail-grid">
                <div className="detail-item"><span>Jarak</span><strong>{Math.round(Number(selected.properties.jarak_ke_jalur_m || 0))} m</strong></div>
                <div className="detail-item"><span>Layanan</span><strong>{cleanText(selected.properties.layanan_terdekat)}</strong></div>
                <div className="detail-item"><span>Kepercayaan</span><strong><ShieldCheck size={11} /> {cleanText(selected.properties.tingkat_kepercayaan)}</strong></div>
              </div>
              {selected.properties.kontak_telepon ? (
                <div className="contact-box">
                  <span>{cleanText(selected.properties.jenis_kontak, "Kontak publik")}</span>
                  <a href={`tel:${selected.properties.kontak_telepon.replace(/\s/g, "")}`}><Phone size={15} /> {selected.properties.kontak_telepon}</a>
                  {selected.properties.kontak_tambahan?.length ? <small>Alternatif: {selected.properties.kontak_tambahan.join(" · ")}</small> : null}
                  <small>Sumber: {cleanText(selected.properties.sumber_kontak)}</small>
                </div>
              ) : (
                <div className="contact-box missing"><span>Nomor belum tersedia dari sumber gratis</span><small>Buka Google Maps untuk memeriksa nomor pengelola terbaru.</small></div>
              )}
              <div className="detail-actions">
                <a className="action-link full" href={googlePlacePageUrl(selected)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Lihat ulasan & info Google Maps</a>
                {(selected.properties.url_kontak || selected.properties.url_resmi) && <a className="action-link secondary full" href={selected.properties.url_kontak || selected.properties.url_resmi} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Sumber resmi</a>}
              </div>
              <p className="data-note">Data telah disaring dari kandidat OSM. Nomor hanya ditampilkan bila ditemukan pada sumber publik gratis; periksa kembali sebelum menghubungi.</p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
