import { readFile, writeFile } from "node:fs/promises";

const filePath = "public/data/ahr_terkurasi_gratis.geojson";
const data = JSON.parse(await readFile(filePath, "utf8"));

const ids = { node: [], way: [], relation: [] };
for (const feature of data.features) {
  const type = String(feature.properties?.osm_type ?? "").toLowerCase();
  const id = Number(feature.properties?.osm_id);
  if (ids[type] && Number.isFinite(id)) ids[type].push(id);
}

const selectors = Object.entries(ids)
  .filter(([, values]) => values.length)
  .map(([type, values]) => `${type === "relation" ? "rel" : type}(id:${values.join(",")});`)
  .join("\n");

const query = `[out:json][timeout:120];\n(\n${selectors}\n);\nout tags;`;
const endpoints = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

let payload;
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "AHR-Jakarta-Research/1.0 (https://github.com/zakiulfahmijailani/AHR_Jakarta)",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
    }
    payload = await response.json();
    console.log(`Kontak OSM diperiksa melalui ${endpoint}`);
    break;
  } catch (error) {
    console.warn(`Endpoint gagal: ${endpoint} (${error.message})`);
  }
}

if (!payload) throw new Error("Semua endpoint Overpass gagal.");

const tagsByElement = new Map(
  payload.elements.map((element) => [`${element.type}/${element.id}`, element.tags ?? {}]),
);

function first(tags, names) {
  for (const name of names) {
    const value = tags[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return null;
}

let phonesAdded = 0;
let websitesAdded = 0;
for (const feature of data.features) {
  const properties = feature.properties;
  const tags = tagsByElement.get(`${properties.osm_type}/${properties.osm_id}`) ?? {};
  const phone = first(tags, ["contact:phone", "phone", "contact:whatsapp", "mobile"]);
  const website = first(tags, ["contact:website", "website", "url"]);

  if (phone && !properties.kontak_telepon) {
    properties.kontak_telepon = phone;
    properties.sumber_kontak = "OpenStreetMap";
    phonesAdded += 1;
  }
  if (website) {
    properties.url_resmi = website;
    websitesAdded += 1;
  }
}

await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.table({ objek_diperiksa: data.features.length, telepon_ditambahkan: phonesAdded, situs_resmi_tersedia: websitesAdded });
