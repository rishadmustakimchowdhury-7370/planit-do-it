import { useMemo, useState } from 'react';
import { Country, State, City } from 'country-state-city';
import { Check, ChevronsUpDown, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DiscoveryLocation {
  country: string;
  countryCode: string;
  state?: string;
  stateCode?: string;
  city?: string;
}

interface Props {
  value: DiscoveryLocation | null;
  onChange: (v: DiscoveryLocation | null) => void;
}

const SUGGESTED = ['US', 'GB', 'AE', 'SA', 'SG', 'IN', 'AU', 'DE', 'CH', 'CA'];

function Combobox({
  label, icon, value, options, onChange, placeholder, disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: { value: string; label: string; pinned?: boolean }[];
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => {
    const pinned = options.filter((o) => o.pinned);
    const rest = options.filter((o) => !o.pinned);
    return [...pinned, ...rest];
  }, [options]);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="flex-1 min-w-[160px]">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline" role="combobox" disabled={disabled}
            className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
          >
            <span className="flex items-center gap-2 truncate">
              {icon}
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {sorted.map((o) => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function LocationPicker({ value, onChange }: Props) {
  const countries = useMemo(() => {
    const all = Country.getAllCountries().map((c) => ({
      value: c.isoCode, label: c.name, pinned: SUGGESTED.includes(c.isoCode),
    }));
    all.sort((a, b) => (a.pinned && !b.pinned ? -1 : !a.pinned && b.pinned ? 1 : a.label.localeCompare(b.label)));
    return all;
  }, []);
  const states = useMemo(() => {
    if (!value?.countryCode) return [];
    return State.getStatesOfCountry(value.countryCode).map((s) => ({ value: s.isoCode, label: s.name }));
  }, [value?.countryCode]);
  const cities = useMemo(() => {
    if (!value?.countryCode || !value?.stateCode) return [];
    return City.getCitiesOfState(value.countryCode, value.stateCode).map((c) => ({ value: c.name, label: c.name }));
  }, [value?.countryCode, value?.stateCode]);

  const setCountry = (code: string) => {
    const c = Country.getCountryByCode(code);
    if (!c) return;
    onChange({ country: c.name, countryCode: code });
  };
  const setState = (code: string) => {
    if (!value) return;
    const s = State.getStateByCodeAndCountry(code, value.countryCode);
    onChange({ ...value, state: s?.name ?? code, stateCode: code, city: undefined });
  };
  const setCity = (name: string) => {
    if (!value) return;
    onChange({ ...value, city: name });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 flex-wrap">
        <Combobox
          label="Country"
          icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
          value={value?.countryCode ?? ''}
          options={countries}
          onChange={setCountry}
          placeholder="Any country"
        />
        <Combobox
          label="State / Province"
          value={value?.stateCode ?? ''}
          options={states}
          onChange={setState}
          placeholder={value ? 'Any state' : 'Pick country first'}
          disabled={!value || states.length === 0}
        />
        <Combobox
          label="City"
          value={value?.city ?? ''}
          options={cities}
          onChange={setCity}
          placeholder={value?.state ? 'Any city' : 'Pick state first'}
          disabled={!value?.stateCode || cities.length === 0}
        />
        {value && (
          <Button variant="ghost" size="icon" onClick={() => onChange(null)} title="Clear">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          Search will widen progressively: {[value.city, value.state, value.country].filter(Boolean).join(' → ')}
        </p>
      )}
    </div>
  );
}
