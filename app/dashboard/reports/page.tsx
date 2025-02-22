'use client'

import { useState, useEffect } from "react";

import type { Report } from "@/lib/reports.types";
import { createClient } from "@/utils/supabase/client";

import { ReportsFilters } from "./components/reports-filters";
import { ReportsList } from "./components/reports-list";
import { ReportsOverview } from "./components/reports-overview";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchReports() {
      try {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Cast the reports to the correct type
        setReports(data as unknown as Report[]);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [supabase]);

  // Calculate overview stats
  const stats = {
    total: reports.length,
    completed: reports.filter((r) => r.status === "completed").length,
    processing: reports.filter((r) => r.status === "processing").length,
    failed: reports.filter((r) => r.status === "failed").length,
  };

  const handleFilterChange = async (filters: {
    type?: Report["type"];
    timeframe?: string;
    status?: Report["status"];
  }) => {
    try {
      setLoading(true);
      let query = supabase.from("reports").select("*");

      if (filters.type) {
        query = query.eq("type", filters.type);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.timeframe) {
        const now = new Date();
        let startDate: Date;
        switch (filters.timeframe) {
          case "7d":
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case "30d":
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case "quarter":
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
          default:
            startDate = new Date(0);
        }
        query = query.gte("created_at", startDate.toISOString());
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setReports(data as unknown as Report[]);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Error loading reports: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ReportsOverview
        stats={[
          {
            name: "Total Reports",
            value: stats.total,
            change: "+5%",
            changeType: "increase",
          },
          {
            name: "Completed",
            value: stats.completed,
            change: "+12%",
            changeType: "increase",
          },
          {
            name: "Processing",
            value: stats.processing,
            change: "0",
            changeType: "neutral",
          },
          {
            name: "Failed",
            value: stats.failed,
            change: "-2%",
            changeType: "decrease",
          },
        ]}
      />

      <div className="space-y-4">
        <ReportsFilters onFilterChange={handleFilterChange} />
        {loading ? (
          <div className="text-center text-white/70">Loading reports...</div>
        ) : (
          <ReportsList reports={reports} />
        )}
      </div>
    </div>
  );
} 