import { useState, useEffect, useRef } from 'react';
import { Bell, Search, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface SearchResult {
  id: string;
  type: 'job' | 'candidate';
  title: string;
  subtitle: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { profile, tenantId, user } = useAuth();
  const userName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const searchData = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Get tenant ID
        let currentTenantId = tenantId;
        if (!currentTenantId && user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle();
          currentTenantId = profileData?.tenant_id || null;
        }

        if (!currentTenantId) return;

        const query = searchQuery.toLowerCase();

        // Search jobs
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, location, status')
          .eq('tenant_id', currentTenantId)
          .or(`title.ilike.%${query}%,location.ilike.%${query}%`)
          .limit(5);

        // Search candidates
        const { data: candidates } = await supabase
          .from('candidates')
          .select('id, full_name, email, current_title')
          .eq('tenant_id', currentTenantId)
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,current_title.ilike.%${query}%`)
          .limit(5);

        const results: SearchResult[] = [
          ...(jobs || []).map(job => ({
            id: job.id,
            type: 'job' as const,
            title: job.title,
            subtitle: `${job.location || 'Remote'} • ${job.status}`,
          })),
          ...(candidates || []).map(c => ({
            id: c.id,
            type: 'candidate' as const,
            title: c.full_name,
            subtitle: c.current_title || c.email,
          })),
        ];

        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchData, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, tenantId, user]);

  const handleSelect = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (result.type === 'job') {
      navigate(`/jobs/${result.id}`);
    } else {
      navigate(`/candidates/${result.id}`);
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Global Search */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs, candidates..."
                  className="w-64 pl-9 bg-muted/50 border-transparent focus:border-border cursor-pointer"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!searchOpen) setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandList>
                  {isSearching ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <CommandEmpty>
                      {searchQuery.length < 2 
                        ? 'Type at least 2 characters to search...'
                        : 'No results found.'
                      }
                    </CommandEmpty>
                  ) : (
                    <>
                      {searchResults.filter(r => r.type === 'job').length > 0 && (
                        <CommandGroup heading="Jobs">
                          {searchResults.filter(r => r.type === 'job').map((result) => (
                            <CommandItem
                              key={result.id}
                              onSelect={() => handleSelect(result)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Job</Badge>
                                <div>
                                  <p className="font-medium">{result.title}</p>
                                  <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {searchResults.filter(r => r.type === 'candidate').length > 0 && (
                        <CommandGroup heading="Candidates">
                          {searchResults.filter(r => r.type === 'candidate').map((result) => (
                            <CommandItem
                              key={result.id}
                              onSelect={() => handleSelect(result)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">Candidate</Badge>
                                <div>
                                  <p className="font-medium">{result.title}</p>
                                  <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Quick Add */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Quick Add</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/jobs/new')}>
                Add New Job
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/candidates/new')}>
                Add Candidate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/clients/new')}>
                Add Client
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/ai-match')}>
                Run AI Match
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User Avatar - Mobile */}
          <Avatar className="w-8 h-8 md:hidden">
            <AvatarImage src={profile?.avatar_url || ''} alt={userName} />
            <AvatarFallback>
              {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
