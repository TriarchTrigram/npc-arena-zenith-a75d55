import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getPublicProfile } from "../../auth/public-profile";
import { getSession } from "../../auth/server";
import { PublicProfileCard } from "../../ui/auth/public-profile";

/** /profile/:userId — the stock public profile of one app user: the name and photo they
 *  set on the account page, open to anyone with the link. Registered only by an app that
 *  spreads `stencilPublicProfileRoutes`; an app that shows more builds its own route on
 *  `getPublicProfile` and `<PublicProfileCard>`. */
export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const profile = await getPublicProfile(env, params.userId ?? "");
  if (!profile) throw new Response("Not Found", { status: 404 });
  const session = await getSession(request, env);
  return { profile, isOwn: session?.user.id === profile.id };
}

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  return [{ title: data?.profile.name ?? "Profile" }];
}

export default function PublicProfilePage() {
  const { profile, isOwn } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <PublicProfileCard profile={profile} />
      {isOwn ? (
        <a
          href={`/auth/account?next=${encodeURIComponent(`/profile/${profile.id}`)}`}
          className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
        >
          Edit your name and photo
        </a>
      ) : null}
    </main>
  );
}
