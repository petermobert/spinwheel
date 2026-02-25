import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";
import { fetchWheelBySlug } from "@/lib/wheelsServer";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidZip(zip: string) {
  const digits = zip.replace(/\D/g, "");
  return digits.length === 5 || digits.length === 9;
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
}

async function lookupCityByZip(zip: string): Promise<string | null> {
  const zipDigits = zip.replace(/\D/g, "");
  const fiveDigitZip = zipDigits.slice(0, 5);
  if (fiveDigitZip.length !== 5) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`https://api.zippopotam.us/us/${fiveDigitZip}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const placeName = data?.places?.[0]?.["place name"];
    if (typeof placeName === "string" && placeName.trim()) {
      return placeName.trim();
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const wheelSlug = (request.nextUrl.searchParams.get("wheel") || "").trim();
    const wheelLookup = await fetchWheelBySlug(wheelSlug);
    if ("error" in wheelLookup) {
      return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
    }
    if (!wheelLookup.wheel.is_active) {
      return NextResponse.json({ error: "Wheel is not active" }, { status: 404 });
    }

    const body = await request.json();

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const street = String(body.street || "").trim() || null;
    const inputCity = String(body.city || "").trim();
    const zipCode = String(body.zipCode || "").trim();
    const phoneNumber = String(body.phoneNumber || "").trim();
    const emailAddress = String(body.emailAddress || "").trim().toLowerCase();
    const followUpRaw = String(body.followUpRequested || "").toLowerCase();
    const followUpRequested = followUpRaw === "yes";

    // if (!firstName || !lastName || !zipCode || !phoneNumber || !emailAddress) {
      if (!firstName || !lastName || !inputCity || !phoneNumber || !emailAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (followUpRaw !== "yes" && followUpRaw !== "no") {
      return NextResponse.json({ error: "Follow-up selection is required" }, { status: 400 });
    }

    // if (!isValidZip(zipCode)) {
    //   return NextResponse.json({ error: "Invalid zip code" }, { status: 400 });
    // }

    if (!isValidPhone(phoneNumber)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    if (!isValidEmail(emailAddress)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    let city: string | null = inputCity || null;
    if (!city) {
      city = await lookupCityByZip(zipCode);
    }

    const admin = createServiceClient();
    const displayName = `${firstName} ${lastName.charAt(0)}.`;

    const { data, error } = await admin.rpc("create_public_lead", {
      p_wheel_id: wheelLookup.wheel.id,
      p_first_name: firstName,
      p_last_name: lastName,
      p_street: street,
      p_city: city,
      p_zip_code: zipCode,
      p_phone_number: phoneNumber,
      p_email_address: emailAddress,
      p_follow_up_requested: followUpRequested,
      p_display_name: displayName
    });

    if (error) {
      const detail =
        process.env.NODE_ENV === "development"
          ? `${error.message}${error.details ? ` | ${error.details}` : ""}`
          : "Failed to save submission";
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    return NextResponse.json({ ok: true, leadId: data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
