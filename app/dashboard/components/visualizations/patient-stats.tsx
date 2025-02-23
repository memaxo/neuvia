import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface PatientStatsProps {
  data: {
    label: string
    value: number
    trend: number
    color: string
  }[]
}

export function PatientStats({ data }: PatientStatsProps) {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Patient Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {data.map((stat, index) => (
            <div key={stat.label} className="flex flex-col gap-2">
              {index > 0 && <Separator className="-mt-4" />}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))]">
                  {stat.label}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[rgb(var(--foreground))]">
                    {stat.value}
                  </span>
                  <span
                    className={
                      stat.trend > 0
                        ? 'text-sm text-[rgb(var(--success))]'
                        : 'text-sm text-[rgb(var(--error))]'
                    }
                  >
                    {stat.trend > 0 ? '+' : ''}
                    {stat.trend}%
                  </span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--background)/var(--opacity-20))]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stat.value}%`,
                    backgroundColor: `rgb(var(${stat.color}))`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 