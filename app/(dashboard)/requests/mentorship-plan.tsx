"use client";

import { useActionState, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Circle, CircleCheck, CircleDot, Clock, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusMessage } from "@/components/ui/status-message";
import {
  EXAMPLE_OBJECTIVES,
  MAX_MILESTONES,
  MAX_OBJECTIVES,
  PLAN_TEXT_MAX,
  PLAN_TEXT_MIN,
  STATUS_LABEL,
  formatPlanDate,
  formatPlanTimestamp,
  milestoneStatus,
  progressText,
  summariseObjective,
  summarisePlan,
  type MilestoneStatus,
  type ObjectiveStatus,
  type PlanMilestone,
  type PlanObjective,
} from "@/lib/mentorship-plan";
import { mentorshipPlanAction, type PlanActionState, type PlanIntent } from "./plan-actions";

const INITIAL: PlanActionState = {
  ok: false, error: null, message: null, intent: null, targetId: null, title: "", targetDate: "", nonce: 0,
};

type Status = MilestoneStatus | ObjectiveStatus;

const STATUS_TONE: Record<Status, "success" | "warning" | "info" | "neutral"> = {
  done: "success", met: "success", overdue: "warning", due_soon: "info", on_track: "neutral", no_milestones: "neutral",
};
const STATUS_ICON: Record<Status, typeof Circle> = {
  done: CircleCheck, met: CircleCheck, overdue: TriangleAlert, due_soon: Clock, on_track: CircleDot, no_milestones: Circle,
};

/** Status as an icon and words, so it never depends on colour alone. */
function StatusBadge({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]} className="shrink-0">
      <Icon className="size-3.5" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function ProgressBar({ percent, label, text }: { percent: number; label: string; text: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={text}
      className="h-2.5 w-full overflow-hidden rounded-full border border-input bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function PlanFields({ intent, targetId }: { intent: PlanIntent; targetId: string }) {
  return (
    <>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="target_id" value={targetId} />
    </>
  );
}

interface PlanForm {
  dispatch: (formData: FormData) => void;
  pending: boolean;
  /** What the member typed into a form that failed, so it is not lost. */
  retained: (intent: PlanIntent, targetId: string) => PlanActionState | null;
}

/** Remounts a field only when its own form failed, so it shows what was typed. */
function fieldKey(kept: PlanActionState | null, name: string): string {
  return kept ? `${name}-${kept.nonce}` : name;
}

/** Forms with their own fields show their errors beside them. */
const FIELD_INTENTS: PlanIntent[] = ["add_objective", "rename_objective", "add_milestone", "edit_milestone"];

/**
 * A button that stays focusable while a save is pending: aria-disabled and an
 * ignored click instead of disabled, which would drop keyboard focus.
 */
function PlanButton({ pending, onClick, className, ...props }: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button
      {...props}
      aria-disabled={pending || undefined}
      className={`aria-disabled:opacity-60 ${className ?? ""}`}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}

function FieldError({ id, kept }: { id: string; kept: PlanActionState | null }) {
  if (!kept?.error) return null;
  return <p id={id} role="alert" className="text-xs font-medium text-destructive">{kept.error}</p>;
}

/** Moves focus back into a field after its save failed and it was remounted. */
function useFocusOnFailure(kept: PlanActionState | null) {
  const ref = useRef<HTMLInputElement>(null);
  const failure = kept?.nonce;
  useEffect(() => {
    if (failure) ref.current?.focus();
  }, [failure]);
  return ref;
}

const fieldProps = (kept: PlanActionState | null, errorId: string) =>
  kept ? { "aria-invalid": true as const, "aria-describedby": errorId } : {};

interface MentorshipPlanProps {
  connectionId: string;
  objectives: PlanObjective[];
  partnerName: string;
  viewerId: string;
  /** Today's Nairobi date (YYYY-MM-DD), worked out on the server. */
  today: string;
}

/** Objectives, milestones and progress against the plan, shared by the Mentee and Mentor (#187). */
export function MentorshipPlan({ connectionId, objectives, partnerName, viewerId, today }: MentorshipPlanProps) {
  const [state, dispatch, pending] = useActionState(mentorshipPlanAction, INITIAL);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [seenNonce, setSeenNonce] = useState(state.nonce);
  const returnFocusTo = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const baseId = useId();

  // A successful save closes its own editor or removal prompt, and no other.
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    if (state.ok && state.intent === "rename_objective" && editing === `objective:${state.targetId}`) setEditing(null);
    if (state.ok && state.intent === "edit_milestone" && editing === `milestone:${state.targetId}`) setEditing(null);
    if (state.ok && state.intent === "delete_objective" && confirming === state.targetId) setConfirming(null);
  }

  // Closing an editor returns focus to its Edit button; a removal moves focus
  // to the plan heading because the removed item's controls are gone.
  useEffect(() => {
    if (editing === null && returnFocusTo.current) {
      document.getElementById(returnFocusTo.current)?.focus();
      returnFocusTo.current = null;
    }
  }, [editing]);
  useEffect(() => {
    if (state.ok && (state.intent === "delete_objective" || state.intent === "delete_milestone")) {
      headingRef.current?.focus();
    }
  }, [state.nonce, state.ok, state.intent]);

  const form: PlanForm = {
    dispatch,
    pending,
    retained: (intent, targetId) => (state.error && state.intent === intent && state.targetId === targetId ? state : null),
  };
  const openEditor = (key: string, buttonId: string) => {
    returnFocusTo.current = buttonId;
    setConfirming(null);
    setEditing(key);
  };
  const closeEditor = () => setEditing(null);

  const summary = summarisePlan(objectives, today);
  const headingId = `${baseId}-heading`;
  const nameFor = (userId: string | null) => (userId === viewerId ? "you" : userId ? partnerName : null);

  return (
    <section aria-labelledby={headingId} className="grid gap-3 rounded-md border p-3">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 id={headingId} ref={headingRef} tabIndex={-1} className="text-sm font-medium">Mentorship plan</h4>
          {summary.objectives > 0 && (
            <p className="text-xs text-muted-foreground">
              {summary.objectivesMet} of {summary.objectives} {summary.objectives === 1 ? "objective" : "objectives"} met
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Agreed objectives and milestones for you and {partnerName}. Only the two of you can see or change them.
        </p>
      </div>

      {summary.total > 0 && (
        <div className="grid gap-1.5">
          <ProgressBar
            percent={summary.percent}
            label="Overall plan progress"
            text={`${progressText(summary.done, summary.total)}, ${summary.percent}%`}
          />
          <p className="text-sm">
            <span className="font-medium">{progressText(summary.done, summary.total)}</span>
            {summary.overdue > 0 && <span>, {summary.overdue} overdue</span>}
            {summary.dueSoon > 0 && <span>, {summary.dueSoon} due soon</span>}
          </p>
        </div>
      )}

      {objectives.length === 0 ? (
        <EmptyPlan connectionId={connectionId} partnerName={partnerName} form={form} />
      ) : (
        <ul className="grid gap-3">
          {objectives.map((objective) => (
            <ObjectiveItem
              key={objective.id}
              objective={objective}
              today={today}
              form={form}
              editing={editing}
              confirming={confirming === objective.id}
              onEdit={openEditor}
              onCloseEditor={closeEditor}
              onConfirm={(confirm) => setConfirming(confirm ? objective.id : null)}
              nameFor={nameFor}
            />
          ))}
        </ul>
      )}

      {objectives.length < MAX_OBJECTIVES ? (
        <AddObjectiveForm connectionId={connectionId} form={form} first={objectives.length === 0} />
      ) : (
        <p className="text-xs text-muted-foreground">This plan holds the most objectives it can ({MAX_OBJECTIVES}). Remove one to add another.</p>
      )}

      <p role="status" className="sr-only">
        {pending ? "Saving the mentorship plan." : state.ok ? state.message : ""}
      </p>
      {state.error && !pending && !(state.intent && FIELD_INTENTS.includes(state.intent)) && (
        <StatusMessage tone="error">{state.error}</StatusMessage>
      )}
    </section>
  );
}

function EmptyPlan({ connectionId, partnerName, form }: { connectionId: string; partnerName: string; form: PlanForm }) {
  return (
    <div className="grid gap-2 rounded-md bg-muted/50 p-3">
      <p className="text-sm font-medium">Start your plan together</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Agree two or three objectives with {partnerName}, then break each into milestones with target dates.
        You will both see the same plan and how progress compares with it.
      </p>
      <p className="text-xs font-medium">Start from an example</p>
      <ul className="flex flex-wrap gap-2">
        {EXAMPLE_OBJECTIVES.map((example) => (
          <li key={example}>
            <form action={form.dispatch}>
              <PlanFields intent="add_objective" targetId={connectionId} />
              <input type="hidden" name="title" value={example} />
              <PlanButton type="submit" variant="outline" size="sm" pending={form.pending} className="h-auto whitespace-normal py-2 text-left">
                <Plus aria-hidden="true" />
                <span><span className="sr-only">Add example objective: </span>{example}</span>
              </PlanButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddObjectiveForm({ connectionId, form, first }: { connectionId: string; form: PlanForm; first: boolean }) {
  const inputId = useId();
  const errorId = useId();
  const kept = form.retained("add_objective", connectionId);
  const ref = useFocusOnFailure(kept);
  return (
    <form action={form.dispatch} className="grid gap-1.5">
      <PlanFields intent="add_objective" targetId={connectionId} />
      <Label htmlFor={inputId} className="text-xs font-medium">
        {first ? "Or write your own objective" : "Add another objective"}
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          ref={ref}
          id={inputId}
          name="title"
          key={fieldKey(kept, "objective")}
          {...fieldProps(kept, errorId)}
          defaultValue={kept?.title ?? ""}
          required
          minLength={PLAN_TEXT_MIN}
          maxLength={PLAN_TEXT_MAX}
          placeholder="For example, prepare for a first management role"
          className="h-9 min-w-0 flex-1 basis-56 text-sm"
        />
        <PlanButton type="submit" size="sm" pending={form.pending}>
          <Plus aria-hidden="true" />
          Add objective
        </PlanButton>
      </div>
      <FieldError id={errorId} kept={kept} />
      <p className="text-[11px] text-muted-foreground">
        {PLAN_TEXT_MIN} to {PLAN_TEXT_MAX} characters. A plan can hold up to {MAX_OBJECTIVES} objectives.
      </p>
    </form>
  );
}

interface ObjectiveItemProps {
  objective: PlanObjective;
  today: string;
  form: PlanForm;
  editing: string | null;
  confirming: boolean;
  onEdit: (key: string, buttonId: string) => void;
  onCloseEditor: () => void;
  onConfirm: (confirm: boolean) => void;
  nameFor: (userId: string | null) => string | null;
}

function ObjectiveItem({ objective, today, form, editing, confirming, onEdit, onCloseEditor, onConfirm, nameFor }: ObjectiveItemProps) {
  const summary = summariseObjective(objective, today);
  const editButtonId = useId();
  const removeButtonId = useId();
  const isEditing = editing === `objective:${objective.id}`;
  const count = objective.milestones.length;

  return (
    <li className="grid gap-3 rounded-md border bg-card p-3">
      {isEditing ? (
        <TitleEditor
          intent="rename_objective"
          targetId={objective.id}
          label="Objective"
          value={objective.title}
          form={form}
          onCancel={onCloseEditor}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h5 className="min-w-0 flex-1 basis-40 break-words text-sm font-medium">{objective.title}</h5>
          <StatusBadge status={summary.status} />
        </div>
      )}

      {summary.total > 0 ? (
        <div className="grid gap-1.5">
          <ProgressBar
            percent={summary.percent}
            label={`Progress on ${objective.title}`}
            text={`${progressText(summary.done, summary.total)}, ${summary.percent}%`}
          />
          <p className="text-xs">{progressText(summary.done, summary.total)}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Add the first milestone below to start tracking this objective.</p>
      )}

      {count > 0 && (
        <ul className="grid gap-2" aria-label={`Milestones for ${objective.title}`}>
          {objective.milestones.map((milestone) => (
            <MilestoneItem
              key={milestone.id}
              milestone={milestone}
              status={milestoneStatus(milestone, today)}
              form={form}
              isEditing={editing === `milestone:${milestone.id}`}
              onEdit={onEdit}
              onCloseEditor={onCloseEditor}
              doneBy={nameFor(milestone.completed_by)}
            />
          ))}
        </ul>
      )}

      {count < MAX_MILESTONES ? (
        <AddMilestoneForm objectiveId={objective.id} form={form} />
      ) : (
        <p className="text-xs text-muted-foreground">This objective holds the most milestones it can ({MAX_MILESTONES}).</p>
      )}

      {confirming ? (
        <ConfirmRemoval
          objective={objective}
          form={form}
          onKeep={() => {
            onConfirm(false);
            // The Remove button returns after this render; give it focus back.
            requestAnimationFrame(() => document.getElementById(removeButtonId)?.focus());
          }}
        />
      ) : !isEditing && (
        <div className="flex flex-wrap gap-1">
          <PlanButton id={editButtonId} type="button" variant="ghost" size="xs" pending={form.pending} onClick={() => onEdit(`objective:${objective.id}`, editButtonId)}>
            <Pencil aria-hidden="true" />
            Edit<span className="sr-only"> objective {objective.title}</span>
          </PlanButton>
          <PlanButton id={removeButtonId} type="button" variant="ghost" size="xs" pending={form.pending} onClick={() => onConfirm(true)}>
            <Trash2 aria-hidden="true" />
            Remove<span className="sr-only"> objective {objective.title}</span>
          </PlanButton>
        </div>
      )}
    </li>
  );
}

/** Asks before removing an objective and its milestones; focus starts on the choice. */
function ConfirmRemoval({ objective, form, onKeep }: { objective: PlanObjective; form: PlanForm; onKeep: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const count = objective.milestones.length;
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  return (
    <div
      className="grid gap-2 rounded-md border border-input p-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onKeep();
        }
      }}
    >
      <p className="text-xs">
        Remove this objective{count > 0 ? ` and its ${count} ${count === 1 ? "milestone" : "milestones"}` : ""}? This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={form.dispatch}>
          <PlanFields intent="delete_objective" targetId={objective.id} />
          <PlanButton ref={confirmRef} type="submit" variant="destructive" size="xs" pending={form.pending}>
            <Trash2 aria-hidden="true" />
            Remove objective<span className="sr-only"> {objective.title}</span>
          </PlanButton>
        </form>
        <Button type="button" variant="ghost" size="xs" onClick={onKeep}>Keep it</Button>
      </div>
    </div>
  );
}

interface MilestoneItemProps {
  milestone: PlanMilestone;
  status: MilestoneStatus;
  form: PlanForm;
  isEditing: boolean;
  onEdit: (key: string, buttonId: string) => void;
  onCloseEditor: () => void;
  doneBy: string | null;
}

function MilestoneItem({ milestone, status, form, isEditing, onEdit, onCloseEditor, doneBy }: MilestoneItemProps) {
  const editButtonId = useId();
  const done = status === "done";
  return (
    <li className="flex items-start gap-2">
      <form action={form.dispatch}>
        <PlanFields intent="set_milestone_done" targetId={milestone.id} />
        <input type="hidden" name="done" value={done ? "false" : "true"} />
        <PlanButton type="submit" variant="outline" size="icon" pending={form.pending}>
          {done ? <CircleCheck className="size-5" aria-hidden="true" /> : <Circle className="size-5" aria-hidden="true" />}
          <span className="sr-only">{done ? `Mark ${milestone.title} as not done` : `Mark ${milestone.title} as done`}</span>
        </PlanButton>
      </form>
      <div className="grid min-w-0 flex-1 gap-1">
        {isEditing ? (
          <MilestoneEditor milestone={milestone} form={form} onCancel={onCloseEditor} />
        ) : (
          <p className="break-words pt-2.5 text-sm">{milestone.title}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <StatusBadge status={status} />
          <span>{milestone.target_date ? `Target ${formatPlanDate(milestone.target_date)}` : "No target date"}</span>
          {done && milestone.completed_at && (
            <span>Done on {formatPlanTimestamp(milestone.completed_at)}{doneBy ? ` by ${doneBy}` : ""}</span>
          )}
        </div>
        {!isEditing && (
          <div className="flex flex-wrap gap-1">
            <PlanButton id={editButtonId} type="button" variant="ghost" size="xs" pending={form.pending} onClick={() => onEdit(`milestone:${milestone.id}`, editButtonId)}>
              <Pencil aria-hidden="true" />
              Edit<span className="sr-only"> milestone {milestone.title}</span>
            </PlanButton>
            <form action={form.dispatch}>
              <PlanFields intent="delete_milestone" targetId={milestone.id} />
              <PlanButton type="submit" variant="ghost" size="xs" pending={form.pending}>
                <Trash2 aria-hidden="true" />
                Remove<span className="sr-only"> milestone {milestone.title}</span>
              </PlanButton>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

function AddMilestoneForm({ objectiveId, form }: { objectiveId: string; form: PlanForm }) {
  const titleId = useId();
  const dateId = useId();
  const errorId = useId();
  const kept = form.retained("add_milestone", objectiveId);
  const ref = useFocusOnFailure(kept);
  return (
    <form action={form.dispatch} className="flex flex-wrap items-end gap-2">
      <PlanFields intent="add_milestone" targetId={objectiveId} />
      <div className="grid min-w-0 flex-1 basis-48 gap-1">
        <Label htmlFor={titleId} className="text-xs font-medium">New milestone</Label>
        <Input
          ref={ref}
          id={titleId}
          name="title"
          key={fieldKey(kept, "title")}
          {...fieldProps(kept, errorId)}
          defaultValue={kept?.title ?? ""}
          required
          minLength={PLAN_TEXT_MIN}
          maxLength={PLAN_TEXT_MAX}
          placeholder="For example, finish an SQL course"
          className="h-9 text-sm"
        />
      </div>
      <DateField id={dateId} defaultValue={kept?.targetDate ?? ""} resetKey={fieldKey(kept, "date")} />
      <PlanButton type="submit" variant="outline" size="sm" pending={form.pending}>
        <Plus aria-hidden="true" />
        Add milestone
      </PlanButton>
      <div className="basis-full empty:hidden"><FieldError id={errorId} kept={kept} /></div>
    </form>
  );
}

function DateField({ id, defaultValue, resetKey }: { id: string; defaultValue: string; resetKey: string }) {
  return (
    <div className="grid min-w-0 flex-1 basis-36 gap-1">
      <Label htmlFor={id} className="text-xs font-medium">Target date (optional)</Label>
      <Input
        id={id}
        type="date"
        name="target_date"
        key={resetKey}
        defaultValue={defaultValue}
        min="2020-01-01"
        max="2100-12-31"
        className="h-9 text-sm"
      />
    </div>
  );
}

function EditorActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <PlanButton type="submit" size="sm" pending={pending}>{pending ? "Saving..." : "Save"}</PlanButton>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

/** Escape cancels an open editor, as it does for the workspace menu. */
function EditorForm({ form, onCancel, children }: { form: PlanForm; onCancel: () => void; children: ReactNode }) {
  return (
    <form
      action={form.dispatch}
      className="grid gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      {children}
    </form>
  );
}

function useFocusOnMount(kept: PlanActionState | null) {
  const ref = useRef<HTMLInputElement>(null);
  const failure = kept?.nonce;
  useEffect(() => {
    ref.current?.focus();
  }, [failure]);
  return ref;
}

function TitleEditor({ intent, targetId, label, value, form, onCancel }: {
  intent: PlanIntent; targetId: string; label: string; value: string; form: PlanForm; onCancel: () => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const kept = form.retained(intent, targetId);
  const ref = useFocusOnMount(kept);
  return (
    <EditorForm form={form} onCancel={onCancel}>
      <PlanFields intent={intent} targetId={targetId} />
      <Label htmlFor={inputId} className="text-xs font-medium">{label}</Label>
      <Input
        ref={ref}
        id={inputId}
        name="title"
        key={fieldKey(kept, "edit")}
        {...fieldProps(kept, errorId)}
        defaultValue={kept?.title ?? value}
        required
        minLength={PLAN_TEXT_MIN}
        maxLength={PLAN_TEXT_MAX}
        className="h-9 text-sm"
      />
      <FieldError id={errorId} kept={kept} />
      <EditorActions pending={form.pending} onCancel={onCancel} />
    </EditorForm>
  );
}

function MilestoneEditor({ milestone, form, onCancel }: { milestone: PlanMilestone; form: PlanForm; onCancel: () => void }) {
  const titleId = useId();
  const dateId = useId();
  const errorId = useId();
  const kept = form.retained("edit_milestone", milestone.id);
  const ref = useFocusOnMount(kept);
  return (
    <EditorForm form={form} onCancel={onCancel}>
      <PlanFields intent="edit_milestone" targetId={milestone.id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-0 flex-1 basis-48 gap-1">
          <Label htmlFor={titleId} className="text-xs font-medium">Milestone</Label>
          <Input
            ref={ref}
            id={titleId}
            name="title"
            key={fieldKey(kept, "edit")}
            {...fieldProps(kept, errorId)}
            defaultValue={kept?.title ?? milestone.title}
            required
            minLength={PLAN_TEXT_MIN}
            maxLength={PLAN_TEXT_MAX}
            className="h-9 text-sm"
          />
        </div>
        <DateField id={dateId} defaultValue={kept?.targetDate ?? milestone.target_date ?? ""} resetKey={fieldKey(kept, "edit-date")} />
      </div>
      <FieldError id={errorId} kept={kept} />
      <EditorActions pending={form.pending} onCancel={onCancel} />
    </EditorForm>
  );
}
