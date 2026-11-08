"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function AdminErrorToast({ message }: { message: string | null }) {
  useEffect(() => {
    if (!message) return;
    toast.error("Admin data could not be loaded", { description: message });
  }, [message]);

  return null;
}
