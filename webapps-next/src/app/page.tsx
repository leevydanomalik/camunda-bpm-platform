import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm uppercase tracking-wide">camunda-next-webapps</p>
        <h1 className="text-3xl font-semibold">Camunda Platform</h1>
        <p className="text-muted-foreground">
          Next.js rewrite of the Camunda webapps. The Java engine still owns process/identity state — this app
          consumes it via <code className="bg-muted rounded px-1.5 py-0.5 text-xs">engine-rest</code>.
        </p>
      </header>

      <nav className="grid gap-3">
        <AppLink href="/cockpit" title="Cockpit" description="Process & decision administration." />
        <AppLink href="/tasklist" title="Tasklist" description="User task inbox." />
        <AppLink href="/admin" title="Admin" description="Users, groups, authorizations." />
        <AppLink href="/welcome" title="Welcome" description="Login and app launcher." />
      </nav>
    </main>
  );
}

function AppLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="hover:bg-accent rounded-md border p-4 transition-colors"
    >
      <div className="font-medium">{title}</div>
      <div className="text-muted-foreground text-sm">{description}</div>
    </Link>
  );
}
