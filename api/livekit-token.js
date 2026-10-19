const { AccessToken, TrackSource } = require("livekit-server-sdk");

const LIVE_ROOM = "mubadara-live-upload";
const DEFAULT_APP_ORIGIN = "https://mubadara-online.vercel.app";
const ROLE_OWNER = new Set(["owner", "manager"]);

function reply(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return res.status(status).json(body);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host || "";
  const forwardedProto = req.headers["x-forwarded-proto"] || "https";
  const requestHost = String(forwardedHost).split(",")[0].trim();
  const requestProto = String(forwardedProto).split(",")[0].trim();
  const requestOrigin = requestHost ? `${requestProto}://${requestHost}` : "";
  const configuredOrigin = process.env.APP_ORIGIN || DEFAULT_APP_ORIGIN;
  res.setHeader("Vary", "Origin");
  if (origin && origin !== configuredOrigin && origin !== requestOrigin) return false;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, apikey");
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (!setCors(req, res)) return reply(res, 403, { error: "Origin not allowed" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return reply(res, 405, { error: "POST method required" });

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken || accessToken.length > 8192) {
    return reply(res, 401, { error: "Authentication required" });
  }

  const action = req.body && typeof req.body.action === "string" ? req.body.action : "";
  if (action !== "publish" && action !== "watch") {
    return reply(res, 400, { error: "Unsupported action" });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const livekitUrl = process.env.LIVEKIT_URL || "";
  const livekitApiKey = process.env.LIVEKIT_API_KEY || "";
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "";
  if (!supabaseUrl || !publishableKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return reply(res, 503, { error: "Live broadcast service is not configured" });
  }

  try {
    const headers = {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const authUser = await readJson(authResponse);
    if (!authResponse.ok || !authUser || typeof authUser.id !== "string") {
      return reply(res, 401, { error: "Authentication required" });
    }

    const profileUrl = new URL(`${supabaseUrl}/rest/v1/app_user_profiles`);
    profileUrl.searchParams.set(
      "select",
      "user_id,username,display_name,officer_name,app_role,is_active,is_blocked,is_linked"
    );
    profileUrl.searchParams.set("user_id", `eq.${authUser.id}`);
    const profileResponse = await fetch(profileUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const profiles = await readJson(profileResponse);
    if (!profileResponse.ok || !Array.isArray(profiles) || profiles.length !== 1) {
      // Fail closed if the current Supabase row-level policies do not permit this self-read.
      return reply(res, 403, { error: "Account role could not be verified" });
    }

    const profile = profiles[0];
    if (
      profile.user_id !== authUser.id ||
      profile.is_active !== true ||
      profile.is_blocked !== false ||
      profile.is_linked !== true
    ) {
      return reply(res, 403, { error: "Account is not permitted to use live broadcast" });
    }

    const isOwner = ROLE_OWNER.has(profile.app_role);
    const isOfficer = profile.app_role === "officer";
    if (!isOwner && !isOfficer) {
      return reply(res, 403, { error: "Account role is not permitted" });
    }
    if (action === "watch" && !isOwner) {
      return reply(res, 403, { error: "Only owners may watch the broadcast" });
    }

    const canPublish = action === "publish";
    const canSubscribe = isOwner;
    const verifiedName = isOfficer
      ? (profile.officer_name || profile.display_name || profile.username || "الأخصائي")
      : (profile.display_name || profile.username || "المالك");
    const participantName = String(verifiedName).trim().slice(0, 80) || (isOwner ? "المالك" : "الأخصائي");
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: authUser.id,
      name: participantName,
      ttl: "10m",
    });
    token.addGrant({
      roomJoin: true,
      room: LIVE_ROOM,
      canPublish,
      canPublishSources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
      canPublishData: false,
      canSubscribe,
    });

    return reply(res, 200, {
      url: livekitUrl,
      token: await token.toJwt(),
      room: LIVE_ROOM,
      action,
    });
  } catch (error) {
    console.error("LiveKit token request failed:", error?.name || "Error");
    return reply(res, 500, { error: "Unable to create live broadcast access" });
  }
};
