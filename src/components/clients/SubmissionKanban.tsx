import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { SUBMISSION_STATUS_META, type SubmissionStatus } from "./SubmissionStatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const COLUMNS: SubmissionStatus[] = [
  "submitted","viewed","screening","interview_requested","interview_confirmed",
  "final_review","offer","hired","rejected","withdrawn",
];

export interface KanbanRow {
  id: string;
  status: SubmissionStatus;
  last_activity_at: string;
  candidate?: { full_name?: string | null; current_title?: string | null } | null;
  job?: { title?: string | null } | null;
  client_org?: { name?: string | null } | null;
}

interface Props {
  rows: KanbanRow[];
  onMove: (id: string, to: SubmissionStatus) => void;
  onOpen: (id: string) => void;
}

export function SubmissionKanban({ rows, onMove, onOpen }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<SubmissionStatus, KanbanRow[]> = {} as any;
    COLUMNS.forEach(s => { map[s] = []; });
    for (const r of rows) {
      if (!map[r.status]) map[r.status] = [];
      map[r.status].push(r);
    }
    return map;
  }, [rows]);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = e.active.id as string;
    const over = e.over?.id as string | undefined;
    if (!over) return;
    const row = rows.find(r => r.id === id);
    if (!row || row.status === over) return;
    onMove(id, over as SubmissionStatus);
  };

  const activeRow = activeId ? rows.find(r => r.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {COLUMNS.map((s) => (
          <Column key={s} status={s} items={byStatus[s] ?? []} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>
        {activeRow ? <CardView row={activeRow} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, items, onOpen }: { status: SubmissionStatus; items: KanbanRow[]; onOpen: (id: string) => void }) {
  const meta = SUBMISSION_STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 rounded-lg border bg-muted/30 p-2 ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px]">
        {items.map(r => <Draggable key={r.id} row={r} onOpen={onOpen} />)}
        {items.length === 0 && <div className="text-[11px] text-muted-foreground/60 px-2 py-4 text-center">Drop here</div>}
      </div>
    </div>
  );
}

function Draggable({ row, onOpen }: { row: KanbanRow; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(row.id)}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <CardView row={row} />
    </div>
  );
}

function CardView({ row, dragging }: { row: KanbanRow; dragging?: boolean }) {
  const name = row.candidate?.full_name || "Unknown candidate";
  const initials = name.split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase();
  return (
    <div className={`rounded-md border bg-card p-3 shadow-sm hover:border-primary/40 transition-colors ${dragging ? "rotate-1 shadow-lg" : ""}`}>
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-[10px]">{initials}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{row.candidate?.current_title || "—"}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
        <div className="truncate"><span className="text-foreground/80">{row.job?.title || "—"}</span></div>
        <div className="truncate">{row.client_org?.name || "—"}</div>
        <div>Updated {formatDistanceToNow(new Date(row.last_activity_at), { addSuffix: true })}</div>
      </div>
    </div>
  );
}
