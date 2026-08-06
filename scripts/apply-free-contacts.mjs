import { readFile, writeFile } from "node:fs/promises";

const ahrPath = "public/data/ahr_terkurasi_gratis.geojson";
const contactsPath = "public/data/ahr_contacts_free.json";

const ahr = JSON.parse(await readFile(ahrPath, "utf8"));
const contacts = JSON.parse(await readFile(contactsPath, "utf8"));
const byName = new Map(contacts.map((contact) => [contact.nama_ahr.toLowerCase(), contact]));

let applied = 0;
for (const feature of ahr.features) {
  const contact = byName.get(String(feature.properties.nama_ahr).toLowerCase());
  if (!contact) continue;
  Object.assign(feature.properties, contact, {
    status_verifikasi: "nama AHR dan kontak terverifikasi dari sumber publik",
  });
  applied += 1;
}

await writeFile(ahrPath, `${JSON.stringify(ahr, null, 2)}\n`, "utf8");
console.table({ kontak_diterapkan: applied, total_ahr: ahr.features.length });
