import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { user: session.user, error: null };
}
