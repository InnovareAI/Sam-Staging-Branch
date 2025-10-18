import * as React from "react"
import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label?: string
  }
  variant?: "default" | "primary" | "accent" | "success" | "warning" | "danger"
  delay?: number
  className?: string
}

const variantStyles = {
  default: {
    icon: "text-foreground",
    iconBg: "bg-muted",
    value: "text-foreground",
  },
  primary: {
    icon: "text-primary",
    iconBg: "bg-primary/10",
    value: "text-primary",
  },
  accent: {
    icon: "text-accent",
    iconBg: "bg-accent/10",
    value: "text-accent",
  },
  success: {
    icon: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10",
    value: "text-green-600 dark:text-green-400",
  },
  warning: {
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/10",
    value: "text-orange-600 dark:text-orange-400",
  },
  danger: {
    icon: "text-destructive",
    iconBg: "bg-destructive/10",
    value: "text-destructive",
  },
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  delay = 0,
  className,
}: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className={cn("h-full", className)}
    >
      <Card className="h-full border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                {title}
              </p>
              <div className="flex items-baseline gap-3 mb-2">
                <h3 className={cn("text-3xl font-bold tracking-tight", styles.value)}>
                  {value}
                </h3>
                {trend && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      trend.value > 0
                        ? "text-green-600 dark:text-green-400"
                        : trend.value < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    )}
                  >
                    <span>{trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"}</span>
                    <span>{Math.abs(trend.value)}%</span>
                  </div>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
              {trend?.label && (
                <p className="text-xs text-muted-foreground mt-1">{trend.label}</p>
              )}
            </div>
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                styles.iconBg
              )}
            >
              <Icon className={cn("h-6 w-6", styles.icon)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
