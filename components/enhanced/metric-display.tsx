import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface MetricDisplayProps {
  label: string
  value: string | number
  icon: LucideIcon
  status?: "healthy" | "warning" | "error"
  progress?: number
  className?: string
}

const statusStyles = {
  healthy: {
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    bg: "bg-surface-muted",
  },
  warning: {
    dot: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-surface-muted",
  },
  error: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-surface-muted",
  },
}

export function MetricDisplay({
  label,
  value,
  icon: Icon,
  status = "healthy",
  progress,
  className,
}: MetricDisplayProps) {
  const styles = statusStyles[status]

  return (
    <div className={cn("rounded-lg border border-border/50 p-4", styles.bg, className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", styles.text)} />
          <span className="font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full animate-pulse", styles.dot)} />
          <span className={cn("text-sm capitalize", styles.text)}>{status}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {typeof progress === "number" ? "Usage" : "Response"}
          </span>
          <span className="font-medium text-foreground">{value}</span>
        </div>
        {typeof progress === "number" && (
          <Progress 
            value={progress} 
            className={cn(
              "h-2",
              progress > 90 ? "[&>div]:bg-red-500" : 
              progress > 75 ? "[&>div]:bg-yellow-500" : 
              "[&>div]:bg-green-500"
            )} 
          />
        )}
      </div>
    </div>
  )
}
