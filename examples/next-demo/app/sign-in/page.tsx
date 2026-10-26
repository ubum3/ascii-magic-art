import { SignIn } from "./SignIn";

export const metadata = { title: "Sign in · Lumino" };

/** A mock sign-in page: a random Lumino background on every load. ?bg=<id> pins one. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ bg?: string }> }) {
  const { bg } = await searchParams;
  return <SignIn pick={bg} />;
}
