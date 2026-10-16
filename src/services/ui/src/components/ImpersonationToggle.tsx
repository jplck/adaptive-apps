import { Field, Radio, RadioGroup } from '@fluentui/react-components';
import type { ImpersonationMode } from '../api/client';

const OPTIONS: Array<{ value: ImpersonationMode; label: string }> = [
  { value: 'app', label: 'App' },
  { value: 'endUserOBO', label: 'On behalf of me' },
  { value: 'agentUser', label: 'Agent user' },
];

export interface ImpersonationToggleProps {
  value: ImpersonationMode;
  onChange: (mode: ImpersonationMode) => void;
  allowedModes?: readonly ImpersonationMode[];
  disabled?: boolean;
}

export function ImpersonationToggle({
  value,
  onChange,
  allowedModes,
  disabled = false,
}: ImpersonationToggleProps): JSX.Element {
  return (
    <Field label="Call identity">
      <RadioGroup
        layout="horizontal"
        value={value}
        disabled={disabled}
        onChange={(_, data) => onChange(data.value as ImpersonationMode)}
      >
        {OPTIONS.map((option) => (
          <Radio key={option.value} value={option.value} label={option.label}
            disabled={disabled || !(allowedModes ?? ['app']).includes(option.value)} />
        ))}
      </RadioGroup>
    </Field>
  );
}
