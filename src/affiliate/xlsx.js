// ─────────────────────────────────────────────────────────────────────────────
// Pembaca .xlsx minimal, tanpa dependensi.
//
// Kenapa ditulis sendiri dan bukan pakai pustaka: export Seller Centre berupa
// satu sheet datar. Pustaka xlsx di npm berhenti di 0.18.5 (punya riwayat
// security advisory) dan exceljs berukuran puluhan MB — terlalu besar untuk
// satu tombol import. Yang kita butuhkan hanya sebagian kecil format itu.
//
// .xlsx = arsip ZIP berisi XML:
//   xl/workbook.xml           daftar sheet
//   xl/sharedStrings.xml      tabel teks (sel teks menyimpan indeks, bukan isi)
//   xl/worksheets/sheet1.xml  selnya sendiri
//
// Inflate memakai DecompressionStream bawaan browser, jadi tidak ada kode
// dekompresi yang perlu dirawat sendiri.
// ─────────────────────────────────────────────────────────────────────────────

const td = new TextDecoder("utf-8");

const u16 = (dv, o) => dv.getUint16(o, true);
const u32 = (dv, o) => dv.getUint32(o, true);

// Cari End of Central Directory (PK\x05\x06) dari belakang. Komentar ZIP
// maksimal 65535 byte, jadi pencarian dibatasi sejauh itu + panjang EOCD.
function findEocd(dv) {
  const max = Math.min(dv.byteLength, 65535 + 22);
  for (let i = 22; i <= max; i++) {
    const o = dv.byteLength - i;
    if (o < 0) break;
    if (u32(dv, o) === 0x06054b50) return o;
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("BROWSER_TANPA_DECOMPRESSION");
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Baca seluruh isi ZIP jadi peta {nama → Uint8Array}.
async function readZip(buf) {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const eocd = findEocd(dv);
  if (eocd === -1) throw new Error("BUKAN_ZIP");

  const count = u16(dv, eocd + 10);
  let ptr = u32(dv, eocd + 16);
  if (ptr === 0xffffffff || count === 0xffff) throw new Error("ZIP64_TIDAK_DIDUKUNG");

  const files = {};
  for (let n = 0; n < count; n++) {
    if (u32(dv, ptr) !== 0x02014b50) throw new Error("CENTRAL_DIR_RUSAK");
    const method = u16(dv, ptr + 10);
    const compSize = u32(dv, ptr + 20);
    const nameLen = u16(dv, ptr + 28);
    const extraLen = u16(dv, ptr + 30);
    const commentLen = u16(dv, ptr + 32);
    const localOff = u32(dv, ptr + 42);
    const name = td.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    // Panjang header lokal berbeda dari yang di central directory, jadi harus
    // dibaca ulang di sana untuk tahu di mana data sebenarnya mulai.
    if (u32(dv, localOff) !== 0x04034b50) throw new Error("HEADER_LOKAL_RUSAK");
    const lNameLen = u16(dv, localOff + 26);
    const lExtraLen = u16(dv, localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);

    if (method === 0) files[name] = raw;               // disimpan apa adanya
    else if (method === 8) files[name] = await inflateRaw(raw); // deflate
    // metode lain (mis. bzip2) tidak dipakai Excel — dilewati diam-diam.

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const parseXml = (bytes) =>
  new DOMParser().parseFromString(td.decode(bytes), "application/xml");

// Referensi sel "BC12" → indeks kolom 0-based.
function colIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

// Excel menyimpan tanggal sebagai angka hari sejak 1899-12-30.
// Hanya dipakai untuk sel yang formatnya memang tanggal.
export function excelSerialToIso(serial) {
  const ms = Math.round(serial * 86400000);
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

// Format bawaan Excel yang berarti tanggal (14–22, 45–47), ditambah format
// kustom yang polanya mengandung y/m/d di luar tanda kutip.
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function buildDateStyleSet(files) {
  const set = new Set();
  const raw = files["xl/styles.xml"];
  if (!raw) return set;
  try {
    const doc = parseXml(raw);
    const customIsDate = new Map();
    for (const nf of doc.getElementsByTagName("numFmt")) {
      const id = Number(nf.getAttribute("numFmtId"));
      const code = (nf.getAttribute("formatCode") || "").replace(/"[^"]*"/g, "");
      customIsDate.set(id, /[ymdYMD]/.test(code));
    }
    const xfs = doc.getElementsByTagName("cellXfs")[0];
    if (!xfs) return set;
    const list = xfs.getElementsByTagName("xf");
    for (let i = 0; i < list.length; i++) {
      const id = Number(list[i].getAttribute("numFmtId") || 0);
      if (BUILTIN_DATE_FMT.has(id) || customIsDate.get(id)) set.add(i);
    }
  } catch { /* styles rusak → anggap tidak ada tanggal bergaya */ }
  return set;
}

function readSharedStrings(files) {
  const raw = files["xl/sharedStrings.xml"];
  if (!raw) return [];
  const doc = parseXml(raw);
  const out = [];
  for (const si of doc.getElementsByTagName("si")) {
    // Teks bisa terpecah beberapa <t> kalau ada format campuran di satu sel.
    let s = "";
    for (const t of si.getElementsByTagName("t")) s += t.textContent;
    out.push(s);
  }
  return out;
}

// Pilih sheet pertama sesuai urutan di workbook.xml, bukan urutan file di ZIP.
function firstSheetPath(files) {
  try {
    const wb = files["xl/workbook.xml"];
    const rels = files["xl/_rels/workbook.xml.rels"];
    if (wb && rels) {
      const id = parseXml(wb).getElementsByTagName("sheet")[0]
        ?.getAttribute("r:id");
      if (id) {
        for (const r of parseXml(rels).getElementsByTagName("Relationship")) {
          if (r.getAttribute("Id") === id) {
            const t = r.getAttribute("Target").replace(/^\/?(xl\/)?/, "");
            return `xl/${t}`;
          }
        }
      }
    }
  } catch { /* jatuh ke tebakan di bawah */ }
  const guess = Object.keys(files).find((k) => /^xl\/worksheets\/.*\.xml$/.test(k));
  return guess || null;
}

// Hasilnya sama bentuknya dengan parseCsv: array baris berisi array sel string,
// sehingga parser di model.js bisa dipakai apa adanya.
export async function readXlsxRows(arrayBuffer) {
  const files = await readZip(arrayBuffer);
  const path = firstSheetPath(files);
  if (!path || !files[path]) throw new Error("SHEET_TIDAK_DITEMUKAN");

  const shared = readSharedStrings(files);
  const dateStyles = buildDateStyleSet(files);
  const doc = parseXml(files[path]);

  const rows = [];
  for (const row of doc.getElementsByTagName("row")) {
    const cells = [];
    for (const c of row.getElementsByTagName("c")) {
      const ref = c.getAttribute("r") || "";
      const idx = ref ? colIndex(ref) : cells.length;
      const type = c.getAttribute("t");

      let val = "";
      if (type === "inlineStr") {
        for (const t of c.getElementsByTagName("t")) val += t.textContent;
      } else {
        const v = c.getElementsByTagName("v")[0];
        const raw = v ? v.textContent : "";
        if (type === "s") {
          val = shared[Number(raw)] ?? "";
        } else if (raw !== "") {
          const styleIdx = Number(c.getAttribute("s") || -1);
          const num = Number(raw);
          val = (dateStyles.has(styleIdx) && Number.isFinite(num) && num > 0)
            ? (excelSerialToIso(num) ?? raw)
            : raw;
        }
      }
      // Isi celah kalau ada kolom yang dilewat (sel kosong tidak ditulis Excel).
      while (cells.length < idx) cells.push("");
      cells[idx] = val;
    }
    rows.push(cells);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// Cek magic bytes, bukan ekstensi nama file — nama bisa salah, isi tidak.
export function looksLikeZip(arrayBuffer) {
  const b = new Uint8Array(arrayBuffer, 0, Math.min(4, arrayBuffer.byteLength));
  return b[0] === 0x50 && b[1] === 0x4b; // "PK"
}
