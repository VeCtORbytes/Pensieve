"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="px-3.5 py-1.5 text-xs font-semibold text-ink bg-white border border-rule rounded-xl hover:border-accent shadow-xs transition cursor-pointer"
          >
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-ink rounded-xl hover:bg-accent shadow-xs transition cursor-pointer"
          >
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>

      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8 rounded-full border border-rule",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
