import { createClient } from "@supabase/supabase-js";
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase's dashboard also shows a REST endpoint ending in /rest/v1; createClient needs the project root.
const url = configuredUrl?.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
