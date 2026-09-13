"use client";

// دکمه‌های خروجی گزارش — اکسل، CSV و چاپ
import { Button } from "@/components/ui/button";
import { downloadCsv, downloadExcelXml, printReport, type ExportCol } from "@/lib/export";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";

type Row = Record<string, unknown>;

export default function ExportButtons({
  title,
  cols,
  rows,
  fileName,
  subtitle,
  disabled,
}: {
  title: string;
  cols: ExportCol[];
  rows: Row[];
  fileName: string;
  subtitle?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Button variant="outline" size="sm" disabled={disabled || rows.length === 0} onClick={() => downloadExcelXml(fileName, cols, rows, title)}>
        <FileSpreadsheet className="w-4 h-4" /> اکسل
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || rows.length === 0} onClick={() => downloadCsv(fileName, cols, rows)}>
        <FileText className="w-4 h-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || rows.length === 0} onClick={() => printReport({ title, subtitle, cols, rows })}>
        <Printer className="w-4 h-4" /> چاپ
      </Button>
    </div>
  );
}
