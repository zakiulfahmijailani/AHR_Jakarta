import { neon } from "@neondatabase/serverless";

const allowedLayers = new Set(["ahr", "network", "buffers", "stations"]);

export default async function handler(request: any, response: any) {
  const name = String(request.query?.name || "");
  if (!allowedLayers.has(name)) {
    return response.status(400).json({ error: "Layer tidak valid." });
  }
  if (!process.env.DATABASE_URL) {
    return response.status(500).json({ error: "Database belum dikonfigurasi." });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT geojson FROM webgis_layers WHERE name = ${name} LIMIT 1`;
    if (!rows.length) return response.status(404).json({ error: "Layer tidak ditemukan." });

    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    response.setHeader("Content-Type", "application/geo+json; charset=utf-8");
    return response.status(200).json(rows[0].geojson);
  } catch (error) {
    console.error("Neon layer error", error);
    return response.status(500).json({ error: "Layer gagal dimuat dari database." });
  }
}
