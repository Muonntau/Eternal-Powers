/** Resolve shipped files within the deployment base, including GitHub project Pages. */
export function withBase(path, base = import.meta.env?.BASE_URL || "/") {
  const root = `/${String(base).replace(/^\/+|\/+$/g, "")}${String(base).replace(/^\/+|\/+$/g, "") ? "/" : ""}`;
  const value = String(path || "");
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  if (root !== "/" && value.startsWith(root)) return value;
  return root + value.replace(/^\/+/, "");
}
export const assetUrl = (path) => withBase(path);
