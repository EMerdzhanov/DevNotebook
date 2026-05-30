import { useState, useEffect, useCallback, useRef } from "react";
import type { Todo } from "../types";
import * as api from "../hooks/useTauri";

interface TodoPanelProps {
  projectId: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-status-disconnected",
  medium: "text-status-warning",
  low: "text-status-connected",
};

const PRIORITY_DOTS: Record<string, string> = {
  high: "bg-status-disconnected",
  medium: "bg-status-warning",
  low: "bg-status-connected",
};

export default function TodoPanel({ projectId, isOpen, onToggle }: TodoPanelProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [panelWidth, setPanelWidth] = useState(350);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Dragging left increases width, dragging right decreases
      const newWidth = Math.max(250, Math.min(600, startWidth - (e.clientX - startX)));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  const loadTodos = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getTodos(projectId);
      setTodos(data);
    } catch (err) {
      console.error("Failed to load todos:", err);
    }
  }, [projectId]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleAdd = async () => {
    if (!projectId || !newTitle.trim()) return;
    try {
      await api.createTodo(projectId, newTitle.trim(), newDesc.trim(), newUrl.trim(), newPriority, "");
      setNewTitle("");
      setNewDesc("");
      setNewUrl("");
      setNewPriority("medium");
      await loadTodos();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to create todo:", err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleTodo(id);
      await loadTodos();
    } catch (err) {
      console.error("Failed to toggle todo:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTodo(id);
      if (expandedId === id) setExpandedId(null);
      await loadTodos();
    } catch (err) {
      console.error("Failed to delete todo:", err);
    }
  };

  const handleClearCompleted = async () => {
    if (!projectId) return;
    try {
      await api.clearCompletedTodos(projectId);
      await loadTodos();
    } catch (err) {
      console.error("Failed to clear completed:", err);
    }
  };

  const pending = todos.filter((t) => !t.is_completed);
  const completed = todos.filter((t) => t.is_completed);

  // Collapsed tab
  if (!isOpen) {
    return (
      <button
        className="flex w-11 flex-col items-center border-l border-border-subtle bg-bg-sidebar py-4"
        onClick={onToggle}
        title="Open To Do list"
      >
        <span className="text-[12px] text-accent">&lsaquo;</span>
        <span
          className="mt-3 text-[10px] font-medium uppercase tracking-widest text-accent"
          style={{ writingMode: "vertical-rl" }}
        >
          To Do
        </span>
        {pending.length > 0 && (
          <span className="mt-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg-base">
            {pending.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="relative flex flex-col border-l border-border-subtle bg-bg-sidebar"
      style={{ width: panelWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
            To Do
          </span>
          {pending.length > 0 && (
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {pending.length}
            </span>
          )}
        </div>
        <button
          className="text-[12px] text-accent hover:text-accent/80"
          onClick={onToggle}
          title="Collapse"
        >
          &rsaquo;
        </button>
      </div>

      {/* Add todo */}
      <div className="border-b border-border-subtle px-3 py-2.5">
        <div className="flex items-start gap-1.5">
          <div className="flex-1">
            <input
              ref={inputRef}
              className="w-full rounded border border-border bg-bg-input px-2.5 py-1.5 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) handleAdd();
              }}
              placeholder="Task title..."
            />
            <textarea
              className="mt-1.5 w-full rounded border border-border bg-bg-input px-2.5 py-1.5 text-[12px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
            />
            <input
              className="mt-1.5 w-full rounded border border-border bg-bg-input px-2.5 py-1.5 text-[12px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Link (optional)"
            />
          </div>
          <button
            className="mt-0.5 rounded bg-accent px-2 py-1.5 text-[11px] font-medium text-bg-base hover:opacity-90 disabled:opacity-40"
            onClick={handleAdd}
            disabled={!newTitle.trim()}
          >
            +
          </button>
        </div>
        <div className="mt-1.5 flex gap-1">
          {(["low", "medium", "high"] as const).map((p) => (
            <button
              key={p}
              className={`rounded px-2 py-0.5 text-[10px] capitalize transition-colors ${
                newPriority === p
                  ? `${PRIORITY_COLORS[p]} bg-bg-input font-medium`
                  : "text-text-dim hover:text-text-secondary"
              }`}
              onClick={() => setNewPriority(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto">
        {pending.length === 0 && completed.length === 0 && (
          <div className="px-3 py-8 text-center text-[12px] text-text-dim">
            No tasks yet
          </div>
        )}

        {pending.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            isExpanded={expandedId === todo.id}
            onToggleExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
            onToggleComplete={() => handleToggle(todo.id)}
            onDelete={() => handleDelete(todo.id)}
            onUpdate={loadTodos}
          />
        ))}

        {completed.length > 0 && (
          <>
            <div className="mt-2 flex items-center justify-between px-3 py-2">
              <button
                className="text-[10px] text-text-dim hover:text-text-secondary"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? "▾" : "▸"} Completed ({completed.length})
              </button>
              <button
                className="text-[10px] text-text-dim hover:text-status-disconnected"
                onClick={handleClearCompleted}
              >
                Clear
              </button>
            </div>
            {showCompleted &&
              completed.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  isExpanded={expandedId === todo.id}
                  onToggleExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                  onToggleComplete={() => handleToggle(todo.id)}
                  onDelete={() => handleDelete(todo.id)}
                  onUpdate={loadTodos}
                />
              ))}
          </>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

// ── Todo Item ──

function TodoItem({
  todo,
  isExpanded,
  onToggleExpand,
  onToggleComplete,
  onDelete,
  onUpdate,
}: {
  todo: Todo;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDesc, setEditDesc] = useState(todo.description);
  const [editUrl, setEditUrl] = useState(todo.url);
  const [editingUrl, setEditingUrl] = useState(false);
  const [editPriority, setEditPriority] = useState(todo.priority);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset edit state when todo changes
  useEffect(() => {
    setEditTitle(todo.title);
    setEditDesc(todo.description);
    setEditUrl(todo.url);
    setEditPriority(todo.priority);
  }, [todo.id, todo.title, todo.description, todo.url, todo.priority]);

  const autoSave = useCallback(
    (title: string, description: string, url: string, priority: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.updateTodo(todo.id, title, description, url, priority, todo.due_date);
          onUpdate();
        } catch (err) {
          console.error("Failed to save todo:", err);
        }
      }, 600);
    },
    [todo.id, todo.due_date, onUpdate],
  );

  const hasDetails = todo.description || todo.url;

  return (
    <div className="group border-b border-border-subtle/50">
      {/* Main row */}
      <div className="flex items-start gap-2 px-3 py-2 hover:bg-bg-card/50">
        {/* Checkbox */}
        <button
          className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            todo.is_completed
              ? "border-accent bg-accent text-bg-base"
              : "border-text-dim hover:border-accent"
          }`}
          onClick={onToggleComplete}
        >
          {todo.is_completed && <span className="text-[10px]">✓</span>}
        </button>

        {/* Title + meta */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onToggleExpand}
        >
          <div
            className={`text-[14px] leading-snug ${
              todo.is_completed
                ? "text-text-dim line-through"
                : "text-text-primary"
            }`}
          >
            {todo.title}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORITY_DOTS[todo.priority] || PRIORITY_DOTS.medium}`} />
            <span className={`text-[9px] capitalize ${PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.medium}`}>
              {todo.priority}
            </span>
            {hasDetails && (
              <span className="text-[9px] text-text-dim">•••</span>
            )}
            {todo.url && (
              <a
                href={todo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                🔗
              </a>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          className="mt-0.5 flex-shrink-0 text-[10px] text-text-dim opacity-0 transition-opacity hover:text-status-disconnected group-hover:opacity-100"
          onClick={onDelete}
        >
          ×
        </button>
      </div>

      {/* Expanded detail view */}
      {isExpanded && (
        <div className="bg-bg-card/30 px-3 pb-3 pt-1">
          {/* Editable title */}
          <input
            className="mb-2 w-full border-none bg-transparent text-[14px] font-medium text-text-primary outline-none"
            value={editTitle}
            onChange={(e) => {
              setEditTitle(e.target.value);
              autoSave(e.target.value, editDesc, editUrl, editPriority);
            }}
          />

          {/* Description */}
          <textarea
            className="mb-2 w-full rounded border border-border bg-bg-input px-2.5 py-1.5 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
            value={editDesc}
            onChange={(e) => {
              setEditDesc(e.target.value);
              autoSave(editTitle, e.target.value, editUrl, editPriority);
            }}
            placeholder="Add description..."
            rows={3}
          />

          {/* URL */}
          {editingUrl ? (
            <div className="mb-2 flex items-center gap-1.5">
              <input
                className="flex-1 rounded border border-accent bg-bg-input px-2.5 py-1.5 text-[13px] text-text-primary outline-none"
                value={editUrl}
                onChange={(e) => {
                  setEditUrl(e.target.value);
                  autoSave(editTitle, editDesc, e.target.value, editPriority);
                }}
                onBlur={() => setEditingUrl(false)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingUrl(false); }}
                placeholder="https://..."
                autoFocus
              />
            </div>
          ) : editUrl ? (
            <div className="mb-2 flex items-center gap-2 rounded border border-border bg-bg-input px-2.5 py-1.5">
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-[12px] text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {editUrl}
              </a>
              <button
                className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                onClick={() => navigator.clipboard.writeText(editUrl)}
              >
                Copy
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-accent"
                onClick={() => setEditingUrl(true)}
              >
                Edit
              </button>
            </div>
          ) : (
            <button
              className="mb-2 w-full rounded border border-dashed border-border px-2.5 py-1.5 text-left text-[12px] text-text-dim hover:border-accent hover:text-accent"
              onClick={() => setEditingUrl(true)}
            >
              + Add link
            </button>
          )}

          {/* Priority */}
          <div className="flex gap-1">
            {(["low", "medium", "high"] as const).map((p) => (
              <button
                key={p}
                className={`rounded px-2 py-0.5 text-[10px] capitalize transition-colors ${
                  editPriority === p
                    ? `${PRIORITY_COLORS[p]} bg-bg-input font-medium`
                    : "text-text-dim hover:text-text-secondary"
                }`}
                onClick={() => {
                  setEditPriority(p);
                  autoSave(editTitle, editDesc, editUrl, p);
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
