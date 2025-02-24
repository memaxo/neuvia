'use client';

import { ChevronRight, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { ExternalLinkIcon } from '../ui/icons';

interface ExtractedData {
  url: string;
  data: unknown;
}

interface ExtractResultsProps {
  readonly results: ExtractedData | ExtractedData[];
  readonly title?: string;
  readonly isLoading?: boolean;
}

export function ExtractResults({
  results,
  title = 'Extracted Data...',
  isLoading = false,
}: ExtractResultsProps) {
  const resultsArray = Array.isArray(results) ? results : [results];
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({});

  const handleToggle = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenItems((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">
            Using Firecrawl to extract data...
          </span>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={16} />
          <span>Extracting data...</span>
        </div>
      </div>
    );
  }

  if (!resultsArray.length) return null;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return value.toString();
    return JSON.stringify(value, null, 2);
  };

  const renderValue = (value: unknown): JSX.Element => {
    if (Array.isArray(value)) {
      return (
        <div className="grid gap-1.5">
          {value.map((item, i) => (
            <div 
              className="border-border border-l pl-3" 
              key={`item-${i}-${typeof item === 'object' ? JSON.stringify(item).slice(0, 20) : String(item).slice(0, 20)}`}
            >
              {renderValue(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div className="grid gap-1.5">
          {Object.entries(value).map(([k, v]) => (
            <div
              className="grid grid-cols-[180px,1fr] items-start gap-4"
              key={`entry-${k}`}
            >
              <span
                className="text-muted-foreground truncate text-xs font-medium"
                title={k}
              >
                {k}
              </span>
              <div className="min-w-0 text-sm">{renderValue(v)}</div>
            </div>
          ))}
        </div>
      );
    }

    const formatted = formatValue(value);
    if (formatted.includes('\\n') || formatted.length > 100) {
      return (
        <pre className="bg-muted/50 whitespace-pre-wrap break-words rounded-md p-2 text-sm">
          {formatted}
        </pre>
      );
    }

    return (
      <span className="truncate text-sm" title={formatted}>
        {formatted}
      </span>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="grid gap-3">
        {resultsArray.map((result) => (
          <div
            className={cn(
              'bg-muted/40 flex flex-col overflow-hidden rounded-lg',
            )}
            key={`result-${result.url}`}
          >
            <button
              className="hover:bg-muted/60 flex w-full items-center justify-between p-4 transition-colors"
              onClick={(e) => handleToggle(e, resultsArray.indexOf(result))}
            >
              <div className="flex items-center gap-2">
                <div className="bg-background ring-border flex size-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium ring-1">
                  <FileText size={12} />
                </div>
                <span className="flex items-center gap-1 text-sm font-medium hover:underline">
                  {new URL(result.url).hostname}
                  <ExternalLinkIcon
                    className="text-muted-foreground"
                    size={12}
                  />
                </span>
              </div>
              <ChevronRight
                className={cn(
                  'text-muted-foreground transition-transform',
                  openItems[resultsArray.indexOf(result)] && 'rotate-90',
                )}
                size={16}
              />
            </button>
            <div
              className={cn(
                'grid transition-all',
                openItems[resultsArray.indexOf(result)]
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="grid min-w-0 gap-1.5 p-4 pt-0">
                  {renderValue(result.data)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
