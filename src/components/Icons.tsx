const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// Secrets / Categories
export const IconKey = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
);

export const IconLock = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

export const IconDatabase = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
);

export const IconToken = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
);

export const IconTerminal = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
);

export const IconSettings = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
);

export const IconCert = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M12 15l-2 5l2-1l2 1l-2-5z" /><circle cx="12" cy="9" r="6" /></svg>
);

export const IconLink = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
);

export const IconLicense = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="6" y1="8" x2="18" y2="8" /><line x1="6" y1="12" x2="14" y2="12" /><line x1="6" y1="16" x2="10" y2="16" /></svg>
);

export const IconUser = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

export const IconCoin = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="9" y1="12" x2="15" y2="12" /></svg>
);

export const IconShield = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

// Files
export const IconFolder = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
);

export const IconCamera = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
);

export const IconPalette = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12" r="1.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.04-.23-.29-.38-.63-.38-1.02 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.17-4.49-9-10-9z" /></svg>
);

export const IconKeyhole = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="12" cy="16" r="1" /></svg>
);

// Notes
export const IconDoc = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
);

export const IconBuilding = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><rect x="4" y="2" width="16" height="20" rx="1" /><line x1="9" y1="6" x2="15" y2="6" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="15" y2="14" /><line x1="9" y1="18" x2="15" y2="18" /></svg>
);

export const IconTrendUp = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
);

export const IconLightbulb = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></svg>
);

export const IconNote = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

export const IconBook = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);

export const IconScale = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><line x1="12" y1="3" x2="12" y2="21" /><polyline points="1 12 5 8 9 12" /><polyline points="15 12 19 8 23 12" /><path d="M5 8l-4 8h8z" /><path d="M19 8l-4 8h8z" /></svg>
);

// Library
export const IconCredential = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="12" cy="16" r="1" /></svg>
);

export const IconBolt = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);

export const IconWrench = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
);

export const IconCode = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
);

export const IconBookOpen = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
);

export const IconCheck = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);

export const IconFile = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);

// Trash
export const IconTrash = ({ size = 16 }: { size?: number }) => (
  <svg {...s} width={size} height={size}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

// Map icon names to components
export const SECTION_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  "API Keys": IconKey,
  "Passwords": IconLock,
  "Database": IconDatabase,
  "OAuth Tokens": IconToken,
  "SSH Keys": IconTerminal,
  "Env Variables": IconSettings,
  "Certificates": IconCert,
  "Webhooks": IconLink,
  "License Keys": IconLicense,
  "Service Accounts": IconUser,
  "Personal Access Tokens": IconCoin,
  "Encryption Keys": IconShield,
};

export const FOLDER_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  "Screenshots": IconCamera,
  "Documents": IconDoc,
  "Configs": IconSettings,
  "Design": IconPalette,
  "Keys": IconKeyhole,
};

export const NOTE_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  "Architecture": IconBuilding,
  "Improvements": IconTrendUp,
  "Ideas": IconLightbulb,
  "Meeting Notes": IconNote,
  "API Docs": IconBook,
  "Decisions": IconScale,
};

export const LIBRARY_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  "Credentials": IconCredential,
  "Workflow": IconBolt,
  "Setup Guide": IconWrench,
  "Code Snippet": IconCode,
  "Reference": IconBookOpen,
  "Checklist": IconCheck,
};

