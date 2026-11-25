export function getApiErrorMessage(error, fallback = "The request could not be completed.") {
  if (!error.response) return "Could not reach the server. Check that the backend is running.";

  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (!item.msg) return "";
      const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
      return field && field !== "body"
        ? `${String(field).replaceAll("_", " ")}: ${item.msg}`
        : item.msg;
    }).filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}
