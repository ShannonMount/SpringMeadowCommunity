import "server-only";

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return process.env.NODE_ENV !== "production" && token === "development-turnstile-token";
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }

  try {
    const response = await fetch(siteverifyUrl, {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as TurnstileResponse;

    if (result["error-codes"]?.includes("timeout-or-duplicate")) {
      return false;
    }

    return Boolean(result.success);
  } catch {
    return false;
  }
}
