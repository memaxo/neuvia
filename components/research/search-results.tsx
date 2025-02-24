'use client';

import type { Transition, Variants } from 'framer-motion';
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { ExternalLinkIcon } from '@/components/ui/icons';
import type { SearchResult } from '@/lib/types/firecrawl';
import { cn } from '@/lib/utils';


interface SearchResultsProps {
  results: SearchResult[];
  title?: string;
  isLoading?: boolean;
}

interface EarthIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const circleTransition: Transition = {
  duration: 0.3,
  delay: 0.1,
  opacity: { delay: 0.15 },
};

const circleVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
  },
};

const EarthIcon = forwardRef<EarthIconHandle, HTMLAttributes<HTMLDivElement>>(
  ({ onMouseEnter, onMouseLeave, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('animate');
        } else {
          onMouseEnter?.(e);
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('normal');
        } else {
          onMouseLeave?.(e);
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className="hover:bg-accent flex cursor-pointer select-none items-center justify-center rounded-md transition-colors duration-200"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            animate={controls}
            d="M21.54 15H17a2 2 0 0 0-2 2v4.54"
            transition={{ duration: 0.5, delay: 0.25, opacity: { delay: 0.25 } }}
            variants={{
              normal: {
                pathLength: 1,
                opacity: 1,
                pathOffset: 0,
              },
              animate: {
                pathLength: [0, 1],
                opacity: [0, 1],
                pathOffset: [1, 0],
              },
            }}
          />
          <motion.path
            animate={controls}
            d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"
            transition={{ duration: 0.5, delay: 0.25, opacity: { delay: 0.25 } }}
            variants={{
              normal: {
                pathLength: 1,
                opacity: 1,
                pathOffset: 0,
              },
              animate: {
                pathLength: [0, 1],
                opacity: [0, 1],
                pathOffset: [1, 0],
              },
            }}
          />
          <motion.path
            animate={controls}
            d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"
            transition={{ duration: 0.5, delay: 0.25, opacity: { delay: 0.25 } }}
            variants={{
              normal: {
                pathLength: 1,
                opacity: 1,
                pathOffset: 0,
              },
              animate: {
                pathLength: [0, 1],
                opacity: [0, 1],
                pathOffset: [1, 0],
              },
            }}
          />
          <motion.circle
            animate={controls}
            cx="12"
            cy="12"
            r="10"
            transition={circleTransition}
            variants={circleVariants}
          />
        </svg>
      </div>
    );
  }
);

EarthIcon.displayName = 'EarthIcon';

export function SearchResults({
  results,
  title = 'Search Results...',
  isLoading = false,
}: SearchResultsProps) {
  const earthIconRef = useRef<EarthIconHandle>(null);

  useEffect(() => {
    if (isLoading && earthIconRef.current) {
      earthIconRef.current.startAnimation();
    } else if (!isLoading && earthIconRef.current) {
      earthIconRef.current.stopAnimation();
    }
  }, [isLoading]);

  if (!results.length && !isLoading) return null;

  return (
    <div className="w-full">
      <div className="grid gap-2">
        {isLoading ? (
          <div className="flex w-fit items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600">
            <EarthIcon ref={earthIconRef} />
            <span>Searching the web</span>
          </div>
        ) : (
          <>
            <div className="mb-2 mt-4 flex items-center gap-2">
              <span className="text-sm font-medium">Sources</span>
            </div>
            {results.map((result, i) => (
            <a
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-sm',
                'bg-background hover:bg-accent rounded-lg border transition-colors',
                'group cursor-pointer'
              )}
              href={result.url}
              key={i}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="flex items-center gap-2">
                {result.favicon && (
                  <img 
                    alt="" 
                    className="size-4 rounded-sm"
                    src={result.favicon}
                  />
                )}
                <span className="font-medium">{result.title}</span>
              </div>
              <ExternalLinkIcon
                className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"
                size={14}
              />
            </a>
          ))}
          </>
        )}
      </div>
    </div>
  );
}
