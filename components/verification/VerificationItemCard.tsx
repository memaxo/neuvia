import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Edit, Save, RotateCcw } from 'lucide-react';

// Import the enhanced VerificationItem type
import type { VerificationItem } from '@/lib/processing/types/verification/index';

interface VerificationItemCardProps {
  /**
   * Verification item to display
   */
  item: VerificationItem;
  
  /**
   * Callback when item verification status changes
   */
  onVerify: (itemId: string, isVerified: boolean) => void;
  
  /**
   * Callback when item value is edited
   */
  onEdit: (itemId: string, value: string) => void;
  
  /**
   * Callback when item is reset to original value
   */
  onReset: (itemId: string) => void;
}

/**
 * Card component for displaying and editing verification items
 */
export function VerificationItemCard({ item, onVerify, onEdit, onReset }: VerificationItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.value || '');
  
  // Handle toggle edit mode
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setEditValue(item.value || '');
    }
  };
  
  // Handle save edit
  const handleSaveEdit = () => {
    onEdit(item.id, editValue);
    setIsEditing(false);
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  };
  
  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(item.value || '');
    }
  };
  
  return (
    <Card className={item.isVerified ? 'border-green-200 bg-green-50/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{item.label || item.key}</CardTitle>
            {item.isRequired && (
              <Badge variant="outline" className="text-xs">Required</Badge>
            )}
            <Badge className="bg-blue-100 text-xs text-blue-800 hover:bg-blue-100">
              {item.category}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={item.isVerified ? 'default' : 'outline'} className="ml-2">
              {item.isVerified ? 'Verified' : 'Unverified'}
            </Badge>
            <Button 
              variant="ghost"
              size="icon" 
              onClick={handleToggleEdit}
              className="size-8"
            >
              <Edit className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        {isEditing ? (
          item.fieldType === 'longtext' ? (
            <Textarea
              className="font-mono text-sm"
              value={editValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={5}
            />
          ) : (
            <Input 
              className="font-mono text-sm"
              value={editValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
          )
        ) : (
          <div className="bg-muted break-all rounded-md p-3 font-mono text-sm">
            {item.value || <span className="italic text-muted-foreground">No value</span>}
          </div>
        )}
        
        {item.value !== item.originalValue && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-muted-foreground">Original value:</p>
            <div className="break-all rounded-md bg-slate-50 p-2 font-mono text-xs text-muted-foreground">
              {item.originalValue || <span className="italic">No original value</span>}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2 pt-0">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
            >
              <Save className="mr-1 size-3" />
              Save
            </Button>
          </>
        ) : (
          <>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => onReset(item.id)}
              disabled={item.value === item.originalValue}
            >
              <RotateCcw className="mr-1 size-3" />
              Reset
            </Button>
            
            <Button 
              size="sm"
              variant={item.isVerified ? 'destructive' : 'default'}
              onClick={() => onVerify(item.id, !item.isVerified)}
            >
              {item.isVerified ? (
                <>
                  <XCircle className="mr-1 size-3" />
                  Unverify
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1 size-3" />
                  Verify
                </>
              )}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
} 