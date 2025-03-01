'use client';

import { memo } from 'react';
import { File, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The attachment type needed for chat attachments
interface AttachmentProps {
  attachment: {
    url: string;
    name: string;
    contentType: string;
  };
  isUploading?: boolean;
  onRemove?: () => void;
}

function PurePreviewAttachment({ attachment, isUploading = false, onRemove }: AttachmentProps) {
  // Get the appropriate icon based on content type
  const getIcon = () => {
    if (attachment.contentType.startsWith('image/')) {
      return <ImageIcon className="size-4" />;
    } else if (
      attachment.contentType === 'application/pdf' || 
      attachment.contentType.includes('document')
    ) {
      return <FileText className="size-4" />;
    } else {
      return <File className="size-4" />;
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-2 rounded border px-3 py-1.5",
        isUploading ? "border-muted bg-muted/50" : "bg-card"
      )}
    >
      <div className="flex items-center gap-1">
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          getIcon()
        )}
        
        <span className="text-sm truncate max-w-[120px]">
          {attachment.name}
        </span>
      </div>
      
      {onRemove && !isUploading && (
        <Button 
          className="ml-1 h-5 w-5 p-0 hover:bg-muted" 
          onClick={onRemove}
          size="sm" 
          variant="ghost"
        >
          <span className="sr-only">Remove</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      )}
      
      {isUploading && (
        <span className="text-xs text-muted-foreground ml-1">Uploading...</span>
      )}
    </div>
  );
}

export const PreviewAttachment = memo(PurePreviewAttachment); 