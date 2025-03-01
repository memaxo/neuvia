'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { CheckCircle, AlertCircle, Edit, ThumbsUp, ThumbsDown, History, Clock, Check, X, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { VerificationStatusType } from '@/lib/workflow/types';

/**
 * Verification status indicator component
 */
export const VerificationStatus = ({ 
  status,
  className
}: { 
  status: VerificationStatusType;
  className?: string;
}) => {
  let statusText = '';
  let Icon = Clock;
  let statusColor = '';
  
  switch (status) {
    case 'pending':
      statusText = 'Pending Verification';
      Icon = Clock;
      statusColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      break;
    case 'in_progress':
      statusText = 'Verification In Progress';
      Icon = Loader2;
      statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      break;
    case 'completed':
      statusText = 'Verified';
      Icon = CheckCircle;
      statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      break;
    case 'failed':
      statusText = 'Verification Failed';
      Icon = AlertCircle;
      statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      break;
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'px-2 py-1 flex items-center gap-1.5', 
        statusColor,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'in_progress' && 'animate-spin')} />
      <span>{statusText}</span>
    </Badge>
  );
};

/**
 * Verification action buttons component
 */
export const VerificationActions = ({
  onConfirm,
  onEdit,
  onHistory,
  className
}: {
  onConfirm: () => void;
  onEdit: () => void;
  onHistory?: () => void;
  className?: string;
}) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-green-100 hover:bg-green-200 text-green-800 border-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/50 dark:text-green-300 dark:border-green-800"
            onClick={onConfirm}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Confirm
          </Button>
        </TooltipTrigger>
        <TooltipContent>Confirm this summary is correct</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 dark:text-amber-300 dark:border-amber-800" 
            onClick={onEdit}
          >
            <Edit className="mr-1 h-4 w-4" />
            Edit
          </Button>
        </TooltipTrigger>
        <TooltipContent>Make changes to this summary</TooltipContent>
      </Tooltip>
      
      {onHistory && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onHistory}
            >
              <History className="mr-1 h-4 w-4" />
              History
            </Button>
          </TooltipTrigger>
          <TooltipContent>View previous versions</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

/**
 * Section-specific correction buttons component
 */
export const SectionCorrectionButtons = ({
  sectionTitle,
  onCorrect,
  className
}: {
  sectionTitle: string;
  onCorrect: (section: string) => void;
  className?: string;
}) => {
  return (
    <div className={cn('flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="h-6 px-2 text-xs"
            onClick={() => onCorrect(sectionTitle)}
          >
            <Edit className="mr-1 h-3 w-3" />
            Edit Section
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit this section</TooltipContent>
      </Tooltip>
    </div>
  );
};

/**
 * Progress visualization for extraction and verification
 */
export const ProgressIndicator = ({
  value,
  phase,
  className
}: {
  value: number;
  phase: string;
  className?: string;
}) => {
  return (
    <div className={cn('w-full space-y-1', className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{phase}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
};

/**
 * Version indicator component
 */
export const VersionIndicator = ({
  version,
  total,
  className
}: {
  version: number;
  total: number;
  className?: string;
}) => {
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      Version {version}/{total}
    </Badge>
  );
};

/**
 * Thumbs up/down voting component for verification sections
 */
export const SectionVoting = ({
  onApprove,
  onReject,
  className
}: {
  onApprove: () => void;
  onReject: () => void;
  className?: string;
}) => {
  return (
    <div className={cn('flex gap-1', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="h-6 w-6 p-0 rounded-full text-green-600"
            onClick={onApprove}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            <span className="sr-only">Approve</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Approve this section</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="h-6 w-6 p-0 rounded-full text-red-600"
            onClick={onReject}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            <span className="sr-only">Reject</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reject this section</TooltipContent>
      </Tooltip>
    </div>
  );
}; 