"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import { Building2, ExternalLink, House, MapPin, Navigation, Search, TrainFront, X } from "lucide-react";

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
};

type AhrFeature = Feature<Point, AhrProperties>;
type AhrCollection = FeatureCollection<Point, AhrProperties>;
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

export default function WebGIS() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const allAhrRef = useRef<AhrCollection>(EMPTY_COLLECTION);
  const [ahr, setAhr] = useState<AhrCollection>(EMPTY_COLLECTION);
  const [stationsCount, setStationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [buffer, setBuffer] = useState(1000);
  const [type, setType] = useState("semua");
  const [service, setService] = useState("semua");
  const [services, setServices] = useState<string[]>([]);
  const [selected, setSelected] = useState<AhrFeature | null>(null);

  const showFeature = useCallback((feature: AhrFeature) => {
    const map = mapRef.current;
    if (!map) return;
    const [longitude, latitude] = feature.geometry.coordinates;
    setSelected(feature);
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15), duration: 700 });

    const popupContent = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = cleanText(feature.properties.nama_ahr, "Kandidat AHR");
    const distance = document.createElement("div");
    distance.style.cssText = "margin-top:5px;color:#65716b;font-size:11px";
    distance.textContent = `${Math.round(Number(feature.properties.jarak_ke_jalur_m || 0))} m dari jalur`;
    popupContent.append(title, distance);

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: false })
      .setLngLat([longitude, latitude])
      .setDOMContent(popupContent)
      .addTo(map);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      center: [106.855, -6.245],
      zoom: 10.7,
      minZoom: 9,
      maxZoom: 19,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 512,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "carto", type: "raster", source: "carto" }],
      },
    });

    mapRef.current = map;
    (window as typeof window & { __AHR_MAP__?: MapLibreMap }).__AHR_MAP__ = map;
    map.on("error", (event) => {
      console.error("MapLibre layer error:", event.error?.message || event);
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", async () => {
      try {
        const [ahrResponse, networkResponse, buffersResponse, stationsResponse] = await Promise.all([
          fetch("/api/layers?name=ahr"),
          fetch("/api/layers?name=network"),
          fetch("/api/layers?name=buffers"),
          fetch("/api/layers?name=stations"),
        ]);
        if (![ahrResponse, networkResponse, buffersResponse, stationsResponse].every((response) => response.ok)) {
          throw new Error("Sebagian data peta tidak dapat dimuat.");
        }

        const [ahrData, networkData, buffersData, stationsData] = await Promise.all([
          ahrResponse.json() as Promise<AhrCollection>,
          networkResponse.json(),
          buffersResponse.json(),
          stationsResponse.json(),
        ]);

        allAhrRef.current = ahrData;
        setAhr(ahrData);
        setStationsCount(stationsData.features?.length || 0);
        setServices([...new Set(ahrData.features.map((feature) => cleanText(feature.properties.layanan_terdekat, "Lainnya")))].sort());

        map.addSource("buffers", { type: "geojson", data: buffersData });
        [1000, 700, 500].forEach((distanceValue) => {
          const color = distanceValue === 500 ? "#ee6c36" : distanceValue === 700 ? "#e4a72b" : "#3687b8";
          map.addLayer({
            id: `buffer-${distanceValue}`,
            type: "fill",
            source: "buffers",
            filter: ["==", ["get", "buffer_m"], distanceValue],
            paint: { "fill-color": color, "fill-opacity": 0.07, "fill-outline-color": color },
          });
        });

        map.addSource("network", { type: "geojson", data: networkData });
        map.addLayer({ id: "network-line-halo", type: "line", source: "network", paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 } });
        map.addLayer({
          id: "network-line",
          type: "line",
          source: "network",
          paint: { "line-color": ["case", ["in", "MRT", ["get", "service"]], "#0b6b4f", "#7047a3"], "line-width": 4 },
        });

        map.addSource("stations", { type: "geojson", data: stationsData });
        map.addLayer({
          id: "stations",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6],
            "circle-color": "#ffffff",
            "circle-stroke-color": "#17211d",
            "circle-stroke-width": 2.5,
          },
        });

        map.addSource("ahr", { type: "geojson", data: ahrData, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 });
        map.addLayer({
          id: "ahr-clusters",
          type: "circle",
          source: "ahr",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], "#b8dfcf", 30, "#56a98a", 120, "#0b6b4f"],
            "circle-radius": ["step", ["get", "point_count"], 15, 30, 20, 120, 27],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "ahr-cluster-count",
          type: "symbol",
          source: "ahr",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "ahr-unclustered",
          type: "circle",
          source: "ahr",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 16, 7],
            "circle-color": "#ee6c36",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });

        map.on("click", "ahr-clusters", async (event) => {
          const cluster = map.queryRenderedFeatures(event.point, { layers: ["ahr-clusters"] })[0];
          if (!cluster) return;
          const clusterId = Number(cluster.properties?.cluster_id);
          const source = map.getSource("ahr") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          const coordinates = (cluster.geometry as Point).coordinates as [number, number];
          map.easeTo({ center: coordinates, zoom });
        });
        map.on("click", "ahr-unclustered", (event) => {
          const feature = event.features?.[0] as unknown as AhrFeature | undefined;
          if (feature) showFeature(feature);
        });
        ["ahr-clusters", "ahr-unclustered", "stations"].forEach((layer) => {
          map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });
        map.fitBounds([[106.74, -6.43], [107.15, -6.14]], {
          padding: { top: 36, right: 36, bottom: 36, left: 36 },
          duration: 0,
        });
        setLoading(false);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Data peta gagal dimuat.");
        setLoading(false);
      }
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
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
      const searchText = `${properties.nama_ahr || ""} ${properties.alamat || ""}`.toLowerCase();
      return distanceMatch && typeMatch && serviceMatch && (!normalizedQuery || searchText.includes(normalizedQuery));
    });
    const nextCollection: AhrCollection = { type: "FeatureCollection", features: filtered };
    setAhr(nextCollection);
    const source = mapRef.current?.getSource("ahr") as GeoJSONSource | undefined;
    source?.setData(nextCollection);
  }, [buffer, query, service, type]);

  const visibleResults = useMemo(() => ahr.features.slice(0, 60), [ahr]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><TrainFront size={21} aria-hidden="true" /></div>
          <div><h1>AHR Jakarta</h1><p>Hunian dalam koridor MRT & LRT Jabodebek</p></div>
        </div>
        <div className="top-stats" aria-label="Ringkasan data">
          <div className="top-stat"><strong>{formatNumber.format(ahr.features.length)}</strong><span>AHR terlihat</span></div>
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
            </div>
          </div>

          <div className="result-head"><h2>Kandidat AHR</h2><span>Maks. 60 hasil ditampilkan</span></div>
          <div className="result-list">
            {visibleResults.map((feature, index) => {
              const properties = feature.properties;
              const key = `${properties.url_sumber || "ahr"}-${index}`;
              const active = selected?.properties.url_sumber === properties.url_sumber;
              return (
                <button className={`result-card${active ? " active" : ""}`} key={key} onClick={() => showFeature(feature)}>
                  <span className="result-icon">{propertyGroup(properties.tipe_ahr) === "rumah" ? <House size={16} /> : <Building2 size={16} />}</span>
                  <span className="result-main"><strong>{cleanText(properties.nama_ahr, "Kandidat AHR")}</strong><small>{cleanText(properties.alamat)} · {cleanText(properties.layanan_terdekat)}</small></span>
                  <span className="distance">{Math.round(Number(properties.jarak_ke_jalur_m || 0))} m</span>
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
            <div className="legend-row"><span className="legend-dot" style={{ background: "#ee6c36" }} /> Kandidat AHR</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: "white", border: "2px solid #17211d" }} /> Stasiun</div>
          </div>

          {selected && (
            <article className="detail-card">
              <button className="detail-close" aria-label="Tutup detail" onClick={() => { setSelected(null); popupRef.current?.remove(); }}><X size={15} /></button>
              <span className="detail-kicker">{cleanText(selected.properties.tipe_ahr, "Hunian")}</span>
              <h2>{cleanText(selected.properties.nama_ahr, "Kandidat AHR")}</h2>
              <p className="detail-address"><MapPin size={11} style={{ verticalAlign: "-2px", marginRight: 3 }} />{cleanText(selected.properties.alamat)}</p>
              <div className="detail-grid">
                <div className="detail-item"><span>Jarak</span><strong>{Math.round(Number(selected.properties.jarak_ke_jalur_m || 0))} m</strong></div>
                <div className="detail-item"><span>Layanan</span><strong>{cleanText(selected.properties.layanan_terdekat)}</strong></div>
                <div className="detail-item"><span>Status</span><strong>Perlu verifikasi</strong></div>
              </div>
              <div className="detail-actions">
                <a className="action-link" href={selected.properties.google_maps_url || selected.properties.google_maps_pin_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Google Maps</a>
                <a className="action-link secondary" href={selected.properties.google_directions_url} target="_blank" rel="noreferrer"><Navigation size={14} /> Petunjuk arah</a>
              </div>
              <p className="data-note">Kandidat berbasis OpenStreetMap, bukan bukti bahwa hunian sedang disewakan. Periksa profil Google Maps dan sumber sebelum menghubungi pihak terkait.</p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
