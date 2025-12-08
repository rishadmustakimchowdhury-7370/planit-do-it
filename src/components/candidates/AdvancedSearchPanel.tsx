import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  MapPin, 
  Briefcase, 
  Code2,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AdvancedSearchFilters {
  query: string;
  skills: string[];
  title: string;
  location: string;
  experienceMin: string;
  experienceMax: string;
  status: string;
  booleanQuery: string;
}

interface AdvancedSearchPanelProps {
  filters: AdvancedSearchFilters;
  onFiltersChange: (filters: AdvancedSearchFilters) => void;
  onReset: () => void;
}

const statusOptions = [
  { id: 'all', label: 'All Statuses' },
  { id: 'new', label: 'New' },
  { id: 'screening', label: 'Screening' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offered', label: 'Offered' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
];

const popularSkills = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 
  'Java', 'SQL', 'AWS', 'Docker', 'Kubernetes'
];

export function AdvancedSearchPanel({ 
  filters, 
  onFiltersChange, 
  onReset 
}: AdvancedSearchPanelProps) {
  const [skillInput, setSkillInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = [
    filters.skills.length > 0,
    filters.title,
    filters.location,
    filters.experienceMin,
    filters.experienceMax,
    filters.status !== 'all' && filters.status,
    filters.booleanQuery,
  ].filter(Boolean).length;

  const handleAddSkill = (skill: string) => {
    if (skill && !filters.skills.includes(skill)) {
      onFiltersChange({
        ...filters,
        skills: [...filters.skills, skill],
      });
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    onFiltersChange({
      ...filters,
      skills: filters.skills.filter(s => s !== skill),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      handleAddSkill(skillInput.trim());
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <SlidersHorizontal className="h-4 w-4" />
          Advanced Search
          {activeFiltersCount > 0 && (
            <Badge 
              variant="secondary" 
              className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Advanced Search
          </SheetTitle>
          <SheetDescription>
            Use filters to find the perfect candidates. Supports boolean search operators (AND, OR, NOT).
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Boolean Search */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              Boolean Search
            </Label>
            <Input
              placeholder='e.g., (React AND TypeScript) OR (Vue AND JavaScript)'
              value={filters.booleanQuery}
              onChange={(e) => onFiltersChange({ ...filters, booleanQuery: e.target.value })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use AND, OR, NOT operators. Wrap phrases in quotes. Use parentheses for grouping.
            </p>
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Skills
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button 
                type="button" 
                size="sm"
                onClick={() => handleAddSkill(skillInput.trim())}
                disabled={!skillInput.trim()}
              >
                Add
              </Button>
            </div>
            
            {filters.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filters.skills.map((skill) => (
                  <Badge 
                    key={skill} 
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Popular skills:</p>
              <div className="flex flex-wrap gap-1.5">
                {popularSkills.filter(s => !filters.skills.includes(s)).slice(0, 6).map((skill) => (
                  <Badge 
                    key={skill} 
                    variant="outline"
                    className="cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleAddSkill(skill)}
                  >
                    + {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Job Title */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Job Title
            </Label>
            <Input
              placeholder="e.g., Software Engineer, Product Manager"
              value={filters.title}
              onChange={(e) => onFiltersChange({ ...filters, title: e.target.value })}
            />
          </div>

          {/* Location */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location
            </Label>
            <Input
              placeholder="e.g., New York, Remote, London"
              value={filters.location}
              onChange={(e) => onFiltersChange({ ...filters, location: e.target.value })}
            />
          </div>

          {/* Experience Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Years of Experience</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="Min"
                min="0"
                max="50"
                value={filters.experienceMin}
                onChange={(e) => onFiltersChange({ ...filters, experienceMin: e.target.value })}
                className="w-24"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                placeholder="Max"
                min="0"
                max="50"
                value={filters.experienceMax}
                onChange={(e) => onFiltersChange({ ...filters, experienceMax: e.target.value })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">years</span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(val) => onFiltersChange({ ...filters, status: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              onReset();
              setSkillInput('');
            }}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset All
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
