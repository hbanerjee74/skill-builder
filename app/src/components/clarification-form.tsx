import { useState, useMemo } from "react";
import { Save, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClarificationFile } from "@/lib/tauri";

interface ClarificationFormProps {
  file: ClarificationFile;
  onSave: (file: ClarificationFile) => void;
  saving?: boolean;
}

export function ClarificationForm({
  file,
  onSave,
  saving,
}: ClarificationFormProps) {
  // Flatten all questions for answer tracking
  const [answers, setAnswers] = useState<
    Record<string, { choice: string; note: string }>
  >(() => {
    const initial: Record<string, { choice: string; note: string }> = {};
    for (const section of file.sections) {
      for (const q of section.questions) {
        if (q.answer) {
          // Parse existing answer: "b — some note" or just "b"
          const match = q.answer.match(/^([a-z])(?:\s*—\s*(.+))?$/);
          if (match) {
            initial[q.id] = {
              choice: match[1],
              note: match[2] || "",
            };
          } else {
            initial[q.id] = { choice: "", note: q.answer };
          }
        } else {
          initial[q.id] = { choice: "", note: "" };
        }
      }
    }
    return initial;
  });

  const totalQuestions = useMemo(
    () => file.sections.reduce((sum, s) => sum + s.questions.length, 0),
    [file]
  );

  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => a.choice !== "").length,
    [answers]
  );

  const handleChoiceChange = (questionId: string, choice: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], choice },
    }));
  };

  const handleNoteChange = (questionId: string, note: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], note },
    }));
  };

  const handleSave = () => {
    const updated: ClarificationFile = {
      sections: file.sections.map((section) => ({
        ...section,
        questions: section.questions.map((q) => {
          const a = answers[q.id];
          if (!a || !a.choice) return { ...q, answer: null };
          const answerStr = a.note
            ? `${a.choice} — ${a.note}`
            : a.choice;
          return { ...q, answer: answerStr };
        }),
      })),
    };
    onSave(updated);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-8 pb-4">
          {file.sections.map((section) => (
            <div key={section.heading} className="space-y-4">
              {section.heading && (
                <h3 className="text-lg font-semibold">{section.heading}</h3>
              )}

              {section.questions.map((q) => {
                const answer = answers[q.id];
                const isOther =
                  answer?.choice &&
                  q.choices.some(
                    (c) =>
                      c.letter === answer.choice &&
                      c.text.toLowerCase().startsWith("other")
                  );

                return (
                  <Card key={q.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {q.id}: {q.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {q.question}
                      </p>

                      <RadioGroup
                        value={answer?.choice || ""}
                        onValueChange={(val) =>
                          handleChoiceChange(q.id, val)
                        }
                      >
                        {q.choices.map((c) => (
                          <div
                            key={c.letter}
                            className="flex items-start gap-3"
                          >
                            <RadioGroupItem
                              value={c.letter}
                              id={`${q.id}-${c.letter}`}
                              className="mt-0.5"
                            />
                            <Label
                              htmlFor={`${q.id}-${c.letter}`}
                              className="flex flex-col gap-0.5 font-normal cursor-pointer"
                            >
                              <span>
                                {c.letter}) {c.text}
                              </span>
                              {c.rationale && (
                                <span className="text-xs text-muted-foreground">
                                  {c.rationale}
                                </span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>

                      {q.recommendation && (
                        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
                          <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Recommendation:</span>{" "}
                            {q.recommendation}
                          </p>
                        </div>
                      )}

                      {isOther && (
                        <Textarea
                          placeholder="Please specify..."
                          value={answer?.note || ""}
                          onChange={(e) =>
                            handleNoteChange(q.id, e.target.value)
                          }
                          className="mt-2"
                          rows={2}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {answeredCount} of {totalQuestions} answered
        </p>
        <Button onClick={handleSave} disabled={saving || answeredCount === 0}>
          <Save className="size-4" />
          {saving ? "Saving..." : "Save All Answers"}
        </Button>
      </div>
    </div>
  );
}
