import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidZip(zip: string) {
  return /^\d{5}(?:-\d{4})?$/.test(zip.trim());
}

function isValidPhone(phone: string) {
  return /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(phone.replace(/\s+/g, ""));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const street = String(body.street || "").trim() || null;
    const city = String(body.city || "").trim() || null;
    const zipCode = String(body.zipCode || "").trim();
    const phoneNumber = String(body.phoneNumber || "").trim();
    const emailAddress = String(body.emailAddress || "").trim().toLowerCase();
    const followUpRaw = String(body.followUpRequested || "").toLowerCase();
    const followUpRequested = followUpRaw === "yes";

    if (!firstName || !lastName || !zipCode || !phoneNumber || !emailAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (followUpRaw !== "yes" && followUpRaw !== "no") {
      return NextResponse.json({ error: "Follow-up selection is required" }, { status: 400 });
    }

    if (!isValidZip(zipCode)) {
      return NextResponse.json({ error: "Invalid zip code" }, { status: 400 });
    }

    if (!isValidPhone(phoneNumber)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    if (!isValidEmail(emailAddress)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const admin = createServiceClient();
    const displayName = `${firstName} ${lastName.charAt(0)}.`;

    const { data, error } = await admin.rpc("create_public_lead", {
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
      return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, leadId: data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
