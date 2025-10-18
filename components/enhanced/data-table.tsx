import * as React from "react"
import { motion } from "framer-motion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataTableProps {
  title?: string
  description?: string
  columns: {
    key: string
    label: string
    className?: string
  }[]
  data: any[]
  searchable?: boolean
  searchPlaceholder?: string
  onSearch?: (term: string) => void
  actions?: (row: any) => React.ReactNode
  emptyMessage?: string
  maxHeight?: string
  className?: string
}

export function DataTable({
  title,
  description,
  columns,
  data,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearch,
  actions,
  emptyMessage = "No data available",
  maxHeight = "500px",
  className,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("")

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    onSearch?.(value)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn("space-y-4", className)}
    >
      {(title || description || searchable) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {searchable && (
            <div className="flex items-center gap-2">
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-64"
              />
              <Button variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border/50 bg-card">
        <ScrollArea style={{ maxHeight }}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn("font-semibold text-foreground", column.className)}
                  >
                    {column.label}
                  </TableHead>
                ))}
                {actions && (
                  <TableHead className="text-right font-semibold text-foreground">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow
                    key={index}
                    className="border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn("text-foreground", column.className)}
                      >
                        {row[column.key]}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell className="text-right">
                        {actions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </motion.div>
  )
}
