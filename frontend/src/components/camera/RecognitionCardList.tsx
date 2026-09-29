import React from "react";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface RecognizedPersonItem {
  azure_person_id: string;
  name: string;
  confidence: number;
  already_marked?: boolean;
  time: string;
}

interface RecognitionCardListProps {
  items: RecognizedPersonItem[];
  emptyMessage?: string;
}

export const RecognitionCardList: React.FC<RecognitionCardListProps> = ({
  items,
  emptyMessage = "No recognized faces yet in this session.",
}) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
        <p className="text-xs sm:text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
      {items.map((person, idx) => (
        <div
          key={`${person.azure_person_id}-${idx}`}
          className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-colors duration-150"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                person.already_marked
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {person.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold truncate text-foreground">{person.name}</h4>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {person.time}
                </span>
                <span>•</span>
                <span>{(person.confidence * 100).toFixed(1)}% match</span>
              </div>
            </div>
          </div>
          <Badge
            variant={person.already_marked ? "secondary" : "default"}
            className={`text-[10px] shrink-0 font-medium ${
              person.already_marked
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            }`}
          >
            {person.already_marked ? (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Already Marked
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Recorded
              </span>
            )}
          </Badge>
        </div>
      ))}
    </div>
  );
};

export default RecognitionCardList;
