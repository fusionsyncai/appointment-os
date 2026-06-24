import { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthLayout({
  icon: Icon,
  title,
  subtitle,
  footer,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="mt-1">{subtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
