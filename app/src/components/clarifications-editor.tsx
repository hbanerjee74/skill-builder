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
      <div className="flex shrink-0 items-center gap-3 border-b px-5 py-2" style={{ background: "oklch(0.185 0.004 270)" }}>
        <div className="flex flex-1 items-center gap-3">
          {/* Progress bar */}
          <div className="h-1 w-28 overflow-hidden rounded-full" style={{ background: "oklch(0.290 0.006 260)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                background: answered === total ? "oklch(0.640 0.130 145)" : "oklch(0.700 0.140 55)",
              }}
            />
          </div>
          <span
            className="text-[11px] font-semibold whitespace-nowrap"
            style={{ color: answered === total ? "oklch(0.640 0.130 145)" : "oklch(0.700 0.140 55)" }}
          >
            {answered} / {total} answered
          </span>
          {mustUnanswered > 0 && (
            <>
              <span className="text-[11px]" style={{ color: "oklch(0.450 0.010 260)" }}>
                ·
              </span>
              <span className="text-[11px]" style={{ color: "oklch(0.620 0.160 25)" }}>
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
        <div
          className="mx-6 rounded-md border px-3 py-1.5 text-xs"
          style={{
            background: "oklch(0.230 0.035 55 / 0.3)",
            borderColor: "oklch(0.430 0.080 55)",
            color: "oklch(0.820 0.080 55)",
          }}
        >
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
    <div
      className="mx-6 mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{
        background: "oklch(0.200 0.008 260)",
        borderColor: "oklch(0.300 0.012 260)",
      }}
    >
      <span>
        <span style={{ color: "oklch(0.620 0.050 270)" }}>questions</span>
        {": "}
        <span style={{ color: "oklch(0.580 0.080 145)" }}>{m.question_count}</span>
      </span>
      <span>
        <span style={{ color: "oklch(0.620 0.050 270)" }}>sections</span>
        {": "}
        <span style={{ color: "oklch(0.580 0.080 145)" }}>{m.section_count}</span>
      </span>
      <span>
        <span style={{ color: "oklch(0.620 0.050 270)" }}>refinements</span>
        {": "}
        <span style={{ color: "oklch(0.580 0.080 145)" }}>{m.refinement_count}</span>
      </span>
      {m.priority_questions.length > 0 && (
        <span>
          <span style={{ color: "oklch(0.620 0.050 270)" }}>priority</span>
          {": "}
          <span style={{ color: "oklch(0.700 0.090 55)" }}>
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
      <div
        className="sticky top-0 z-10 mt-5 flex items-center gap-2.5 px-6 pt-2.5 pb-2"
        style={{
          background: "oklch(0.210 0.012 210 / 0.5)",
          borderTop: "2px solid var(--color-primary, oklch(0.750 0.120 210))",
          backdropFilter: "blur(4px)",
        }}
      >
        <span className="flex-1 text-[13px] font-bold text-primary">{section.title}</span>
        <StatusChip status={status} answered={answered} total={total} />
      </div>

      {/* Section description */}
      {section.description && (
        <div
          className="border-b px-6 pt-1 pb-2.5 text-xs text-muted-foreground italic"
          style={{
            background: "oklch(0.205 0.008 215 / 0.3)",
            borderColor: "oklch(0.255 0.008 235)",
          }}
        >
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

function StatusChip({
  status,
  answered,
  total,
}: {
  status: SectionStatus;
  answered: number;
  total: number;
}) {
  const styles: Record<SectionStatus, { bg: string; border: string; color: string }> = {
    complete: {
      bg: "oklch(0.250 0.030 145 / 0.3)",
      border: "oklch(0.400 0.080 145)",
      color: "oklch(0.640 0.130 145)",
    },
    partial: {
      bg: "oklch(0.240 0.040 55 / 0.25)",
      border: "oklch(0.450 0.080 55)",
      color: "oklch(0.700 0.140 55)",
    },
    blocked: {
      bg: "oklch(0.240 0.050 25 / 0.3)",
      border: "oklch(0.480 0.130 25)",
      color: "oklch(0.700 0.140 25)",
    },
  };
  const s = styles[status];

  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
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
    <div
      className="mx-6 mt-2.5 overflow-hidden rounded-[7px] border"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: answered ? "oklch(0.500 0.120 145)" : "oklch(0.600 0.120 55)",
      }}
    >
      {/* Card header — always visible */}
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-left select-none hover:brightness-110"
        style={{ background: "oklch(0.210 0.005 265)" }}
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
        <div className="flex items-center gap-2 px-3.5 pb-2" style={{ background: "oklch(0.210 0.005 265)" }}>
          {answered ? (
            <span
              className="flex-1 truncate text-[11.5px] italic"
              style={{ color: "oklch(0.720 0.090 145)" }}
            >
              {question.answer_text || `Choice ${question.answer_choice}`}
            </span>
          ) : (
            <span className="text-[11.5px] italic" style={{ color: "oklch(0.560 0.070 55)" }}>
              Not yet answered
            </span>
          )}
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t p-3.5" style={{ background: "oklch(0.197 0.005 268)", borderColor: "oklch(0.255 0.006 265)" }}>
          {/* Question text */}
          <p className="mb-2.5 text-[12.5px] leading-relaxed" style={{ color: "oklch(0.820 0.004 90)" }}>
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
            <p className="mb-2 text-[10.5px] italic" style={{ color: "oklch(0.450 0.012 260)" }}>
              Consolidated from: {question.consolidated_from.join(", ")}
            </p>
          )}

          {/* Answer textarea */}
          <AnswerField
            value={question.answer_text ?? ""}
            onChange={(text) => {
              if (readOnly) return;
              updateQuestion(question.id, (q) => ({
                ...q,
                answer_text: text,
                // If typing freely, mark as custom unless it matches a choice
                answer_choice: text.trim() !== "" ? (q.answer_choice ?? "custom") : null,
              }));
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
    <span
      className="shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
      style={{
        background: "oklch(0.250 0.060 25 / 0.5)",
        border: "1px solid oklch(0.500 0.150 25)",
        color: "oklch(0.700 0.160 25)",
      }}
    >
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
            className="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs leading-snug transition-all duration-100"
            style={{
              background: isSelected ? "oklch(0.230 0.030 155 / 0.4)" : "transparent",
              borderColor: isSelected ? "oklch(0.460 0.090 150)" : "transparent",
              color: isSelected ? "oklch(0.840 0.070 150)" : "oklch(0.680 0.005 85)",
            }}
            onClick={() => onSelect(choice.id, choice.is_other ? "" : choice.text)}
          >
            <span
              className="mt-px shrink-0 font-mono text-[10px] font-bold"
              style={{ color: isSelected ? "oklch(0.680 0.090 150)" : "oklch(0.540 0.030 260)" }}
            >
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
    <div
      className="mt-1 overflow-hidden rounded-md border transition-colors duration-150 focus-within:shadow-[0_0_0_2px_oklch(0.740_0.115_180_/_0.15)]"
      style={{ borderColor: "oklch(0.310 0.010 260)" }}
    >
      {!compact && (
        <div
          className="flex items-center justify-between border-b px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: "oklch(0.200 0.008 260)",
            borderColor: "oklch(0.265 0.008 260)",
            color: "oklch(0.580 0.050 190)",
          }}
        >
          Answer
          <span className="font-normal normal-case tracking-normal" style={{ color: "oklch(0.440 0.008 260)" }}>
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
        className="w-full resize-none border-none outline-none"
        style={{
          padding: compact ? "6px 10px" : "8px 10px",
          background: "oklch(0.195 0.004 268)",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: compact ? "12px" : "12.5px",
          color: "oklch(0.820 0.070 145)",
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
    <div
      className="mt-2.5 ml-3.5 overflow-hidden rounded-r-md border"
      style={{
        borderLeftWidth: "2px",
        borderLeftColor: "oklch(0.500 0.060 275)",
        borderColor: "oklch(0.265 0.012 265)",
      }}
    >
      <div
        className="border-b px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
        style={{
          background: "oklch(0.200 0.010 270 / 0.7)",
          borderColor: "oklch(0.255 0.010 270)",
          color: "oklch(0.580 0.050 275)",
        }}
      >
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
    <div
      className="border-b p-2.5 last:border-b-0"
      style={{
        borderColor: "oklch(0.240 0.007 265)",
        borderLeftWidth: "2px",
        borderLeftColor: answered ? "oklch(0.450 0.090 145)" : "oklch(0.490 0.055 275)",
        marginLeft: "-2px",
      }}
    >
      <div className="mb-0.5 font-mono text-[10px] font-bold" style={{ color: "oklch(0.560 0.050 275)" }}>
        {refinement.id}
      </div>
      <div className="mb-1.5 text-xs font-semibold leading-snug" style={{ color: "oklch(0.780 0.035 280)" }}>
        {refinement.title}
        {refinement.text && refinement.text !== refinement.title && (
          <span className="font-normal" style={{ color: "oklch(0.600 0.020 270)" }}>
            {" "}&mdash; {refinement.text}
          </span>
        )}
      </div>
      <AnswerField
        value={refinement.answer_text ?? ""}
        onChange={(text) => {
          if (readOnly) return;
          updateQuestion(refinement.id, (q) => ({
            ...q,
            answer_text: text,
            answer_choice: text.trim() !== "" ? (q.answer_choice ?? "custom") : null,
          }));
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
      <div
        className="mt-5 flex items-center gap-2.5 px-6 pt-2.5 pb-2"
        style={{
          background: "oklch(0.210 0.020 55 / 0.25)",
          borderTop: "2px solid oklch(0.700 0.140 55)",
        }}
      >
        <AlertTriangle className="size-3.5" style={{ color: "oklch(0.700 0.140 55)" }} />
        <span className="flex-1 text-[13px] font-bold" style={{ color: "oklch(0.700 0.140 55)" }}>
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
  const isDeferred = note.type === "deferred";

  const Icon = isBlocked ? AlertTriangle : isDeferred ? Clock : Info;

  return (
    <div
      className="mx-6 mt-2.5 rounded-md border p-3.5"
      style={{
        background: isBlocked ? "oklch(0.210 0.030 25 / 0.2)" : "oklch(0.205 0.015 55 / 0.2)",
        borderColor: isBlocked ? "oklch(0.420 0.100 25 / 0.5)" : "oklch(0.360 0.060 55 / 0.5)",
      }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="size-3" style={{ color: isBlocked ? "oklch(0.750 0.130 25)" : "oklch(0.800 0.070 55)" }} />
        <span
          className="text-[12.5px] font-semibold"
          style={{ color: isBlocked ? "oklch(0.750 0.130 25)" : "oklch(0.800 0.070 55)" }}
        >
          {note.title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{note.body}</p>
    </div>
  );
}
