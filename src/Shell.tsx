/**
 * Shell — Mobile-responsive app layout.
 * Stubbed version (blinkdotnew/ui dependency removed for local dev).
 */
import React from 'react'

interface ShellProps {
  sidebar: React.ReactNode
  appName?: string
  children: React.ReactNode
}

export function Shell({ sidebar, appName = 'App', children }: ShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:block w-64 border-r border-border bg-background">
        {sidebar}
      </aside>
      <main className="flex-1">
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background sticky top-0 z-30">
          <span className="font-semibold text-sm">{appName}</span>
        </div>
        {children}
      </main>
    </div>
  )
}
