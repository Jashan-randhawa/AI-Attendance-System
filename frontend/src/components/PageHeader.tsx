import React from "react";

interface PageHeaderProps {
  badge?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  title,
  description,
  actions,
  className = "",
}) => {
  return (
    <div className={`pb-4 mb-5 sm:pb-6 sm:mb-8 border-b border-border/80 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          {badge && (
            <span className="inline-block text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase font-sans mb-0.5">
              {badge}
            </span>
          )}
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground font-sans max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
