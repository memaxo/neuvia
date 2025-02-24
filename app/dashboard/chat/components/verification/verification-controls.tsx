'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VerificationItem } from '@/lib/processing/types';

interface VerificationControlsProps {
  items: VerificationItem[];
  onVerify: (itemId: string, isVerified: boolean, corrections?: Record<string, any>) => void;
}

export function VerificationControls({ items, onVerify }: VerificationControlsProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, any>>({});

  const handleVerify = (itemId: string, isVerified: boolean) => {
    if (!isVerified) {
      setEditingItem(itemId);
    } else {
      onVerify(itemId, true);
    }
  };

  const handleCorrection = (itemId: string) => {
    onVerify(itemId, true, corrections);
    setEditingItem(null);
    setCorrections({});
  };

  const handleCorrectionChange = (key: string, value: any) => {
    setCorrections(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="space-y-4">
      <h3 className="mb-4 font-medium">Verification Controls</h3>

      {items.map((item) => (
        <div
          className="bg-background rounded-lg border p-4"
          key={item.id}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">
              {item.section.charAt(0).toUpperCase() + item.section.slice(1)}
            </span>
            <div className="flex items-center gap-2">
              {!item.isVerified ? (
                <>
                  <Button
                    onClick={() => handleVerify(item.id, true)}
                    size="sm"
                    variant="success"
                  >
                    Verify
                  </Button>
                  <Button
                    onClick={() => handleVerify(item.id, false)}
                    size="sm"
                    variant="warning"
                  >
                    Needs Correction
                  </Button>
                </>
              ) : (
                <span className="text-sm text-green-600">✓ Verified</span>
              )}
            </div>
          </div>

          {editingItem === item.id && (
            <div className="mt-4 space-y-4">
              <h4 className="text-sm font-medium">Make Corrections</h4>
              {Object.entries(item.value).map(([key, value]) => (
                <div className="space-y-1" key={key}>
                  <Label className="text-muted-foreground text-sm">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Label>
                  <Input
                    className="w-full"
                    onChange={(e) => handleCorrectionChange(key, e.target.value)}
                    size="sm"
                    type="text"
                    value={String(corrections[key] ?? value)}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setEditingItem(null)}
                  size="sm"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCorrection(item.id)}
                  size="sm"
                  variant="default"
                >
                  Save Corrections
                </Button>
              </div>
            </div>
          )}

          <div className="mt-2">
            <div className="text-muted-foreground text-xs">
              Confidence: {(item.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 