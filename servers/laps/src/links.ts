export function rushUrl(toolName: string, medium = "plugin"): string {
  const url = new URL("https://rushautoworks.com/rush-sr/");
  url.searchParams.set("utm_source", "mcp");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", "rush-sr-laps");
  url.searchParams.set("utm_content", toolName);
  return url.toString();
}

export const rushLink = (toolName: string, medium = "plugin") => ({ label: "View the Rush SR", url: rushUrl(toolName, medium) });
export const attribution = (toolName: string, medium = "plugin") => `Built by Rush Auto Works: ${rushUrl(toolName, medium)}`;
