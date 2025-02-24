import { motion } from 'framer-motion';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface DeepResearchProps {
  isActive: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  activity?: Array<{
    type:
      | 'search'
      | 'extract'
      | 'analyze'
      | 'reasoning'
      | 'synthesis'
      | 'thought';
    status: 'pending' | 'complete' | 'error';
    message: string;
    timestamp: string;
  }>;
  sources?: Array<{
    url: string;
    title: string;
    relevance: number;
  }>;
  deepResearch?: boolean;
}

export function DeepResearch({
  isLoading,
  activity = [],
  sources = [],
  deepResearch = true
}: DeepResearchProps) {
  if (activity.length === 0 && sources.length === 0) {
    return null;
  }

  return (
    <div className="bg-background fixed right-4 top-20 flex max-h-[80vh] w-80 flex-col overflow-y-scroll rounded-lg border p-4 shadow-lg">
      <Tabs className="flex h-full flex-col" defaultValue={deepResearch ? "activity" : "sources"}>
        <TabsList className="w-full">
          {deepResearch && <TabsTrigger className="flex-1" value="activity">
            Activity
          </TabsTrigger>}
          <TabsTrigger className="flex-1" value="sources">
            Sources
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-2 flex-1 overflow-y-auto" value="activity">
          <div className="h-full space-y-4 pr-2">
            {[...activity].reverse().map((item, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                key={index}
              >
                <div
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    item.status === 'pending' && 'bg-yellow-500',
                    item.status === 'complete' && 'bg-green-500',
                    item.status === 'error' && 'bg-red-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground whitespace-pre-wrap break-words text-sm">
                    {item.message}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent className="mt-2 flex-1 overflow-y-auto" value="sources">
          <div className="space-y-4 pr-2">
            {sources.map((source, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-1"
                initial={{ opacity: 0, y: 10 }}
                key={index}
              >
                <a
                  className="break-words text-sm font-medium hover:underline"
                  href={source.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {source.title}
                </a>
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground truncate text-xs">
                    {new URL(source.url).hostname}
                  </div>
                  {/* <div className="text-xs text-muted-foreground">
                    Relevance: {Math.round(source.relevance * 100)}%
                  </div> */}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
