import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronRight, AlertTriangle, Info, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type ClarificationsFile,
  type Section,
  type Question,
  type Choice,
  type Note,
  type SectionStatus,
  getSectionStatus,
  getSectionCounts,
  getTotalCounts,
  isQuestionAnswered,
} from "@/lib/clarifications-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build an updater that sets answer_text and answer_choice for a question. */
function makeAnswerUpdater(text: string): (q: Question) => Question {
  return (q) => ({
    ...q,
    answer_text: text,
    answer_choice: text.trim() !== "" ? (q.answer_choice ?? "custom") : null,
  });
}

/** Resolve which icon to use for a note based on its type. */
function resolveNoteIcon(type: Note["type"]): typeof AlertTriangle {
  switch (type) {
    case "blocked": return AlertTriangle;
    case "deferred": return Clock;
    default: return Info;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClarificationsEditorProps {
  data: ClarificationsFile;
  onChange: (updated: ClarificationsFile) => void;
  onReload?: () => void;
  onContinue?: () => void;
  readOnly?: boolean;
  filePath?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClarificationsEditor({
  data,
  onChange,
  onReload,
  onContinue,
  readOnly = false,
  filePath,
}: ClarificationsEditorProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { answered, total, mustUnanswered } = getTotalCounts(data);
  const canContinue = mustUnanswered === 0;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const isComplete = answered === total;

  const toggleCard = useCallback((id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Deep-update a question anywhere in the tree by ID
  const updateQuestion = useCallback(
    (questionId: string, updater: (q: Question) => Question) => {
      function walkQuestions(questions: Question[]): Question[] {
        return questions.map((q) => {
          if (q.id === questionId) return updater(q);
          if (q.refinements.length > 0) {
            return { ...q, refinements: walkQuestions(q.refinements) };
          }
          return q;
        });
      }

      const updated: ClarificationsFile = {
        ...data,
        sections: data.sections.map((s) => ({
          ...s,
          questions: walkQuestions(s.questions),
        })),
      };
      onChange(updated);
    },
    [data, onChange],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-muted px-5 py-2">
        <div className="flex flex-1 items-center gap-3">
          {/* Progress bar */}
          <div className="h-1 w-28 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-[11px] font-semibold whitespace-nowrap ${isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
            {answered} / {total} answered
          </span>
          {mustUnanswered > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-destructive">
                {total - answered} unanswered (incl. {mustUnanswered} MUST ANSWER)
              </span>
            </>
          )}
        </div>
        {filePath && (
          <span className="text-[10px] font-mono text-muted-foreground">{filePath}</span>
        )}
      </div>

      {/* Scrollable document */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {/* Metadata block */}
        <MetadataBlock data={data} />

        {/* Document title */}
        <div className="px-6 pt-3.5 pb-1 text-base font-bold text-foreground">
          {data.metadata.title}
        </div>
        <div className="mx-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          Questions marked <strong>MUST ANSWER</strong> block skill generation. All others refine
          quality but have reasonable defaults.
        </div>

        {/* Sections */}
        {data.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            expandedCards={expandedCards}
            toggleCard={toggleCard}
            updateQuestion={updateQuestion}
            readOnly={readOnly}
          />
        ))}

        {/* Notes / Needs Clarification */}
        {data.notes.length > 0 && <NotesBlock notes={data.notes} />}
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-between border-t px-5 py-3">
        <p className="text-xs text-muted-foreground">Answers save automatically as you type.</p>
        <div className="flex items-center gap-2">
          {onReload && (
            <Button variant="outline" size="sm" onClick={onReload}>
              <RotateCcw className="mr-1.5 size-3" />
              Reload
            </Button>
          )}
          {onContinue && (
            <Button size="sm" onClick={onContinue} disabled={!canContinue || readOnly}>
              Continue
              {!canContinue && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({mustUnanswered} required)
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metadata Block ───────────────────────────────────────────────────────────

function MetadataBlock({ data }: { data: ClarificationsFile }) {
  const m = data.metadata;
  return (
    <div className="mx-6 mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md border bg-muted px-3 py-2 font-mono text-[11px]">
      <span>
        <span className="text-muted-foreground">questions</span>
        {": "}
        <span className="text-primary">{m.question_count}</span>
      </span>
      <span>
        <span className="text-muted-foreground">sections</span>
        {": "}
        <span className="text-primary">{m.section_count}</span>
      </span>
      <span>
        <span className="text-muted-foreground">refinements</span>
        {": "}
        <span className="text-primary">{m.refinement_count}</span>
      </span>
      {m.priority_questions.length > 0 && (
        <span>
          <span className="text-muted-foreground">priority</span>
          {": "}
          <span className="text-amber-600 dark:text-amber-400">
            [{m.priority_questions.join(", ")}]
          </span>
        </span>
      )}
    </div>
  );
}

// ─── Section Band ─────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  expandedCards,
  toggleCard,
  updateQuestion,
  readOnly,
}: {
  section: Section;
  expandedCards: Set<string>;
  toggleCard: (id: string) => void;
  updateQuestion: (id: string, updater: (q: Question) => Question) => void;
  readOnly: boolean;
}) {
  const status = getSectionStatus(section);
  const { answered, total } = getSectionCounts(section);

  return (
    <div>
      {/* Sticky section band */}
      <div className="sticky top-0 z-10 mt-5 flex items-center gap-2.5 border-t-2 border-primary bg-primary/10 px-6 pt-2.5 pb-2 backdrop-blur-sm">
        <span className="flex-1 text-[13px] font-bold text-primary">{section.title}</span>
        <StatusChip status={status} answered={answered} total={total} />
      </div>

      {/* Section description */}
      {section.description && (
        <div className="border-b bg-muted/50 px-6 pt-1 pb-2.5 text-xs text-muted-foreground italic">
          {section.description}
        </div>
      )}

      {/* Question cards */}
      {section.questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          isExpanded={expandedCards.has(question.id)}
          toggleCard={toggleCard}
          updateQuestion={updateQuestion}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

// ─── Status Chip ──────────────────────────────────────────────────────────────

const chipClasses: Record<SectionStatus, string> = {
  complete: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  partial: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400",
  blocked: "bg-destructive/15 border-destructive/40 text-destructive",
};

function StatusChip({
  status,
  answered,
  total,
}: {
  status: SectionStatus;
  answered: number;
  total: number;
}) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chipClasses[status]}`}>
      {answered} / {total} answered
    </span>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  isExpanded,
  toggleCard,
  updateQuestion,
  readOnly,
}: {
  question: Question;
  isExpanded: boolean;
  toggleCard: (id: string) => void;
  updateQuestion: (id: string, updater: (q: Question) => Question) => void;
  readOnly: boolean;
}) {
  const answered = isQuestionAnswered(question);

  return (
    <div className={`mx-6 mt-2.5 overflow-hidden rounded-[7px] border border-l-[3px] ${answered ? "border-l-emerald-500" : "border-l-amber-500"}`}>
      {/* Card header — always visible */}
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-2.5 bg-muted/50 px-3.5 py-2.5 text-left select-none hover:bg-muted"
        onClick={() => toggleCard(question.id)}
      >
        <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
          {question.id}
        </span>
        <span className="flex-1 text-[13px] font-semibold leading-snug text-foreground">
          {question.title}
        </span>
        {question.must_answer && <MustBadge />}
        <ChevronRight
          className="mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Collapsed answer preview */}
      {!isExpanded && (
        <div className="flex items-center gap-2 bg-muted/50 px-3.5 pb-2">
          {answered ? (
            <span className="flex-1 truncate text-[11.5px] italic text-emerald-600 dark:text-emerald-400">
              {question.answer_text || `Choice ${question.answer_choice}`}
            </span>
          ) : (
            <span className="text-[11.5px] italic text-amber-600 dark:text-amber-400">
              Not yet answered
            </span>
          )}
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t bg-card p-3.5">
          {/* Question text */}
          <p className="mb-2.5 text-[12.5px] leading-relaxed text-foreground">
            {question.text}
          </p>

          {/* Choices */}
          {question.choices.length > 0 && (
            <ChoiceList
              choices={question.choices}
              selectedId={question.answer_choice}
              onSelect={(choiceId, choiceText) => {
                if (readOnly) return;
                updateQuestion(question.id, (q) => ({
                  ...q,
                  answer_choice: choiceId,
                  answer_text: choiceText,
                }));
              }}
            />
          )}

          {/* Consolidated from */}
          {question.consolidated_from && question.consolidated_from.length > 0 && (
            <p className="mb-2 text-[10.5px] italic text-muted-foreground">
              Consolidated from: {question.consolidated_from.join(", ")}
            </p>
          )}

          {/* Answer textarea */}
          <AnswerField
            value={question.answer_text ?? ""}
            onChange={(text) => {
              if (readOnly) return;
              updateQuestion(question.id, makeAnswerUpdater(text));
            }}
            readOnly={readOnly}
          />

          {/* Refinements */}
          {question.refinements.length > 0 && (
            <RefinementsBlock
              refinements={question.refinements}
              updateQuestion={updateQuestion}
              readOnly={readOnly}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── MUST Badge ───────────────────────────────────────────────────────────────

function MustBadge() {
  return (
    <span className="shrink-0 rounded-sm border border-destructive/50 bg-destructive/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-destructive">
      must
    </span>
  );
}

// ─── Choice List ──────────────────────────────────────────────────────────────

function ChoiceList({
  choices,
  selectedId,
  onSelect,
}: {
  choices: Choice[];
  selectedId: string | null;
  onSelect: (id: string, text: string) => void;
}) {
  return (
    <div className="mb-2.5 flex flex-col gap-0.5">
      {choices.map((choice) => {
        const isSelected = selectedId === choice.id;
        return (
          <button
            type="button"
            key={choice.id}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs leading-snug transition-all duration-100 ${
              isSelected
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => onSelect(choice.id, choice.is_other ? "" : choice.text)}
          >
            <span className={`mt-px shrink-0 font-mono text-[10px] font-bold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
              {choice.id}.
            </span>
            <span className="flex-1">{choice.text}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Answer Field ─────────────────────────────────────────────────────────────

function AnswerField({
  value,
  onChange,
  readOnly,
  compact = false,
}: {
  value: string;
  onChange: (text: string) => void;
  readOnly: boolean;
  compact?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-input transition-colors duration-150 focus-within:border-ring focus-within:ring-[2px] focus-within:ring-ring/20">
      {!compact && (
        <div className="flex items-center justify-between border-b bg-muted px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-primary">
          Answer
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            type freely or reference a choice above
          </span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={compact ? 1 : 2}
        placeholder={compact ? "Type your answer..." : "Type your answer here..."}
        className="w-full resize-none border-none bg-background px-2.5 font-sans text-emerald-700 outline-none placeholder:text-muted-foreground dark:text-emerald-400"
        style={{
          padding: compact ? "6px 10px" : "8px 10px",
          fontSize: compact ? "12px" : "12.5px",
          lineHeight: "1.55",
          minHeight: compact ? "28px" : "36px",
        }}
      />
    </div>
  );
}

// ─── Refinements Block ────────────────────────────────────────────────────────

function RefinementsBlock({
  refinements,
  updateQuestion,
  readOnly,
}: {
  refinements: Question[];
  updateQuestion: (id: string, updater: (q: Question) => Question) => void;
  readOnly: boolean;
}) {
  return (
    <div className="mt-2.5 ml-3.5 overflow-hidden rounded-r-md border border-l-2 border-l-violet-500">
      <div className="border-b bg-violet-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
        Refinements
      </div>
      {refinements.map((ref) => (
        <RefinementItem key={ref.id} refinement={ref} updateQuestion={updateQuestion} readOnly={readOnly} />
      ))}
    </div>
  );
}

function RefinementItem({
  refinement,
  updateQuestion,
  readOnly,
}: {
  refinement: Question;
  updateQuestion: (id: string, updater: (q: Question) => Question) => void;
  readOnly: boolean;
}) {
  const answered = isQuestionAnswered(refinement);

  return (
    <div className={`border-b p-2.5 last:border-b-0 ${answered ? "border-l-2 -ml-[2px] border-l-emerald-500" : "border-l-2 -ml-[2px] border-l-violet-500/50"}`}>
      <div className="mb-0.5 font-mono text-[10px] font-bold text-violet-600 dark:text-violet-400">
        {refinement.id}
      </div>
      <div className="mb-1.5 text-xs font-semibold leading-snug text-foreground">
        {refinement.title}
        {refinement.text && refinement.text !== refinement.title && (
          <span className="font-normal text-muted-foreground">
            {" "}&mdash; {refinement.text}
          </span>
        )}
      </div>
      <AnswerField
        value={refinement.answer_text ?? ""}
        onChange={(text) => {
          if (readOnly) return;
          updateQuestion(refinement.id, makeAnswerUpdater(text));
        }}
        readOnly={readOnly}
        compact
      />
    </div>
  );
}

// ─── Notes / Needs Clarification ──────────────────────────────────────────────

function NotesBlock({ notes }: { notes: Note[] }) {
  return (
    <div>
      <div className="mt-5 flex items-center gap-2.5 border-t-2 border-amber-500 bg-amber-500/10 px-6 pt-2.5 pb-2">
        <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
        <span className="flex-1 text-[13px] font-bold text-amber-600 dark:text-amber-400">
          Needs Clarification
        </span>
      </div>
      {notes.map((note, i) => (
        <NoteCard key={i} note={note} />
      ))}
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  const isBlocked = note.type === "blocked";

  const Icon = resolveNoteIcon(note.type);

  return (
    <div className={`mx-6 mt-2.5 rounded-md border p-3.5 ${isBlocked ? "border-destructive/30 bg-destructive/10" : "border-amber-500/30 bg-amber-500/10"}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={`size-3 ${isBlocked ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
        <span className={`text-[12.5px] font-semibold ${isBlocked ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
          {note.title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{note.body}</p>
    </div>
  );
}
