import { useState, useEffect, useCallback } from "react";
import type {
  Project,
  SecretCategory,
  Note,
  FileFolder,
  AppScreen,
  ViewState,
} from "./types";
import * as api from "./hooks/useTauri";
import TabBar from "./components/TabBar";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import SecretListView from "./components/SecretListView";
import NoteEditor from "./components/NoteEditor";
import LockScreen from "./components/LockScreen";
import SettingsView from "./components/SettingsView";
import FileListView from "./components/FileListView";
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
  const [notes, setNotes] = useState<Note[]>([]);

  const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
  const [fileFolders, setFileFolders] = useState<FileFolder[]>([]);
  const [availableFileFolderTemplates, setAvailableFileFolderTemplates] = useState<string[]>([]);

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
      const [cats, noteList, templates, folders, folderTemplates] = await Promise.all([
        api.getSecretCategories(projectId),
        api.getNotes(projectId),
        api.getBuiltinTemplates(projectId),
        api.getFileFolders(projectId),
        api.getSuggestedFileFolders(projectId),
      ]);
      setCategories(cats);
      setNotes(noteList);
      setAvailableTemplates(templates);
      setFileFolders(folders);
      setAvailableFileFolderTemplates(folderTemplates);

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

  const handleCreateProject = async () => {
    try {
      const project = await api.createProject("New Project");
      setProjects((prev) => [...prev, project]);
      setActiveProjectId(project.id);
      await loadProjectData(project.id);
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const handleCloseProject = async (id: string) => {
    if (projects.length <= 1) return; // Don't close last project
    try {
      await api.deleteProject(id);
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id && remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
        await loadProjectData(remaining[0].id);
      }
    } catch (err) {
      console.error("Failed to close project:", err);
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
  const handleSelectCategory = (id: string) => {
    setViewState({ view: "secrets", categoryId: id });
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

  const handleOpenSettings = () => {
    setViewState({ view: "settings" });
  };

  const handleLockVault = async () => {
    try {
      await api.lockVault();
      setScreen("login");
    } catch (err) {
      console.error("Failed to lock vault:", err);
    }
  };

  const handleCreateNote = async (category: string) => {
    if (!activeProjectId) return;
    try {
      const note = await api.createNote(activeProjectId, "Untitled", category);
      setNotes((prev) => [...prev, note]);
      setViewState({ view: "note", noteId: note.id });
    } catch (err) {
      console.error("Failed to create note:", err);
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

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base">
      {/* Tab Bar */}
      <TabBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onCloseProject={handleCloseProject}
        onRenameProject={handleRenameProject}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          categories={categories}
          notes={notes}
          fileFolders={fileFolders}
          activeCategoryId={activeCategoryId}
          activeNoteId={activeNoteId}
          activeFolderId={activeFolderId}
          availableTemplates={availableTemplates}
          availableFileFolderTemplates={availableFileFolderTemplates}
          onSelectCategory={handleSelectCategory}
          onSelectNote={handleSelectNote}
          onSelectFileFolder={handleSelectFileFolder}
          onAddSection={handleAddSection}
          onAddFileFolder={handleAddFileFolder}
          onCreateNote={handleCreateNote}
          onOpenSettings={handleOpenSettings}
          isSettingsActive={viewState?.view === "settings"}
        />

        {/* Content Area */}
        {viewState?.view === "secrets" && activeCategory && (
          <SecretListView
            categoryId={activeCategory.id}
            categoryName={activeCategory.name}
          />
        )}
        {viewState?.view === "note" && activeNoteId && (() => {
          const note = notes.find((n) => n.id === activeNoteId);
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
        {viewState?.view === "settings" && (
          <SettingsView
            bluetoothStatus={bluetooth.status}
            activeThemeId={activeThemeId}
            onThemeChange={handleThemeChange}
            onScanDevices={bluetooth.scanDevices}
            onPairDevice={bluetooth.pairDevice}
            onUnpairDevice={bluetooth.unpairDevice}
            onLockVault={handleLockVault}
          />
        )}
        {!viewState && (
          <div className="flex flex-1 items-center justify-center text-text-muted">
            Select a category or note from the sidebar
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        bluetoothStatus={bluetooth.status}
        bluetoothDevice=""
        lockCountdown={bluetooth.countdown}
      />

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
