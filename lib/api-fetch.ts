import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ApiFetchOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const token = Cookies.get("token");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",

      ...(auth && token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),

      ...headers,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message || "Something went wrong");
  }

  return result;
}
