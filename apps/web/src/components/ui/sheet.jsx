import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export function Sheet({ open, onOpenChange, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function SheetTrigger({ children, asChild }) {
  return <DialogPrimitive.Trigger asChild={asChild}>{children}</DialogPrimitive.Trigger>;
}

export function SheetContent({ children, className, side = 'left' }) {
  const sideClass = {
    left: 'inset-y-0 left-0 w-72 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    right: 'inset-y-0 right-0 w-72 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  }[side] || '';

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-card border-border flex flex-col gap-0 overflow-y-auto shadow-xl',
          'transition-all data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
          sideClass,
          className
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetClose({ children, asChild, className }) {
  return (
    <DialogPrimitive.Close asChild={asChild} className={className}>
      {children}
    </DialogPrimitive.Close>
  );
}
