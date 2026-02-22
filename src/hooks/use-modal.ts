import { create } from "zustand";

export type OrbitModalType =
  | "createServer"
  | "createChannel"
  | "joinServer"
  | "settings"
  | "serverHub"
  | "channelSettings";

interface OrbitModalData {
  serverId?: string;
  channelId?: string;
  section?: "OVERVIEW" | "LIFT" | "PERMISSIONS";
}

interface OrbitModalStore {
  type: OrbitModalType | null;
  isOpen: boolean;
  data: OrbitModalData;
  onOpen: (type: OrbitModalType, data?: OrbitModalData) => void;
  onClose: () => void;
}

export const useModal = create<OrbitModalStore>((set) => ({
  type: null,
  isOpen: false,
  data: {},
  onOpen: (type, data = {}) =>
    set({
      type,
      data,
      isOpen: true,
    }),
  onClose: () =>
    set({
      type: null,
      data: {},
      isOpen: false,
    }),
}));
