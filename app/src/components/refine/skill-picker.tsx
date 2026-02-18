import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillSummary } from "@/lib/types";
import { SKILL_TYPE_LABELS, SKILL_TYPE_COLORS } from "@/lib/types";
import type { SkillType } from "@/lib/types";

interface SkillPickerProps {
  skills: SkillSummary[];
  selected: SkillSummary | null;
  isLoading: boolean;
  onSelect: (skill: SkillSummary) => void;
}

export function SkillPicker({ skills, selected, isLoading, onSelect }: SkillPickerProps) {
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-9 w-64" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64 justify-between">
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">{selected.display_name ?? selected.name}</span>
              {selected.skill_type && (
                <Badge
                  className={`text-[10px] px-1.5 py-0 ${SKILL_TYPE_COLORS[selected.skill_type as SkillType] ?? ""}`}
                >
                  {SKILL_TYPE_LABELS[selected.skill_type as SkillType] ?? selected.skill_type}
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a skill...</span>
          )}
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search skills..." />
          <CommandList>
            <CommandEmpty>No skills found</CommandEmpty>
            <CommandGroup>
              {skills.map((skill) => (
                <CommandItem
                  key={skill.name}
                  value={skill.display_name ?? skill.name}
                  onSelect={() => {
                    onSelect(skill);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{skill.display_name ?? skill.name}</span>
                  {skill.skill_type && (
                    <Badge
                      className={`ml-auto text-[10px] px-1.5 py-0 ${SKILL_TYPE_COLORS[skill.skill_type as SkillType] ?? ""}`}
                    >
                      {SKILL_TYPE_LABELS[skill.skill_type as SkillType] ?? skill.skill_type}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
