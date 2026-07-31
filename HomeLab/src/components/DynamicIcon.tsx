import * as Icons from 'lucide-react';

interface DynamicIconProps {
  name?: string;
  className?: string;
}

export function DynamicIcon({ name, className = "w-5 h-5" }: DynamicIconProps) {
  // Fallback, wenn kein Name übergeben wurde
  if (!name) return <Icons.Globe className={className} />;

  // Zweistufiger Cast über 'unknown', um TS-Strict-Checks zu umgehen
  const iconsMap = Icons as unknown as Record<string, Icons.LucideIcon>;
  const IconComponent = iconsMap[name];

  if (!IconComponent) {
    return <Icons.Globe className={className} />; // Fallback bei ungültigem Namen
  }

  return <IconComponent className={className} />;
}