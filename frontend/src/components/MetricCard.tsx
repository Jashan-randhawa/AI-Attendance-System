import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

const MetricCard = ({ title, value, icon: Icon, trend, trendUp }: MetricCardProps) => {
  return (
    <Card className="border border-border/70 shadow-xs card-hover-lift overflow-hidden bg-card/95 backdrop-blur-md relative group">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {trend && (
              <p className={`text-xs font-medium flex items-center gap-1 mt-1.5 ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
                <span>{trendUp ? "↑" : "↓"}</span> {trend}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-xs">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
