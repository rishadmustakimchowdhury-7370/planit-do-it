import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StructuredRecruiterNotes } from "@/lib/recruiterNotes";

interface Props {
  value: StructuredRecruiterNotes;
  onChange: (next: StructuredRecruiterNotes) => void;
}

export function StructuredRecruiterNotesForm({ value, onChange }: Props) {
  const set = <K extends keyof StructuredRecruiterNotes>(k: K, v: StructuredRecruiterNotes[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Notice period">
          <Input value={value.notice_period ?? ""} onChange={(e) => set("notice_period", e.target.value)} placeholder="e.g. 30 days" />
        </Field>
        <Field label="Availability">
          <Input value={value.availability ?? ""} onChange={(e) => set("availability", e.target.value)} placeholder="Immediate / from 1 Aug" />
        </Field>
        <Field label="Current salary">
          <Input value={value.current_salary ?? ""} onChange={(e) => set("current_salary", e.target.value)} placeholder="$120k base" />
        </Field>
        <Field label="Salary expectation">
          <Input value={value.salary_expectation ?? ""} onChange={(e) => set("salary_expectation", e.target.value)} placeholder="$150k OTE" />
        </Field>
        <Field label="Relocation">
          <Input value={value.relocation ?? ""} onChange={(e) => set("relocation", e.target.value)} placeholder="Open to UAE / Singapore" />
        </Field>
        <Field label="Visa status">
          <Input value={value.visa_status ?? ""} onChange={(e) => set("visa_status", e.target.value)} placeholder="UK ILR · no sponsorship needed" />
        </Field>
        <Field label="Communication">
          <Select value={value.communication_quality || "_unset"} onValueChange={(v) => set("communication_quality", v === "_unset" ? "" : v as any)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_unset">—</SelectItem>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="strong">Strong</SelectItem>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="needs_work">Needs work</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Client-facing">
          <Select value={value.client_facing_ability || "_unset"} onValueChange={(v) => set("client_facing_ability", v === "_unset" ? "" : v as any)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_unset">—</SelectItem>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="strong">Strong</SelectItem>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="limited">Limited</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Interview feedback">
        <Textarea
          rows={3}
          value={value.interview_feedback ?? ""}
          onChange={(e) => set("interview_feedback", e.target.value)}
          placeholder="Notes from the screening call — what stood out, any concerns…"
        />
      </Field>

      <Field label="Other screening notes (one per line)">
        <Textarea
          rows={3}
          value={(value.other_notes ?? []).join("\n")}
          onChange={(e) => set("other_notes", e.target.value.split("\n"))}
          placeholder={"Worked with international stakeholders\nLed a 15-person team in last role"}
        />
      </Field>

      <p className="text-[11px] text-muted-foreground">
        These notes feed the AI assessment and appear on the executive report. Rebuild the pack after changes.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
