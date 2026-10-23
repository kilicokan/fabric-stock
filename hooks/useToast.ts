import { toast } from "react-hot-toast";

export const notifySuccess = (message: string) => toast.success(message, { position: "top-right" });

export const notifyError = (message: string) => toast.error(message, { position: "top-right" });

export const notifyInfo = (message: string) => toast(message, { position: "top-right", icon: "ℹ️" });
