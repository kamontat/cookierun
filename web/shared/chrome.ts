export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}
