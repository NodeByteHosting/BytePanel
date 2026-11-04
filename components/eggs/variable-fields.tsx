"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { parseRules, validateVariable } from "@/lib/eggs/rules";

export interface VariableFieldDef {
  name: string;
  description: string;
  envVariable: string;
  rules: string;
  editable: boolean;
}

const BOOLEAN_PAIRS: [string, string][] = [
  ["true", "false"],
  ["1", "0"],
  ["TRUE", "FALSE"],
];

// Picks an input from the variable's validation rules: in:true,false → switch,
// in:a,b,c → select, integer/numeric → number, otherwise text.
const VariableInput = ({
  variable,
  value,
  onChange,
}: {
  variable: VariableFieldDef;
  value: string;
  onChange: (value: string) => void;
}) => {
  const rules = parseRules(variable.rules);
  const id = `var-${variable.envVariable}`;
  const disabled = !variable.editable;

  const pair = rules.options
    ? BOOLEAN_PAIRS.find(
        ([on, off]) =>
          rules.options?.length === 2 &&
          rules.options.includes(on) &&
          rules.options.includes(off)
      )
    : undefined;
  if (pair) {
    return (
      <Switch
        checked={value === pair[0]}
        disabled={disabled}
        id={id}
        onCheckedChange={(checked) => onChange(checked ? pair[0] : pair[1])}
      />
    );
  }
  if (rules.type === "boolean") {
    return (
      <Switch
        checked={value === "1" || value === "true"}
        disabled={disabled}
        id={id}
        onCheckedChange={(checked) => onChange(checked ? "1" : "0")}
      />
    );
  }
  if (rules.options) {
    return (
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {rules.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (rules.type === "integer" || rules.type === "numeric") {
    return (
      <Input
        className="w-32"
        disabled={disabled}
        id={id}
        max={rules.max}
        min={rules.min}
        step={rules.type === "integer" ? 1 : "any"}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Input
      className="w-64"
      disabled={disabled}
      id={id}
      maxLength={rules.max}
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export const variableErrors = (
  variables: VariableFieldDef[],
  values: Record<string, string>
): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const variable of variables) {
    const error = validateVariable(
      values[variable.envVariable] ?? "",
      variable.rules,
      variable.name
    );
    if (error) {
      errors[variable.envVariable] = error;
    }
  }
  return errors;
};

const NO_ERRORS: Record<string, string> = {};

export const VariableFields = ({
  variables,
  values,
  errors = NO_ERRORS,
  onChange,
}: {
  variables: VariableFieldDef[];
  values: Record<string, string>;
  errors?: Record<string, string>;
  onChange: (env: string, value: string) => void;
}) => (
  <>
    {variables.map((variable) => (
      <div
        className="flex items-center justify-between gap-4 rounded-lg px-3 py-3"
        key={variable.envVariable}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            className="text-sm font-medium"
            htmlFor={`var-${variable.envVariable}`}
          >
            {variable.name}
            {parseRules(variable.rules).required && (
              <span aria-hidden className="text-destructive ml-1">
                *
              </span>
            )}
          </Label>
          {variable.description && (
            <span className="text-muted-foreground text-xs">
              {variable.description}
            </span>
          )}
          <code className="text-muted-foreground/70 text-[10px]">
            {variable.envVariable}
          </code>
          {errors[variable.envVariable] && (
            <span className="text-destructive text-xs">
              {errors[variable.envVariable]}
            </span>
          )}
        </div>
        <div className="shrink-0">
          <VariableInput
            value={values[variable.envVariable] ?? ""}
            variable={variable}
            onChange={(value) => onChange(variable.envVariable, value)}
          />
        </div>
      </div>
    ))}
  </>
);
