"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteServiceProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName?: string;
  serviceId?: string;
  onConfirm: (id: string) => void;
  isDeleting?: boolean;
}

function DeleteService({
  isOpen,
  onOpenChange,
  serviceName = 'this service',
  serviceId,
  onConfirm,
  isDeleting = false,
}: DeleteServiceProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Reset confirm text when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setIsValid(false);
    }
  }, [isOpen]);

  // Check if entered text matches service name
  useEffect(() => {
    if (serviceName) {
      setIsValid(confirmText.trim() === serviceName);
    }
  }, [confirmText, serviceName]);

  const handleConfirm = () => {
    if (isValid && serviceId) {
      onConfirm(serviceId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !isDeleting) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-5">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <DialogTitle className="text-base font-semibold text-gray-900">
              Delete Service
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-500">
            Are you sure you want to delete <strong className="text-gray-700">{serviceName}</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Box */}
        <div className="bg-red-50 border border-red-200 rounded-md p-2.5 my-1">
          <p className="text-xs text-red-700 flex items-center gap-1.5">
            <span className="font-medium">⚠️ Warning:</span>
            This will permanently delete this service.
          </p>
        </div>

        {/* Validation Input */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm-delete" className="text-xs font-medium text-gray-700">
            Type <span className="font-bold text-gray-900">{serviceName}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            type="text"
            placeholder={`Type "${serviceName}" to confirm`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDeleting}
            className={`h-9 text-sm ${
              confirmText && !isValid 
                ? 'border-red-500 focus-visible:ring-red-500' 
                : isValid 
                  ? 'border-emerald-500 focus-visible:ring-emerald-500' 
                  : 'border-gray-300 focus-visible:ring-black'
            }`}
            autoFocus
          />
          {confirmText && !isValid && (
            <p className="text-xs text-red-500">
              Please type the service name correctly
            </p>
          )}
          {isValid && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              ✓ Service name verified
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="flex-1 h-9 text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isDeleting}
            className="flex-1 h-9 text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Service'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteService;