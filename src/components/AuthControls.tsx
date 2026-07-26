"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="px-3.5 py-1.5 text-xs font-semibold text-[#141A22] bg-white border border-[#E2E7EA] rounded-xl hover:border-[#3B4CC0] shadow-2xs transition cursor-pointer"
          >
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#141A22] rounded-xl hover:bg-[#3B4CC0] shadow-xs transition cursor-pointer"
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
              avatarBox: "w-8 h-8 rounded-full border border-[#E2E7EA]",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
