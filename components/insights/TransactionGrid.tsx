"use client";

/**
 * AG Grid (Community) view of RePal's signed-receipt activity. Mirrors the
 * PayPal × AG Grid hackathon boilerplate pattern: flat transaction rows →
 * sortable, filterable, searchable grid with money/date formatting and a
 * verifiable-receipt link per row.
 *
 * Loaded via next/dynamic({ssr:false}) from the insights page to avoid grid
 * measurement on the server. Theme follows RePal's light/dark toggle.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  colorSchemeDark,
  colorSchemeLight,
  type ColDef,
  type GridReadyEvent,
} from "ag-grid-community";
import type { InsightsData } from "@/lib/client";

// Register the Community feature set once (tree-shakeable module registration).
ModuleRegistry.registerModules([AllCommunityModule]);

const lightTheme = themeQuartz.withPart(colorSchemeLight);
const darkTheme = themeQuartz.withPart(colorSchemeDark);

type Row = InsightsData["recent"][number];

const usd = (n: number | undefined) =>
  n == null ? "" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Track RePal's current theme (set as data-theme on <html> by the toggle). */
function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const t = document.documentElement.getAttribute("data-theme");
      setDark(t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default function TransactionGrid({ rows }: { rows: Row[] }) {
  const isDark = useIsDark();
  const gridRef = useRef<AgGridReact<Row>>(null);
  const [quickFilter, setQuickFilter] = useState("");

  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { field: "item", headerName: "Item", flex: 2, minWidth: 160, filter: "agTextColumnFilter" },
      { field: "merchant", headerName: "Merchant", flex: 1, minWidth: 120, filter: "agTextColumnFilter" },
      { field: "category", headerName: "Category", width: 130, filter: "agTextColumnFilter" },
      {
        field: "cashUsd",
        headerName: "Cash",
        width: 110,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => usd(p.value),
      },
      {
        field: "savedUsd",
        headerName: "Saved",
        width: 110,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => usd(p.value),
        cellStyle: { color: "var(--color-brand)" },
      },
      {
        field: "createdAt",
        headerName: "Date",
        width: 130,
        filter: "agDateColumnFilter",
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : ""),
      },
      {
        field: "verifyUrl",
        headerName: "Receipt",
        width: 110,
        sortable: false,
        filter: false,
        cellRenderer: (p: { value?: string }) =>
          p.value
            ? `<a href="${p.value}" style="color:var(--color-brand);text-decoration:underline">Verify</a>`
            : "",
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: false }),
    [],
  );

  const onGridReady = (e: GridReadyEvent) => e.api.sizeColumnsToFit();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={quickFilter}
          onChange={(e) => setQuickFilter(e.target.value)}
          placeholder="Search activity…"
          aria-label="Search activity"
          className="w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <span className="ml-auto text-xs text-[var(--color-muted)]">{rows.length} rows · AG Grid</span>
      </div>
      <div style={{ height: 420, width: "100%" }}>
        <AgGridReact<Row>
          ref={gridRef}
          theme={isDark ? darkTheme : lightTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50]}
          onGridReady={onGridReady}
        />
      </div>
    </div>
  );
}
