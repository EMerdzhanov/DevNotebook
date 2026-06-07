import { useState, useEffect, useCallback } from "react";
import type {
  Project,
  SecretCategory,
  Note,
  NoteFolder,
  FileFolder,
  Favorite,
  LibraryEntry,
  AppScreen,
  ViewState,
} from "./types";
import * as api from "./hooks/useTauri";
import TabBar from "./components/TabBar";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import SecretListView from "./components/SecretListView";
import NoteEditor from "./components/NoteEditor";
import NoteListView from "./components/NoteListView";
import LockScreen from "./components/LockScreen";
import SettingsView from "./components/SettingsView";
import FileListView from "./components/FileListView";
import TrashView from "./components/TrashView";
import ProjectDashboard from "./components/ProjectDashboard";
import LibraryView from "./components/LibraryView";
import JournalView from "./components/JournalView";
import NewProjectModal from "./components/NewProjectModal";
import GlobalSearch from "./components/GlobalSearch";
import CredentialEditor from "./components/CredentialEditor";
import ChecklistEditor from "./components/ChecklistEditor";
import CodeSnippetEditor from "./components/CodeSnippetEditor";
import WorkflowEditor from "./components/WorkflowEditor";
import LibraryEntryEditor from "./components/LibraryEntryEditor";
import TodoPanel from "./components/TodoPanel";
import LibraryPanel from "./components/LibraryPanel";
import CommandPalette from "./components/CommandPalette";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import UndoToast from "./components/UndoToast";
import type { UndoAction } from "./components/UndoToast";
import { useBluetooth } from "./hooks/useBluetooth";
import { useDragDrop } from "./hooks/useDragDrop";
import { getSavedThemeId, getThemeById, applyTheme, saveThemeId } from "./themes";

export default function App() {
  // App state
  const [screen, setScreen] = useState<AppScreen>("loading");
  const [authError, setAuthError] = useState<string | null>(null);

  // Theme state
  const [activeThemeId, setActiveThemeId] = useState(() => getSavedThemeId());

  useEffect(() => {
    applyTheme(getThemeById(activeThemeId));
  }, [activeThemeId]);

  const handleThemeChange = (id: string) => {
    setActiveThemeId(id);
    saveThemeId(id);
    applyTheme(getThemeById(id));
  };

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [categories, setCategories] = useState<SecretCategory[]>([]);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>([]);
  const [availableNoteFolderTemplates, setAvailableNoteFolderTemplates] = useState<string[]>([]);
  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [projectLibraryEntries, setProjectLibraryEntries] = useState<LibraryEntry[]>([]);

  const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
  const [fileFolders, setFileFolders] = useState<FileFolder[]>([]);
  const [availableFileFolderTemplates, setAvailableFileFolderTemplates] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [autoLockTimer, setAutoLockTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [todoPanelOpen, setTodoPanelOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryAutoCreate, setLibraryAutoCreate] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  // View state
  const [viewState, setViewState] = useState<ViewState | null>(null);

  // Bluetooth auto-lock
  const handleBluetoothLock = useCallback(async () => {
    try {
      await api.lockVault();
      setScreen("login");
    } catch (err) {
      console.error("Failed to lock vault:", err);
    }
  }, []);

  const bluetooth = useBluetooth(handleBluetoothLock);

  // Global drag-and-drop
  const handleFilesDropped = useCallback(
    async (paths: string[]) => {
      if (!activeProjectId || screen !== "main") return;

      // Find or create a default file folder
      let folders = fileFolders;
      let folder = folders.find((f) => f.name === "Documents");
      if (!folder) {
        try {
          folder = await api.createFileFolder(activeProjectId, "Documents");
          setFileFolders((prev) => [...prev, folder!]);
        } catch (err) {
          console.error("Failed to create folder:", err);
          return;
        }
      }

      for (const path of paths) {
        try {
          await api.addFile(activeProjectId, folder.id, path, false);
        } catch (err) {
          console.error("Failed to add dropped file:", err);
        }
      }

      // Switch to the files view to show what was added
      setViewState({ view: "files", folderId: folder.id });
      // Reload folder data to update counts
      if (activeProjectId) {
        const updatedFolders = await api.getFileFolders(activeProjectId);
        setFileFolders(updatedFolders);
      }
    },
    [activeProjectId, screen, fileFolders],
  );

  const { isDragging } = useDragDrop(handleFilesDropped);

  // Auto-lock on inactivity
  useEffect(() => {
    if (screen !== "main") return;

    const resetTimer = async () => {
      if (autoLockTimer) clearTimeout(autoLockTimer);
      try {
        const minutes = await api.getAutoLockTimeout();
        if (minutes > 0) {
          const timer = setTimeout(async () => {
            try {
              await api.lockVault();
              setScreen("login");
            } catch {}
          }, minutes * 60 * 1000);
          setAutoLockTimer(timer);
        }
      } catch {}
    };

    resetTimer();
    const events = ["mousedown", "keydown", "mousemove", "touchstart"];
    const handler = () => resetTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (autoLockTimer) clearTimeout(autoLockTimer);
    };
  }, [screen]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      } else if (meta && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen((v) => !v);
      } else if (meta && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (meta && e.key === "l" && screen === "main") {
        e.preventDefault();
        handleLockVault();
      } else if (meta && e.key === ",") {
        e.preventDefault();
        setViewState({ view: "settings" });
      } else if (meta && e.key === "t" && screen === "main") {
        e.preventDefault();
        setTodoPanelOpen((v) => !v);
      } else if (meta && e.shiftKey && e.key === "l" && screen === "main") {
        e.preventDefault();
        { setLibraryAutoCreate(false); setViewState(viewState?.view === "library" ? null : { view: "library" }); };
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen]);

  // Check if vault exists on mount
  useEffect(() => {
    const init = async () => {
      try {
        const exists = await api.checkVaultExists();
        setScreen(exists ? "login" : "setup");
      } catch (err) {
        console.error("Init failed:", err);
        setScreen("setup");
      }
    };
    init();
  }, []);

  // Load project data when active project changes
  const loadProjectData = useCallback(async (projectId: string) => {
    try {
      const [cats, templates, nFolders, nFolderTemplates, folders, folderTemplates, favs] = await Promise.all([
        api.getSecretCategories(projectId),
        api.getBuiltinTemplates(projectId),
        api.getNoteFolders(projectId),
        api.getSuggestedNoteFolders(projectId),
        api.getFileFolders(projectId),
        api.getSuggestedFileFolders(projectId),
        api.getFavorites(projectId),
      ]);
      setCategories(cats);
      setAvailableTemplates(templates);
      setNoteFolders(nFolders);
      setAvailableNoteFolderTemplates(nFolderTemplates);
      setFileFolders(folders);
      setAvailableFileFolderTemplates(folderTemplates);
      setFavorites(favs);
      setCurrentNotes([]);

      // Load project-linked library entries
      try {
        const libEntries = await api.getLibraryEntries(projectId);
        setProjectLibraryEntries(libEntries.filter((e) => !e.is_global));
      } catch { setProjectLibraryEntries([]); }

      // Select first category by default
      if (cats.length > 0) {
        setViewState({ view: "secrets", categoryId: cats[0].id });
      } else {
        setViewState(null);
      }
    } catch (err) {
      console.error("Failed to load project data:", err);
    }
  }, []);

  // Handle vault creation / unlock
  const handleAuth = async (password: string) => {
    setAuthError(null);
    try {
      if (screen === "setup") {
        await api.createVault(password);
      } else {
        await api.unlockVault(password);
      }

      // Load projects
      const projectList = await api.getProjects();
      setProjects(projectList);

      if (projectList.length > 0) {
        setActiveProjectId(projectList[0].id);
        await loadProjectData(projectList[0].id);
      } else {
        setViewState({ view: "dashboard" });
      }

      setScreen("main");
    } catch (err) {
      setAuthError(String(err));
      throw err;
    }
  };

  // Project handlers
  const handleSelectProject = async (id: string) => {
    setActiveProjectId(id);
    await loadProjectData(id);
  };

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const handleCreateProject = () => {
    setShowNewProjectModal(true);
  };

  const handleProjectCreated = async (project: Project) => {
    setShowNewProjectModal(false);
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);
    await loadProjectData(project.id);
    setViewState(null);
  };

  const handleCloseProject = async (id: string) => {
    try {
      await api.closeProject(id);
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) {
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
          await loadProjectData(remaining[0].id);
        } else {
          setActiveProjectId(null);
          setViewState({ view: "dashboard" });
        }
      }
    } catch (err) {
      console.error("Failed to close project:", err);
    }
  };

  const handleOpenExistingProject = async (id: string) => {
    try {
      await api.openProject(id);
      const openProjects = await api.getProjects();
      setProjects(openProjects);
      setActiveProjectId(id);
      await loadProjectData(id);
      setViewState(null);
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  };

  const reloadOpenProjects = async () => {
    try {
      const openProjects = await api.getProjects();
      setProjects(openProjects);
    } catch (err) {
      console.error("Failed to reload projects:", err);
    }
  };

  const handleRenameProject = async (id: string, name: string) => {
    try {
      await api.renameProject(id, name);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name } : p)),
      );
    } catch (err) {
      console.error("Failed to rename project:", err);
    }
  };

  // Sidebar handlers
  const handleSelectFavorite = (fav: Favorite) => {
    if (fav.item_type === "secret") {
      // Find which category this secret belongs to — for now navigate to secrets view
      // We'd need the category_id, so let's just copy the secret value
      handleQuickCopyById(fav.item_id);
    } else if (fav.item_type === "note") {
      setViewState({ view: "note", noteId: fav.item_id });
    } else if (fav.item_type === "file") {
      // Open the file
      api.openFile(fav.item_id).catch(console.error);
    }
  };

  const handleQuickCopyById = async (secretId: string) => {
    try {
      const value = await api.revealSecret(secretId);
      await navigator.clipboard.writeText(value);
      setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000);
    } catch (err) {
      console.error("Quick copy failed:", err);
    }
  };

  const handleSelectCategory = (id: string) => {
    setViewState({ view: "secrets", categoryId: id });
  };

  const handleQuickCopy = async (categoryId: string) => {
    try {
      const secrets = await api.getSecrets(categoryId);
      if (secrets.length === 0) return;
      const value = await api.revealSecret(secrets[0].id);
      await navigator.clipboard.writeText(value);
      // Auto-clear after 30s
      setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000);
    } catch (err) {
      console.error("Quick copy failed:", err);
    }
  };

  const handleSelectNoteFolder = async (id: string) => {
    setViewState({ view: "notes", noteFolderId: id });
    try {
      const notes = await api.getNotes(id);
      setCurrentNotes(notes);
    } catch (err) {
      console.error("Failed to load notes:", err);
    }
  };

  const handleSelectNote = (id: string) => {
    setViewState({ view: "note", noteId: id });
  };

  const handleAddSection = async (name: string) => {
    if (!activeProjectId) return;
    try {
      const cat = await api.createSecretCategory(activeProjectId, name);
      setCategories((prev) => [...prev, cat]);
      setAvailableTemplates((prev) => prev.filter((t) => t !== name));
      setViewState({ view: "secrets", categoryId: cat.id });
    } catch (err) {
      console.error("Failed to add section:", err);
    }
  };

  const handleSelectFileFolder = (id: string) => {
    setViewState({ view: "files", folderId: id });
  };

  const handleAddFileFolder = async (name: string) => {
    if (!activeProjectId) return;
    try {
      const folder = await api.createFileFolder(activeProjectId, name);
      setFileFolders((prev) => [...prev, folder]);
      setAvailableFileFolderTemplates((prev) => prev.filter((t) => t !== name));
      setViewState({ view: "files", folderId: folder.id });
    } catch (err) {
      console.error("Failed to add file folder:", err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.deleteSecretCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (viewState?.view === "secrets" && viewState.categoryId === id) {
        setViewState(null);
      }
      // Refresh available templates so deleted category reappears
      if (activeProjectId) {
        const templates = await api.getBuiltinTemplates(activeProjectId);
        setAvailableTemplates(templates);
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const handleDeleteFileFolder = async (id: string) => {
    try {
      await api.deleteFileFolder(id);
      setFileFolders((prev) => prev.filter((f) => f.id !== id));
      if (viewState?.view === "files" && viewState.folderId === id) {
        setViewState(null);
      }
      if (activeProjectId) {
        const templates = await api.getSuggestedFileFolders(activeProjectId);
        setAvailableFileFolderTemplates(templates);
      }
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  };

  const handleToggleFavorite = async (itemId: string, itemType: string, itemName: string) => {
    if (!activeProjectId) return;
    try {
      const isFav = await api.toggleFavorite(activeProjectId, itemId, itemType, itemName);
      if (isFav) {
        const favs = await api.getFavorites(activeProjectId);
        setFavorites(favs);
      } else {
        setFavorites((prev) => prev.filter((f) => f.item_id !== itemId));
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleOpenSettings = () => {
    setViewState(viewState?.view === "settings" ? null : { view: "settings" });
  };

  const handleLockVault = async () => {
    try {
      await api.lockVault();
      setScreen("login");
    } catch (err) {
      console.error("Failed to lock vault:", err);
    }
  };

  const handleAddNoteFolder = async (name: string) => {
    if (!activeProjectId) return;
    try {
      const folder = await api.createNoteFolder(activeProjectId, name);
      setNoteFolders((prev) => [...prev, folder]);
      setAvailableNoteFolderTemplates((prev) => prev.filter((t) => t !== name));
      setViewState({ view: "notes", noteFolderId: folder.id });
      setCurrentNotes([]);
    } catch (err) {
      console.error("Failed to add note folder:", err);
    }
  };

  const handleDeleteNoteFolder = async (id: string) => {
    try {
      await api.deleteNoteFolder(id);
      setNoteFolders((prev) => prev.filter((f) => f.id !== id));
      if (viewState?.view === "notes" && viewState.noteFolderId === id) {
        setViewState(null);
      }
      if (activeProjectId) {
        const templates = await api.getSuggestedNoteFolders(activeProjectId);
        setAvailableNoteFolderTemplates(templates);
      }
    } catch (err) {
      console.error("Failed to delete note folder:", err);
    }
  };

  // ── Render ──

  if (screen === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (screen === "setup" || screen === "login") {
    return (
      <LockScreen
        isNewVault={screen === "setup"}
        onSubmit={handleAuth}
        error={authError}
      />
    );
  }

  // Main app
  const activeCategoryId =
    viewState?.view === "secrets" ? viewState.categoryId : null;
  const activeNoteId = viewState?.view === "note" ? viewState.noteId : null;
  const activeFolderId = viewState?.view === "files" ? viewState.folderId : null;
  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const activeFolder = fileFolders.find((f) => f.id === activeFolderId);

  const tabBar = (
    <TabBar
      projects={projects}
      activeProjectId={activeProjectId}
      onSelectProject={handleSelectProject}
      onCreateProject={handleCreateProject}
      onCloseProject={handleCloseProject}
      onRenameProject={handleRenameProject}
        onOpenDashboard={() => setViewState(viewState?.view === "dashboard" ? null : { view: "dashboard" })}
      isDashboardActive={viewState?.view === "dashboard"}
      onOpenLibrary={() => { setLibraryAutoCreate(false); setViewState(viewState?.view === "library" ? null : { view: "library" }); }}
      isLibraryActive={viewState?.view === "library"}
        onOpenJournal={() => { setViewState(viewState?.view === "journal" ? null : { view: "journal" }); }}
        isJournalActive={viewState?.view === "journal"}
      onOpenSettings={handleOpenSettings}
      isSettingsActive={viewState?.view === "settings"}
      onOpenTrash={() => setViewState(viewState?.view === "trash" ? null : { view: "trash" })}
      isTrashActive={viewState?.view === "trash"}
      sidebarOffset={sidebarCollapsed ? 44 : sidebarWidth}
    />
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base">

      {/* Tab bar — always full width at top */}
      {tabBar}

      {/* Full-screen views */}
      {viewState?.view === "dashboard" && (
        <div className="flex-1 overflow-y-auto">
          <button onClick={() => setViewState(null)} className="ml-6 mt-4 flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <ProjectDashboard
            onOpenProject={handleOpenExistingProject}
            onProjectsChanged={reloadOpenProjects}
            onOpenLibraryEntry={() => {
              setViewState({ view: "library" });
            }}
            onCreateProject={handleCreateProject}
            onCreateLibraryEntry={() => { setLibraryAutoCreate(true); setViewState({ view: "library" }); }}
          />
        </div>
      )}
      {viewState?.view === "library" && (
        <div className="flex-1 overflow-y-auto">
          <button onClick={() => setViewState(null)} className="ml-6 mt-4 flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <LibraryView autoCreate={libraryAutoCreate} />
        </div>
      )}
      {viewState?.view === "journal" && activeProjectId && (
        <div className="flex-1 overflow-y-auto">
          <button onClick={() => setViewState(null)} className="ml-6 mt-4 flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <JournalView
            projectId={activeProjectId}
            projectName={projects.find((p) => p.id === activeProjectId)?.name || "Project"}
          />
        </div>
      )}
      {viewState?.view === "settings" && (
        <div className="flex-1 overflow-y-auto">
          <button onClick={() => setViewState(null)} className="ml-6 mt-4 flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <SettingsView
            bluetoothStatus={bluetooth.status}
            activeThemeId={activeThemeId}
            pairing={bluetooth.pairing}
            pairedDevice={bluetooth.pairedDevice}
            sensitivity={bluetooth.sensitivity}
            onThemeChange={handleThemeChange}
            onStartPairing={bluetooth.startPairing}
            onCheckPairingConfirmed={bluetooth.checkPairingConfirmed}
            onCompletePairing={bluetooth.completePairing}
            onCancelPairing={bluetooth.cancelPairing}
            onUnpairDevice={bluetooth.unpairDevice}
            onUpdateSensitivity={bluetooth.updateSensitivity}
            onLockVault={handleLockVault}
          />
        </div>
      )}
      {viewState?.view === "trash" && (
        <div className="flex-1 overflow-y-auto">
          <button onClick={() => setViewState(null)} className="ml-6 mt-4 flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <TrashView
            onRestored={() => {
              if (activeProjectId) loadProjectData(activeProjectId);
            }}
          />
        </div>
      )}

      {/* Project view (sidebars + content + todo + library) */}
      {viewState?.view !== "settings" && viewState?.view !== "trash" && viewState?.view !== "dashboard" && viewState?.view !== "library" && viewState?.view !== "journal" && (
        <>
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar — spans full height including tab bar area */}
            <Sidebar
              categories={categories}
              noteFolders={noteFolders}
              fileFolders={fileFolders}
              activeCategoryId={activeCategoryId}
              activeNoteFolderId={viewState?.view === "notes" ? viewState.noteFolderId : null}
              activeFolderId={activeFolderId}
              availableTemplates={availableTemplates}
              availableNoteFolderTemplates={availableNoteFolderTemplates}
              availableFileFolderTemplates={availableFileFolderTemplates}
              onSelectCategory={handleSelectCategory}
              onSelectNoteFolder={handleSelectNoteFolder}
              onSelectFileFolder={handleSelectFileFolder}
              onAddSection={handleAddSection}
              onAddNoteFolder={handleAddNoteFolder}
              onAddFileFolder={handleAddFileFolder}
              favorites={favorites}
              onQuickCopy={handleQuickCopy}
              onSelectFavorite={handleSelectFavorite}
              onDeleteCategory={handleDeleteCategory}
              onDeleteNoteFolder={handleDeleteNoteFolder}
              onDeleteFileFolder={handleDeleteFileFolder}
              onToggleFavorite={handleToggleFavorite}
              onCreateLibraryEntry={async (entryType: string) => {
                if (!activeProjectId) return;
                try {
                  const entry = await api.createLibraryEntry(activeProjectId, entryType, entryType, false);
                  const libEntries = await api.getLibraryEntries(activeProjectId);
                  setProjectLibraryEntries(libEntries.filter((e: LibraryEntry) => !e.is_global));
                  setViewState({ view: "libraryEntry", entryId: entry.id });
                } catch (err) {
                  console.error("Failed to create library entry:", err);
                }
              }}
              projectLibraryEntries={projectLibraryEntries}
              activeLibraryEntryId={viewState?.view === "libraryEntry" ? viewState.entryId : null}
              onSelectLibraryEntry={(id: string) => setViewState({ view: "libraryEntry", entryId: id })}
              onDeleteLibraryEntry={async (id: string) => {
                try {
                  await api.deleteLibraryEntry(id);
                  if (activeProjectId) {
                    const libEntries = await api.getLibraryEntries(activeProjectId);
                    setProjectLibraryEntries(libEntries.filter((e: LibraryEntry) => !e.is_global));
                  }
                  if (viewState?.view === "libraryEntry" && viewState.entryId === id) {
                    setViewState(null);
                  }
                } catch (err) {
                  console.error("Failed to delete library entry:", err);
                }
              }}
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />

            {/* Content column */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Content Area */}
              {viewState && (
                <div className="flex items-center border-b border-border bg-bg-base px-4 py-1.5">
                  <button
                    onClick={() => setViewState(null)}
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-text-muted transition-colors hover:bg-bg-input hover:text-text-primary"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back
                  </button>
                </div>
              )}
              {viewState?.view === "secrets" && activeCategory && (
              <SecretListView
                categoryId={activeCategory.id}
                categoryName={activeCategory.name}
              />
            )}
            {viewState?.view === "notes" && viewState.noteFolderId && activeProjectId && (() => {
              const folder = noteFolders.find((f) => f.id === viewState.noteFolderId);
              return (
                <NoteListView
                  folderId={viewState.noteFolderId}
                  folderName={folder?.name || "Notes"}
                  projectId={activeProjectId}
                  notes={currentNotes}
                  onSelectNote={handleSelectNote}
                  onNotesChanged={async () => {
                    const updated = await api.getNotes(viewState.noteFolderId);
                    setCurrentNotes(updated);
                    const updatedFolders = await api.getNoteFolders(activeProjectId);
                    setNoteFolders(updatedFolders);
                  }}
                />
              );
            })()}
            {viewState?.view === "note" && activeNoteId && (() => {
              const note = currentNotes.find((n) => n.id === activeNoteId);
              return note ? (
                <NoteEditor
                  noteId={activeNoteId}
                  projectId={note.project_id}
                  initialTitle={note.title}
                  initialContent={note.content}
                />
              ) : null;
            })()}
            {viewState?.view === "files" && activeFolder && activeProjectId && (
              <FileListView
                folderId={activeFolder.id}
                folderName={activeFolder.name}
                projectId={activeProjectId}
              />
            )}
            {viewState?.view === "libraryEntry" && (() => {
              const entry = projectLibraryEntries.find((e) => e.id === viewState.entryId);
              if (!entry) return null;
              const reloadLib = async () => {
                if (activeProjectId) {
                  const libEntries = await api.getLibraryEntries(activeProjectId);
                  setProjectLibraryEntries(libEntries.filter((e: LibraryEntry) => !e.is_global));
                }
              };
              const props = { entry, onSaved: reloadLib, onDelete: () => {} };
              if (entry.entry_type === "Credentials") return <CredentialEditor key={entry.id} {...props} />;
              if (entry.entry_type === "Checklist") return <ChecklistEditor key={entry.id} {...props} />;
              if (entry.entry_type === "Code Snippet") return <CodeSnippetEditor key={entry.id} {...props} />;
              if (entry.entry_type === "Workflow") return <WorkflowEditor key={entry.id} {...props} />;
              // Fallback: TipTap editor for Setup Guide, Reference, and custom types
              return <LibraryEntryEditor key={entry.id} {...props} />;
            })()}
            {!viewState && (
              <div className="paper-texture flex flex-1 items-center justify-center text-text-muted">
                Select a category or note from the sidebar
              </div>
            )}
            </div>

            {/* Todo Panel (right sidebar) */}
            <TodoPanel
              projectId={activeProjectId}
              isOpen={todoPanelOpen}
              onToggle={() => setTodoPanelOpen(!todoPanelOpen)}
            />
          </div>

          {/* Library Panel */}
          <LibraryPanel
            projectId={activeProjectId}
            isOpen={libraryOpen}
            onToggle={() => setLibraryOpen(!libraryOpen)}
          />
        </>
      )}

      {/* Status Bar */}
      <StatusBar
        bluetoothStatus={bluetooth.status}
        bluetoothDevice={bluetooth.pairedDevice?.name || ""}
        lockCountdown={bluetooth.countdown}
      />

      {/* Global Search */}
      <GlobalSearch
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={(itemType, _itemId, projectId) => {
          // Open the project and navigate to the item type
          if (projectId) {
            handleOpenExistingProject(projectId);
          }
          if (itemType === "library") setViewState({ view: "library" });
          else if (itemType === "journal") setViewState({ view: "journal" });
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        projects={projects}
        categories={categories}
        noteFolders={noteFolders}
        fileFolders={fileFolders}
        onSelectProject={handleSelectProject}
        onSelectCategory={handleSelectCategory}
        onSelectNoteFolder={handleSelectNoteFolder}
        onSelectFileFolder={handleSelectFileFolder}
        onOpenSettings={handleOpenSettings}
        onLockVault={handleLockVault}
      />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Undo Toast */}
      <UndoToast
        action={undoAction}
        onDismiss={() => setUndoAction(null)}
      />

      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onCreated={handleProjectCreated}
          onClose={() => setShowNewProjectModal(false)}
        />
      )}

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border-2 border-dashed border-accent bg-bg-base px-12 py-10 text-center">
            <div className="text-lg font-medium text-accent">Drop files to add</div>
            <div className="mt-2 text-[13px] text-text-muted">
              Files will be added to the current project
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
