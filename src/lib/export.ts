// خروجی گرفتن از گزارش‌ها — CSV با BOM، اکسل (SpreadsheetML راست‌به‌چپ)، چاپ فارسی
// همه عملیات سمت مرورگر انجام می‌شود و به کتابخانه خارجی نیاز ندارد

export interface ExportCol {
  key: string;
  label: string;
  type?: "text" | "money" | "date" | "status" | "number";
}

type Row = Record<string, unknown>;

function triggerDownload(content: BlobPart, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function faDigits(value: number): string {
  return value.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// CSV با BOM تا اکسل فارسی درست باز کند
export function downloadCsv(fileName: string, cols: ExportCol[], rows: Row[]) {
  const header = cols.map((c) => c.label).join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c.key];
          if ((c.type === "money" || c.type === "number") && typeof v === "number") return String(v);
          return csvCell(v);
        })
        .join(",")
    )
    .join("\r\n");
  triggerDownload(
    "\uFEFF" + header + "\r\n" + body,
    fileName.endsWith(".csv") ? fileName : `${fileName}.csv`,
    "text/csv;charset=utf-8"
  );
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sumOf(rows: Row[], key: string): number {
  return rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
}

// اکسل ۲۰۰۳ XML — راست‌به‌چپ، سرستون پررنگ، ردیف جمع برای ستون‌های عددی
export function downloadExcelXml(fileName: string, cols: ExportCol[], rows: Row[], sheetTitle = "گزارش") {
  const headerCells = cols
    .map((c) => `<Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(c.label)}</Data></Cell>`)
    .join("");

  const bodyRows = rows
    .map((r) =>
      `<Row>${cols
        .map((c) => {
          const v = r[c.key];
          if ((c.type === "money" || c.type === "number") && typeof v === "number") {
            return `<Cell ss:StyleID="${c.type === "money" ? "money" : "num"}"><Data ss:Type="Number">${v}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${xmlEscape(v === null || v === undefined ? "" : String(v))}</Data></Cell>`;
        })
        .join("")}</Row>`
    )
    .join("\n");

  const hasNumeric = cols.some((c) => c.type === "money" || c.type === "number");
  const totalRow = hasNumeric
    ? `<Row>${cols
        .map((c, idx) => {
          if (c.type === "money" || c.type === "number") {
            const style = c.type === "money" ? "summoney" : "sumnum";
            return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${sumOf(rows, c.key)}</Data></Cell>`;
          }
          if (idx === 0) return `<Cell ss:StyleID="sum"><Data ss:Type="String">جمع کل</Data></Cell>`;
          return `<Cell/>`;
        })
        .join("")}</Row>`
    : "";

  const colWidths = cols
    .map((c) => `<Column ss:AutoFitWidth="0" ss:Width="${c.type === "text" ? 140 : 110}"/>`)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progID="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Tahoma" ss:Size="10"/></Style>
  <Style ss:ID="head"><Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#059669" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:Horizontal="Center"/></Style>
  <Style ss:ID="money"><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="num"><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="sum"><Font ss:Bold="1"/></Style>
  <Style ss:ID="summoney"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="sumnum"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0"/></Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetTitle.slice(0, 28))}" ss:RightToLeft="1">
  <Table>${colWidths}
   <Row>${headerCells}</Row>
   ${bodyRows}
   ${totalRow}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayRightToLeft/>
   <FreezePanes/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
  triggerDownload(xml, fileName.endsWith(".xls") ? fileName : `${fileName}.xls`, "application/vnd.ms-excel");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// چاپ گزارش — iframe مخفی با استایل راست‌به‌چپ و ردیف جمع
export function printReport(opts: { title: string; subtitle?: string; cols: ExportCol[]; rows: Row[] }) {
  const { title, subtitle, cols, rows } = opts;
  const head = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map((r) =>
      `<tr>${cols
        .map((c) => {
          const v = r[c.key];
          if ((c.type === "money" || c.type === "number") && typeof v === "number") {
            return `<td class="num">${faDigits(v)}</td>`;
          }
          return `<td>${escapeHtml(v === null || v === undefined ? "" : String(v))}</td>`;
        })
        .join("")}</tr>`
    )
    .join("");

  const hasNumeric = cols.some((c) => c.type === "money" || c.type === "number");
  const totalRow = hasNumeric
    ? `<tfoot><tr>${cols
        .map((c, idx) => {
          if (c.type === "money" || c.type === "number") {
            return `<td class="num total">${faDigits(sumOf(rows, c.key))}</td>`;
          }
          if (idx === 0) return `<td class="total">جمع کل</td>`;
          return `<td></td>`;
        })
        .join("")}</tr></tfoot>`
    : "";

  const now = new Date().toLocaleString("fa-IR");
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif; }
  body { padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; }
  thead th { background: #059669; color: #fff; }
  tbody tr:nth-child(even) { background: #f4f4f5; }
  td.num { text-align: left; direction: ltr; }
  tfoot td { font-weight: bold; background: #ecfdf5; }
  .footer { margin-top: 14px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @page { size: A4 landscape; margin: 12mm; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="sub">${escapeHtml(subtitle || "")} — تعداد ردیف: ${rows.length.toLocaleString("fa-IR")}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totalRow}</table>
<div class="footer"><span>مپ‌پی‌ام‌اس — سامانه مدیریت پروژه و اتوماسیون تأسیسات</span><span>چاپ شده در ${now}</span></div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 2000);
    }
  }, 150);
}
