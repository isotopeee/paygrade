import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrHas,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type Cell,
  type CellData,
  type Column,
  type ColumnHelper,
  type Header,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table"

export interface DataTableColumnMeta {
  /** Human label used by column visibility and filters. */
  label?: string
  align?: "left" | "right" | "center"
  /** Numeric columns get tabular figures and right alignment. */
  numeric?: boolean
  headerClassName?: string
  cellClassName?: string
}

/**
 * Feature set shared by every table in the app. Registered once so column
 * definitions and the DataTable component agree on the available APIs.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    arrHas: filterFn_arrHas,
    equals: filterFn_equals,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    text: sortFn_text,
    datetime: sortFn_datetime,
  },
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

export type AppFeatures = typeof dataTableFeatures

export function createColumns<TData extends RowData>(): ColumnHelper<AppFeatures, TData> {
  return createColumnHelper<AppFeatures, TData>()
}

export type AppColumn<TData extends RowData, TValue extends CellData = CellData> = Column<AppFeatures, TData, TValue>
export type AppRow<TData extends RowData> = Row<AppFeatures, TData>
export type AppTable<TData extends RowData> = Table<AppFeatures, TData>
export type AppHeader<TData extends RowData> = Header<AppFeatures, TData>
export type AppCell<TData extends RowData> = Cell<AppFeatures, TData>

/** Column definitions produced by `createColumns<T>().columns([...])`. */
export type DataTableColumns<TData extends RowData> = ReturnType<ColumnHelper<AppFeatures, TData>["columns"]>
