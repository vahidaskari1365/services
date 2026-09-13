"use client";

// آرشیو اسناد — بارگذاری، دسته‌بندی، جستجو، پیش‌نمایش، دانلود و حذف اسناد
import { useCallback, useEffect, useRef, useState } from "react";
import { api, authHeaders, useApp } from "../store";
import { LoadingCards, SectionTitle } from "../shared";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Archive, Download, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, File, Pencil, Trash2, Upload } from "lucide-react";
import { formatJalali } from "@/lib/jalali";
import { faNumber } from "@/lib/format";

export const DOC_CATEGORIES: Record<string, string> = {
  CONTRACT: "قرارداد",
  INVOICE: "فاکتور",
  RECEIPT: "رسید پرداخت",
  REPORT: "گزارش",
  PLAN: "نقشه و طرح",
  PHOTO: "عکس کارگاه",
  OTHER: "سایر",
};

interface DocRow {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: string;
  notes: string;
  createdAt: string;
  project: { id: string; name: string } | null;
  contract: { id: string; title: string } | null;
  uploader: { fullName: string } | null;
}
interface ProjectLite { id: string; name: string }

function faSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${faNumber(bytes / (1024 * 1024), 1)} مگابایت`;
  if (bytes >= 1024) return `${faNumber(bytes / 1024, 0)} کیلوبایت`;
  return `${faNumber(bytes)} بایت`;
}

function docIcon(mime: string) {
  if (mime.startsWith("image/")) return <FileImage className="w-4 h-4 text-sky-600" />;
  if (mime === "application/pdf") return <FileText className="w-4 h-4 text-rose-600" />;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
  if (mime.includes("zip") || mime.includes("rar")) return <FileArchive className="w-4 h-4 text-amber-600" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

async function fetchBlobUrl(id: string): Promise<string> {
  const res = await fetch(`/api/documents/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("دریافت فایل ناموفق بود");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export default function DocumentsView() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [category, setCategory] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocRow | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocRow | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string; mime: string } | null>(null);
  const canManage = useApp((s) => !!s.user && s.user.permissions.includes("documents.manage"));

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (projectId !== "all") params.set("projectId", projectId);
      if (q.trim()) params.set("q", q.trim());
      const data = await api<{ documents: DocRow[] }>(`/api/documents?${params.toString()}`);
      setDocs(data.documents);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
      setDocs([]);
    }
  }, [category, projectId, q, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ projects: { id: string; name: string }[] }>("/api/projects")
      .then((d) => setProjects(d.projects || []))
      .catch(() => setProjects([]));
  }, []);

  async function openPreview(d: DocRow) {
    try {
      const url = await fetchBlobUrl(d.id);
      setPreview({ title: d.title, url, mime: d.mimeType });
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function download(d: DocRow) {
    try {
      const url = await fetchBlobUrl(d.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.title + (d.fileName.includes(".") ? d.fileName.slice(d.fileName.lastIndexOf(".")) : "");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function remove() {
    if (!deleteDoc) return;
    try {
      await api(`/api/documents/${deleteDoc.id}`, { method: "DELETE" });
      toast({ title: "سند حذف شد" });
      setDeleteDoc(null);
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="آرشیو اسناد"
        desc="نگهداری قراردادها، فاکتورها، رسیدها و مستندات کارگاه با دسته‌بندی و اتصال به پروژه"
        action={canManage && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" /> بارگذاری سند
          </Button>
        )}
      />

      {/* فیلترها */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در عنوان و نام فایل…" className="max-w-56 h-9 text-xs" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه پروژه‌ها</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!docs ? (
        <LoadingCards count={4} />
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Archive className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">سندی در آرشیو نیست</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {canManage ? "با دکمه «بارگذاری سند» اولین فایل را آرشیو کنید" : "هنوز سندی بارگذاری نشده است"}
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-card p-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">{docIcon(d.mimeType)}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5" dir="ltr">{d.fileName}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                  {DOC_CATEGORIES[d.category] || d.category}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <p>حجم: {faSize(d.size)} · {formatJalali(d.createdAt)}</p>
                {(d.project || d.contract) && (
                  <p className="truncate">
                    {d.project ? `پروژه: ${d.project.name}` : ""}{d.project && d.contract ? " · " : ""}{d.contract ? `قرارداد: ${d.contract.title}` : ""}
                  </p>
                )}
                {d.uploader && <p>بارگذاری: {d.uploader.fullName}</p>}
              </div>
              <div className="flex items-center gap-1 mt-auto pt-1 border-t">
                <Button variant="ghost" size="sm" className="h-7 text-[11px] flex-1" onClick={() => openPreview(d)}>
                  <Eye className="w-3.5 h-3.5" /> نمایش
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] flex-1" onClick={() => download(d)}>
                  <Download className="w-3.5 h-3.5" /> دانلود
                </Button>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditDoc(d)} aria-label="ویرایش">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700" onClick={() => setDeleteDoc(d)} aria-label="حذف">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} projects={projects} onUploaded={() => { setUploadOpen(false); load(); toast({ title: "سند بارگذاری شد" }); }} />
      <EditDialog doc={editDoc} onClose={() => setEditDoc(null)} onSaved={() => { setEditDoc(null); load(); toast({ title: "اطلاعات سند به‌روزرسانی شد" }); }} />
      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سند</AlertDialogTitle>
            <AlertDialogDescription>«{deleteDoc?.title}» برای همیشه از آرشیو حذف می‌شود. این عمل قابل بازگشت نیست.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={(e) => { e.preventDefault(); remove(); }}>حذف کن</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o && preview) { URL.revokeObjectURL(preview.url); setPreview(null); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl">
          <DialogHeader><DialogTitle className="text-sm">{preview?.title}</DialogTitle></DialogHeader>
          {preview && (
            <div className="max-h-[65vh] overflow-auto rounded-xl border bg-muted/30">
              {preview.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.title} className="w-full object-contain max-h-[60vh]" />
              ) : preview.mime === "application/pdf" ? (
                <iframe src={preview.url} title={preview.title} className="w-full h-[60vh]" />
              ) : (
                <p className="p-6 text-xs text-muted-foreground text-center">پیش‌نمایش این نوع فایل ممکن نیست — از دکمه دانلود استفاده کنید</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadDialog({ open, onOpenChange, projects, onUploaded }: { open: boolean; onOpenChange: (v: boolean) => void; projects: ProjectLite[]; onUploaded: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CONTRACT");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [busy, setBusy] = useState(false);

  function pick(f: File | null) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "خطا", description: "حجم فایل باید کمتر از ۵ مگابایت باشد", variant: "destructive" });
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title || file.name);
      form.set("category", category);
      form.set("notes", notes);
      if (projectId !== "none") form.set("projectId", projectId);
      const res = await fetch("/api/documents", { method: "POST", headers: authHeaders(), body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در بارگذاری");
      setFile(null);
      setTitle("");
      setNotes("");
      setCategory("CONTRACT");
      setProjectId("none");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader><DialogTitle>بارگذاری سند جدید</DialogTitle></DialogHeader>
        <div className="space-y-3.5 py-1">
          <label className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-5 cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="w-6 h-6 text-emerald-600" />
            <p className="text-xs font-medium">{file ? file.name : "انتخاب فایل (حداکثر ۵ مگابایت)"}</p>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
          </label>
          <div className="space-y-1.5">
            <Label>عنوان سند</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: قرارداد برج آرمان — نسخه امضاشده" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label>دسته</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>پروژه مرتبط</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون پروژه</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>یادداشت (اختیاری)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="توضیح کوتاه درباره سند" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button disabled={!file || busy} onClick={submit}>{busy ? "در حال بارگذاری…" : "بارگذاری"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ doc, onClose, onSaved }: { doc: DocRow | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setCategory(doc.category);
      setNotes(doc.notes);
    }
  }, [doc]);

  async function submit() {
    if (!doc) return;
    setBusy(true);
    try {
      await api(`/api/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ title, category, notes }) });
      onSaved();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader><DialogTitle>ویرایش سند</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>عنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>دسته</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>یادداشت</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button disabled={busy || title.trim().length < 2} onClick={submit}>{busy ? "در حال ثبت…" : "ذخیره"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
