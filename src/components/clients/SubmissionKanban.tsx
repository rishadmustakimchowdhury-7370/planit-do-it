import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { SUBMISSION_STATUS_META, type SubmissionStatus } from "./SubmissionStatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { MoreVertical, ExternalLink, Mail, Trophy, Activity, UserCircle2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MarkAsPlacementDialog } from "@/components/placements/MarkAsPlacementDialog";

const COLUMNS: SubmissionStatus[] = [
  "submitted","viewed","screening","interview_requested","interview_confirmed",
  "final_review","offer","hired","rejected",
];

export interface KanbanRow {
  id: string;
  status: SubmissionStatus;
  last_activity_at: string;
  submitted_at?: string | null;
  candidate?: { id?: string; full_name?: string | null; current_title?: string | null; email?: string | null } | null;
  job?: { id?: string; title?: string | null } | null;
  client_org?: { id?: string; name?: string | null } | null;
  recruiter_name?: string | null;
}

interface Props {
  rows: KanbanRow[];
  onMove: (id: string, to: SubmissionStatus) => void;
  onOpen: (id: string) => void;
  onSendEmail?: (row: KanbanRow) => void;
  onPlacementCreated?: () => void;
}

export function SubmissionKanban({ rows, onMove, onOpen, onSendEmail, onPlacementCreated }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [placementFor, setPlacementFor] = useState<KanbanRow | null>(null);

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
    <>
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((s) => (
            <Column
              key={s}
              status={s}
              items={byStatus[s] ?? []}
              onOpen={onOpen}
              onSendEmail={onSendEmail}
              onMarkPlacement={(row) => setPlacementFor(row)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeRow ? <CardView row={activeRow} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {placementFor && (
        <MarkAsPlacementDialog
          open={!!placementFor}
          onOpenChange={(v) => !v && setPlacementFor(null)}
          defaultCandidateId={placementFor.candidate?.id}
          defaultJobId={placementFor.job?.id}
          onSuccess={() => { setPlacementFor(null); onPlacementCreated?.(); }}
        />
      )}
    </>
  );
}

function Column({
  status, items, onOpen, onSendEmail, onMarkPlacement,
}: {
  status: SubmissionStatus;
  items: KanbanRow[];
  onOpen: (id: string) => void;
  onSendEmail?: (row: KanbanRow) => void;
  onMarkPlacement: (row: KanbanRow) => void;
}) {
  const meta = SUBMISSION_STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 rounded-lg border bg-muted/30 p-2 ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px]">
        {items.map(r => (
          <Draggable
            key={r.id}
            row={r}
            onOpen={onOpen}
            onSendEmail={onSendEmail}
            onMarkPlacement={onMarkPlacement}
          />
        ))}
        {items.length === 0 && <div className="text-[11px] text-muted-foreground/60 px-2 py-4 text-center">Drop here</div>}
      </div>
    </div>
  );
}

function Draggable({
  row, onOpen, onSendEmail, onMarkPlacement,
}: {
  row: KanbanRow;
  onOpen: (id: string) => void;
  onSendEmail?: (row: KanbanRow) => void;
  onMarkPlacement: (row: KanbanRow) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      className={`relative group ${isDragging ? "opacity-30" : ""}`}
    >
      <div
        {...listeners}
        {...attributes}
        onClick={() => onOpen(row.id)}
        className="cursor-grab active:cursor-grabbing"
      >
        <CardView row={row} />
      </div>
      <div className="absolute top-1.5 right-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onOpen(row.id)}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open submission
            </DropdownMenuItem>
            {row.candidate?.id && (
              <DropdownMenuItem asChild>
                <a href={`/candidates/${row.candidate.id}`}>
                  <UserCircle2 className="h-3.5 w-3.5 mr-2" /> Open candidate
                </a>
              </DropdownMenuItem>
            )}
            {onSendEmail && (
              <DropdownMenuItem onClick={() => onSendEmail(row)} disabled={!row.candidate?.email}>
                <Mail className="h-3.5 w-3.5 mr-2" /> Send follow-up email
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onOpen(row.id)}>
              <Activity className="h-3.5 w-3.5 mr-2" /> View activity timeline
            </DropdownMenuItem>
            {row.status === "hired" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMarkPlacement(row)}>
                  <Trophy className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Mark as placement
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function CardView({ row, dragging }: { row: KanbanRow; dragging?: boolean }) {
  const name = row.candidate?.full_name || "Unknown candidate";
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const submittedAt = row.submitted_at ?? row.last_activity_at;
  return (
    <div className={`rounded-md border bg-card p-3 pr-8 shadow-sm hover:border-primary/40 transition-colors ${dragging ? "rotate-1 shadow-lg" : ""}`}>
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
        {row.recruiter_name && (
          <div className="truncate">Recruiter: <span className="text-foreground/80">{row.recruiter_name}</span></div>
        )}
        {submittedAt && (
          <div>Submitted {format(new Date(submittedAt), "MMM d, yyyy")}</div>
        )}
        <div>Last activity {formatDistanceToNow(new Date(row.last_activity_at), { addSuffix: true })}</div>
      </div>
    </div>
  );
}
