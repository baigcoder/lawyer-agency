'use client';

import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initialsOf } from '@/lib/format';
import { useLanguage } from '@/lib/language';

export function AccountMenu({
  name,
  email,
  role,
  imageUrl,
  onLogout,
}: {
  name: string;
  email?: string | null;
  role?: string | null;
  imageUrl?: string | null;
  onLogout: () => void;
}) {
  const { t } = useLanguage();
  const initials = initialsOf(name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 overflow-hidden rounded-full p-0"
            aria-label={t('accountMenu')}
          />
        }
      >
        <Avatar size="default">
          {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
            {role ? <p className="mt-1 text-xs text-muted-foreground">{role}</p> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut />
          {t('logOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
