import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "public/data/ahr_kandidat_osm.geojson";
const outputPath = "public/data/ahr_terkurasi_gratis.geojson";

const source = JSON.parse(await readFile(sourcePath, "utf8"));

const housingName = /(apart(e)?men|apartment|residen(ce|si|tial)|mansion|rumah susun|rusun|perumahan|housing|kompleks|komplek|cluster|condominium|condo|\btower\b|\bkost\b|\bkos\b|indekos|boarding|guest\s*house|hostel|dorm|asrama|\bmess\b|\bwisma\b|\bgriya\b|\bvilla\b|paviliun|\bhome\b)/i;
const clearlyNotHousing = /(starbucks|kedutaan|embassy|cafe|coffee|restaurant|restoran|\bbar\b|school|sekolah|kindergarten|mosque|masjid|church|gereja|\bbank\b|office|kantor|store|toko|shop|clinic|klinik|hospital|rumah sakit|university|universitas|bbq|dapoer|warung|salon|studio|showroom)/i;
const trustedBuildingTypes = new Set(["apartments", "residential"]);

function missing(value) {
  return value == null || ["", "<NA>", "nan", "none", "undefined"].includes(String(value).trim().toLowerCase());
}

function normalizedPhone(value) {
  if (missing(value)) return null;
  const text = String(value).trim();
  return /\d{7,}/.test(text.replace(/\D/g, "")) ? text : null;
}

function confidence(type, name) {
  if (type === "apartments" || /(apart(e)?men|apartment|condominium|condo|rumah susun|rusun)/i.test(name)) return "tinggi";
  return "menengah";
}

const features = source.features
  .filter((feature) => {
    const properties = feature.properties ?? {};
    const name = String(properties.nama_ahr ?? "").trim();
    const type = String(properties.tipe_ahr ?? "").toLowerCase();
    if (!name || name.startsWith("Kandidat AHR OSM") || clearlyNotHousing.test(name)) return false;
    return trustedBuildingTypes.has(type) || housingName.test(name);
  })
  .map((feature) => {
    const properties = feature.properties ?? {};
    const name = String(properties.nama_ahr).trim();
    const address = missing(properties.alamat) ? null : String(properties.alamat).trim();
    const phone = normalizedPhone(properties.kontak_telepon);
    const [longitude, latitude] = feature.geometry.coordinates;
    const searchQuery = [name, address, "Indonesia"].filter(Boolean).join(", ");

    return {
      ...feature,
      properties: {
        ...properties,
        nama_ahr: name,
        alamat: address,
        kontak_telepon: phone,
        tingkat_kepercayaan: confidence(String(properties.tipe_ahr ?? "").toLowerCase(), name),
        status_verifikasi: "kandidat AHR terkurasi dari OSM",
        sumber_kontak: phone ? "OpenStreetMap" : null,
        google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`,
        google_maps_pin_url: `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`,
        google_directions_url: `https://www.google.com/maps/dir/?api=1&destination=${latitude}%2C${longitude}`,
      },
    };
  });

const output = {
  type: "FeatureCollection",
  name: "AHR terkurasi gratis",
  features,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

const summary = {
  kandidat_mentah: source.features.length,
  kandidat_terkurasi: features.length,
  kontak_tersedia: features.filter((feature) => feature.properties.kontak_telepon).length,
  kepercayaan_tinggi: features.filter((feature) => feature.properties.tingkat_kepercayaan === "tinggi").length,
  kepercayaan_menengah: features.filter((feature) => feature.properties.tingkat_kepercayaan === "menengah").length,
};

console.table(summary);
