"use client"

export type FilterSelect = {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
}

type Props = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters: FilterSelect[]
  onFilterChange: (id: string, value: string) => void
  onClear: () => void
  filteredCount: number
  totalCount: number
  hasActiveFilters: boolean
}

export function AdminRegistryFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search name, package, or description…",
  filters,
  onFilterChange,
  onClear,
  filteredCount,
  totalCount,
  hasActiveFilters,
}: Props) {
  return (
    <div className="admin-registry-filters">
      <div className="admin-registry-filters-row">
        <div className="form-group admin-registry-search">
          <label htmlFor="admin-registry-search">Search details</label>
          <input
            id="admin-registry-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        {filters.map((filter) => (
          <div key={filter.id} className="form-group admin-registry-filter">
            <label htmlFor={`admin-filter-${filter.id}`}>{filter.label}</label>
            <select
              id={`admin-filter-${filter.id}`}
              value={filter.value}
              onChange={(e) => onFilterChange(filter.id, e.target.value)}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {hasActiveFilters && (
          <button type="button" className="btn btn-secondary admin-registry-clear" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
      <p className="admin-registry-filter-count">
        Showing {filteredCount} of {totalCount}
      </p>
    </div>
  )
}

export function matchesSearch(query: string, parts: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return parts.some((part) => part?.toLowerCase().includes(q))
}
