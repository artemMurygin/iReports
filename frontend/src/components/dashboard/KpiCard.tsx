import { Card, CardContent } from "@/components/ui/card"

interface KpiCardProps {
  label: string
  value: string | number
}

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card className="flex-1 p-0 shadow-sm">
      <CardContent className="p-3 flex flex-col justify-between h-[100%]">
        <p className="text-sm font-medium text-gray-500" style={{ fontFamily: "Inter, sans-serif" }}>
          {label}
        </p>
        <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Inter, sans-serif" }}>
          {value}
        </span>
      </CardContent>
    </Card>
  )
}