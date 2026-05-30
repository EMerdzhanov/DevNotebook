import { useState } from "react";
import type { Note } from "../types";
import * as api from "../hooks/useTauri";
import ConfirmDialog from "./ConfirmDialog";

interface NoteListViewProps {
  folderId: string;
  folderName: string;
  projectId: string;
  notes: Note[];
  onSelectNote: (id: string) => void;
  onNotesChanged: () => void;
}

export default function NoteListView({
  folderId,
  folderName,
  projectId,
  notes,
  onSelectNote,
  onNotesChanged,
}: NoteListViewProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreateNote = async () => {
    try {
      const note = await api.createNote(folderId, projectId, "Untitled");
      onNotesChanged();
      onSelectNote(note.id);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await api.deleteNote(id);
      onNotesChanged();
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-medium text-text-primary">{folderName}</h3>
        <button
          className="rounded border border-accent bg-bg-input px-3.5 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent hover:text-bg-base"
          onClick={handleCreateNote}
        >
          + New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          No notes yet. Click &quot;+ New Note&quot; to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group flex cursor-pointer items-center justify-between rounded-md border border-border bg-bg-card p-4 transition-colors hover:border-accent/50"
              onClick={() => onSelectNote(note.id)}
            >
              <div>
                <div className="text-[14px] text-text-primary">
                  {note.title || "Untitled"}
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {new Date(note.updated_at).toLocaleDateString()} · {new Date(note.updated_at).toLocaleTimeString()}
                </div>
              </div>
              <button
                className="rounded bg-bg-input px-2.5 py-1 text-[11px] text-status-disconnected opacity-0 transition-opacity hover:bg-status-disconnected hover:text-white group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(note.id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Note"
        message="Are you sure you want to delete this note? It will be moved to Trash."
        onConfirm={() => {
          if (deleteConfirm) handleDeleteNote(deleteConfirm);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
