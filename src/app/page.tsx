"use client";

import { useEffect } from "react";
import { useApp } from "@/components/app/store";
import LoginView from "@/components/app/login";
import AppShell from "@/components/app/shell";
import DashboardView from "@/components/app/views/dashboard";
import ActionCenterView from "@/components/app/views/action-center";
import ProjectsView from "@/components/app/views/projects";
import PeopleView from "@/components/app/views/people";
import MyTasksView from "@/components/app/views/mytasks";
import FinanceView from "@/components/app/views/finance";
import SecretaryView from "@/components/app/views/secretary";
import CommissionsView from "@/components/app/views/commissions";
import ReportsView from "@/components/app/views/reports";
import ReportBuilderView from "@/components/app/views/report-builder";
import DocumentsView from "@/components/app/views/documents";
import UsersView from "@/components/app/views/users";
import SettingsView from "@/components/app/views/settings";
import { Skeleton } from "@/components/ui/skeleton";
import PaymentModal from "@/components/app/views/payment-modal";

export default function Home() {
  const { user, authLoading, view, loadUser, payToken, setPayToken } = useApp();

  useEffect(() => {
    loadUser();
    // تشخیص لینک پرداخت در آدرس (?pay=token)
    const params = new URLSearchParams(window.location.search);
    const token = params.get("pay");
    if (token) setPayToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950/95">
        <div className="flex flex-col items-center gap-3 text-emerald-100">
          <Skeleton className="w-12 h-12 rounded-2xl bg-emerald-800" />
          <p className="text-sm">در حال بارگذاری سامانه…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginView />;

  return (
    <>
      <AppShell>
        {view === "dashboard" && <DashboardView />}
        {view === "action" && <ActionCenterView />}
        {view === "projects" && <ProjectsView />}
        {view === "people" && <PeopleView />}
        {view === "mytasks" && <MyTasksView />}
        {view === "finance" && <FinanceView />}
        {view === "secretary" && <SecretaryView />}
        {view === "commissions" && <CommissionsView />}
        {view === "reports" && <ReportsView />}
        {view === "builder" && <ReportBuilderView />}
        {view === "documents" && <DocumentsView />}
        {view === "users" && <UsersView />}
        {view === "settings" && <SettingsView />}
      </AppShell>
      {payToken && <PaymentModal token={payToken} onClose={() => setPayToken(null)} />}
    </>
  );
}
