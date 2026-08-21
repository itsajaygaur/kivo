"use client";
import { useState } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Spinner } from "./spinner";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} dismissable={!pending} label={title}>
      <div className="confirm-body">
        <h2>{title}</h2>
        <p className="muted">{description}</p>
        <footer>
          <Button compact disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            danger
            compact
            disabled={pending}
            onClick={() => {
              setPending(true);
              void Promise.resolve(onConfirm()).finally(() => {
                setPending(false);
                onClose();
              });
            }}
          >
            {pending && <Spinner size={13} />}
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
