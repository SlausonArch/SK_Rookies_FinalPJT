import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export async function GET() {
  return NextResponse.json({
    react: pkg.dependencies.react,
    next: pkg.dependencies.next,
    node: process.version,
  });
}
