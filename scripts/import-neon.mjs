import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum tersedia.");
}

const sql = neon(process.env.DATABASE_URL);
const layers = {
  ahr: "public/data/ahr_kandidat_osm.geojson",
  network: "public/data/network_mrt_lrt.geojson",
  buffers: "public/data/buffers_500_700_1000m.geojson",
  stations: "public/data/stations.geojson",
};

await sql`
  CREATE TABLE IF NOT EXISTS webgis_layers (
    name text PRIMARY KEY,
    feature_count integer NOT NULL,
    geojson jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

for (const [name, path] of Object.entries(layers)) {
  const raw = JSON.parse(await readFile(path, "utf8"));
  const normalized = {
    type: "FeatureCollection",
    features: raw.features ?? [],
  };
  const payload = JSON.stringify(normalized);
  await sql`
    INSERT INTO webgis_layers (name, feature_count, geojson, updated_at)
    VALUES (${name}, ${normalized.features.length}, ${payload}::jsonb, now())
    ON CONFLICT (name) DO UPDATE SET
      feature_count = EXCLUDED.feature_count,
      geojson = EXCLUDED.geojson,
      updated_at = now()
  `;
  console.log(`${name}: ${normalized.features.length} fitur`);
}

const summary = await sql`SELECT name, feature_count FROM webgis_layers ORDER BY name`;
console.table(summary);
