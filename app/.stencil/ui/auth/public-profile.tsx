import type { PropsWithChildren } from "react";

/** An app user's photo (or initial) and name, with whatever the app adds below as
 *  children: a bio, links, listings. */
export function PublicProfileCard({
  profile,
  className,
  children,
}: PropsWithChildren<{ profile: { name: string; image: string | null }; className?: string }>) {
  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        {profile.image ? (
          <img src={profile.image} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl">
            {(profile.name.trim()[0] ?? "?").toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-medium">{profile.name}</h1>
      </div>
      {children}
    </div>
  );
}
